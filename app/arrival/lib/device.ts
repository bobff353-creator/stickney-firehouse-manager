import type { PlanRecord } from "./preplan";
export type Packet = {
  id: string;
  owner: string;
  record: PlanRecord;
  savedAt: string;
  images: Record<string, string>;
};
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("stickney-arrival-device-v1", 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("packets", { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error("Device storage is unavailable."));
  });
}
export async function packets(owner: string): Promise<Packet[]> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction("packets").objectStore("packets").getAll();
      req.onsuccess = () =>
        resolve(req.result.filter((x: Packet) => x.owner === owner));
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}
export async function putPacket(packet: Packet) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("packets", "readwrite");
      tx.objectStore("packets").put(packet);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function removePacket(id: string) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("packets", "readwrite");
      tx.objectStore("packets").delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function clearDevice() {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("packets", "readwrite");
      tx.objectStore("packets").clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export function downloadJson(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export async function saveOffline(owner: string, record: PlanRecord) {
  if (!record.published)
    throw new Error("Publish this preplan before saving an arrival packet.");
  const images: Record<string, string> = {};
  for (const photo of record.published.photos.filter((x) =>
    x.type.startsWith("image/"),
  )) {
    const response = await fetch("/api/arrival/files/" + photo.id, {
      cache: "no-store",
    });
    if (!response.ok)
      throw new Error(
        "A photo could not be downloaded. Your previous offline packet was kept.",
      );
    const blob = await response.blob();
    images[photo.id] = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }
  const approved = {
    ...record,
    working: record.published,
    status: "published" as const,
  };
  await putPacket({
    id: record.id,
    owner,
    record: approved,
    savedAt: new Date().toISOString(),
    images,
  });
}
