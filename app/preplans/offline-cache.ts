const DATABASE_NAME = "stickney-preplan-respond";
const STORE_NAME = "published-preplans";
const DATABASE_VERSION = 1;

export type CachedPublishedPreplan<T> = { id: string; revision: number; cachedAt: string; payload: T };

function openCache(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("Offline storage is unavailable"));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open offline preplan cache"));
  });
}

export async function cachePublishedPreplan<T>(entry: CachedPublishedPreplan<T>): Promise<void> {
  const database = await openCache();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(entry);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Unable to cache published preplan"));
  });
  database.close();
}

export async function getCachedPublishedPreplan<T>(id: string): Promise<CachedPublishedPreplan<T> | null> {
  const database = await openCache();
  const result = await new Promise<CachedPublishedPreplan<T> | undefined>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result as CachedPublishedPreplan<T> | undefined);
    request.onerror = () => reject(request.error ?? new Error("Unable to read offline preplan cache"));
  });
  database.close();
  return result ?? null;
}

export async function clearCachedPublishedPreplans(): Promise<void> {
  const database = await openCache();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Unable to clear offline preplans"));
  });
  database.close();
}
