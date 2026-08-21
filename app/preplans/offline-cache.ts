const DATABASE_NAME = "stickney-preplan-respond";
const STORE_NAME = "published-preplans";
const RESPOND_STORE_NAME = "respond-packets";
const DATABASE_VERSION = 2;

export type CachedPublishedPreplan<T> = {
  id: string;
  revision: number;
  cachedAt: string;
  payload: T;
};

function openCache(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined")
    return Promise.reject(new Error("Offline storage is unavailable"));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME))
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      if (!database.objectStoreNames.contains(RESPOND_STORE_NAME))
        database.createObjectStore(RESPOND_STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        request.error ?? new Error("Unable to open offline preplan cache"),
      );
  });
}

export type CachedRespondPacket<T> = {
  id: string;
  departmentId: string;
  apparatus: string;
  cachedAt: string;
  payload: T;
};

export async function cacheRespondPacket<T>(
  entry: CachedRespondPacket<T>,
): Promise<void> {
  const database = await openCache();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(RESPOND_STORE_NAME, "readwrite");
    const store = transaction.objectStore(RESPOND_STORE_NAME);
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      const cached = cursor.value as CachedRespondPacket<unknown>;
      if (cached.departmentId !== entry.departmentId) cursor.delete();
      cursor.continue();
    };
    store.put(entry);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Unable to cache Respond packet"));
  });
  database.close();
}

export async function getCachedRespondPacket<T>(
  departmentId: string,
  apparatus: string,
): Promise<CachedRespondPacket<T> | null> {
  const database = await openCache();
  const id = `${departmentId}:${apparatus || "all"}`;
  const result = await new Promise<CachedRespondPacket<T> | undefined>(
    (resolve, reject) => {
      const request = database
        .transaction(RESPOND_STORE_NAME, "readonly")
        .objectStore(RESPOND_STORE_NAME)
        .get(id);
      request.onsuccess = () =>
        resolve(request.result as CachedRespondPacket<T> | undefined);
      request.onerror = () =>
        reject(
          request.error ?? new Error("Unable to read cached Respond packet"),
        );
    },
  );
  database.close();
  return result ?? null;
}

export async function removeCachedRespondPacket(
  departmentId: string,
  apparatus: string,
): Promise<void> {
  const database = await openCache();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(RESPOND_STORE_NAME, "readwrite");
    transaction
      .objectStore(RESPOND_STORE_NAME)
      .delete(`${departmentId}:${apparatus || "all"}`);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(
        transaction.error ??
          new Error("Unable to remove cached Respond packet"),
      );
  });
  database.close();
}

export async function clearCachedRespondPackets(): Promise<void> {
  const database = await openCache();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(RESPOND_STORE_NAME, "readwrite");
    transaction.objectStore(RESPOND_STORE_NAME).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(
        transaction.error ??
          new Error("Unable to clear cached Respond packets"),
      );
  });
  database.close();
}

export async function cachePublishedPreplan<T>(
  entry: CachedPublishedPreplan<T>,
): Promise<void> {
  const database = await openCache();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(entry);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(
        transaction.error ?? new Error("Unable to cache published preplan"),
      );
  });
  database.close();
}

export async function getCachedPublishedPreplan<T>(
  id: string,
): Promise<CachedPublishedPreplan<T> | null> {
  const database = await openCache();
  const result = await new Promise<CachedPublishedPreplan<T> | undefined>(
    (resolve, reject) => {
      const request = database
        .transaction(STORE_NAME, "readonly")
        .objectStore(STORE_NAME)
        .get(id);
      request.onsuccess = () =>
        resolve(request.result as CachedPublishedPreplan<T> | undefined);
      request.onerror = () =>
        reject(
          request.error ?? new Error("Unable to read offline preplan cache"),
        );
    },
  );
  database.close();
  return result ?? null;
}

export async function clearCachedPublishedPreplans(): Promise<void> {
  const database = await openCache();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(
        transaction.error ?? new Error("Unable to clear offline preplans"),
      );
  });
  database.close();
}
