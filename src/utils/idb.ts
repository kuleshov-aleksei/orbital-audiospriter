const DB_NAME = "orbital-audiospriter"
const STORE = "kv"

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"))
  })
}

function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const request = action(tx.objectStore(STORE))
        request.onsuccess = () => resolve(request.result as T)
        request.onerror = () => reject(request.error ?? new Error("IndexedDB op failed"))
        // Guard against the transaction aborted without a request error.
        tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"))
      }),
  )
}

export function idbGet<T>(key: string): Promise<T | undefined> {
  return run<T | undefined>("readonly", (store) => store.get(key))
}

export function idbSet<T>(key: string, value: T): Promise<void> {
  return run<void>("readwrite", (store) => store.put(value, key))
}

export function idbDel(key: string): Promise<void> {
  return run<void>("readwrite", (store) => store.delete(key))
}
