import type { ObservationDraft } from "./observations";
function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("stickney-arrival-observation-drafts-v1", 1);
    r.onupgradeneeded = () =>
      r.result.createObjectStore("drafts", { keyPath: "id" });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () =>
      reject(
        new Error(
          "Device storage is unavailable. Keep this screen open until you save online.",
        ),
      );
  });
}
export async function observationDrafts(
  owner: string,
): Promise<ObservationDraft[]> {
  const d = await db();
  try {
    return await new Promise((resolve, reject) => {
      const r = d.transaction("drafts").objectStore("drafts").getAll();
      r.onsuccess = () =>
        resolve(
          r.result
            .filter((v: ObservationDraft) => v.owner === owner)
            .sort(
              (a: ObservationDraft, b: ObservationDraft) =>
                b.modifiedAt - a.modifiedAt,
            ),
        );
      r.onerror = () => reject(r.error);
    });
  } finally {
    d.close();
  }
}
export async function keepObservationDraft(value: ObservationDraft) {
  const d = await db();
  try {
    await new Promise<void>((resolve, reject) => {
      const t = d.transaction("drafts", "readwrite");
      const store = t.objectStore("drafts");
      const r = store.get(value.id);
      r.onsuccess = () => {
        if (!r.result || r.result.modifiedAt <= value.modifiedAt)
          store.put(value);
      };
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  } finally {
    d.close();
  }
}
export async function removeObservationDraft(id: string) {
  const d = await db();
  try {
    await new Promise<void>((resolve, reject) => {
      const t = d.transaction("drafts", "readwrite");
      t.objectStore("drafts").delete(id);
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
  } finally {
    d.close();
  }
}
