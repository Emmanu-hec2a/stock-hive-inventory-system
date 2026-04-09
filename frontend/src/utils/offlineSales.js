import api from "../api/client";

const DB_NAME = "stockhive-offline";
const DB_VERSION = 1;
const STORE_NAME = "pending-sales";
const OFFLINE_SALES_EVENT = "offline-sales-changed";

function emitOfflineSalesChanged() {
  window.dispatchEvent(new Event(OFFLINE_SALES_EVENT));
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("savedAt", "savedAt");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveSaleOffline({ url, payload, summary = "", actorId = "default" }) {
  const db = await openDB();
  const transaction = db.transaction(STORE_NAME, "readwrite");
  const request = transaction.objectStore(STORE_NAME).add({
    actorId,
    url,
    payload,
    summary,
    savedAt: new Date().toISOString(),
    synced: false,
  });

  const id = await requestToPromise(request);
  await transactionDone(transaction);
  emitOfflineSalesChanged();
  return id;
}

export async function getPendingSales(actorId = null) {
  const db = await openDB();
  const transaction = db.transaction(STORE_NAME, "readonly");
  const request = transaction.objectStore(STORE_NAME).getAll();
  const sales = await requestToPromise(request);
  await transactionDone(transaction);
  return sales
    .filter((sale) => (actorId ? sale.actorId === actorId : true))
    .sort((left, right) => new Date(left.savedAt) - new Date(right.savedAt));
}

export async function countPendingSales(actorId = null) {
  const sales = await getPendingSales(actorId);
  return sales.length;
}

export async function removePendingSale(id) {
  const db = await openDB();
  const transaction = db.transaction(STORE_NAME, "readwrite");
  transaction.objectStore(STORE_NAME).delete(id);
  await transactionDone(transaction);
  emitOfflineSalesChanged();
}

export async function syncPendingSales({ actorId = null } = {}) {
  if (!navigator.onLine) {
    return { syncedCount: 0, pendingCount: await countPendingSales(actorId) };
  }

  const pendingSales = await getPendingSales(actorId);
  let syncedCount = 0;

  for (const sale of pendingSales) {
    try {
      await api.post(sale.url, sale.payload);
      await removePendingSale(sale.id);
      syncedCount += 1;
    } catch (error) {
      return {
        syncedCount,
        pendingCount: await countPendingSales(actorId),
        error,
      };
    }
  }

  return {
    syncedCount,
    pendingCount: await countPendingSales(actorId),
  };
}

export { OFFLINE_SALES_EVENT };
