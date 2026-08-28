/**
 * Offline Product Caching
 * Cache products to IndexedDB for offline access
 */

const DB_NAME = "stockhive-offline";
const DB_VERSION = 2;
const PRODUCTS_STORE = "products";
const CACHE_METADATA_STORE = "cache-metadata";

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

      // Create products store
      if (!db.objectStoreNames.contains(PRODUCTS_STORE)) {
        const store = db.createObjectStore(PRODUCTS_STORE, { keyPath: "id" });
        store.createIndex("shop_id", "shop_id");
        store.createIndex("cached_at", "cached_at");
      }

      // Create cache metadata store
      if (!db.objectStoreNames.contains(CACHE_METADATA_STORE)) {
        db.createObjectStore(CACHE_METADATA_STORE, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Cache products to IndexedDB
 * @param {Array} products - Array of product objects
 * @param {string} shopId - Shop ID for organization
 */
export async function cacheProducts(products, shopId) {
  try {
    const db = await openDB();
    const transaction = db.transaction([PRODUCTS_STORE, CACHE_METADATA_STORE], "readwrite");

    // Store products
    const productsStore = transaction.objectStore(PRODUCTS_STORE);
    for (const product of products) {
      await requestToPromise(
        productsStore.put({
          ...product,
          shop_id: shopId,
          cached_at: new Date().toISOString(),
        })
      );
    }

    // Update cache timestamp
    const metadataStore = transaction.objectStore(CACHE_METADATA_STORE);
    await requestToPromise(
      metadataStore.put({
        key: `products_${shopId}`,
        cached_at: new Date().toISOString(),
        count: products.length,
      })
    );

    await transactionDone(transaction);
    return { success: true, count: products.length };
  } catch (error) {
    console.error("Failed to cache products:", error);
    return { success: false, error };
  }
}

/**
 * Get cached products for a shop
 * @param {string} shopId - Shop ID
 * @returns {Promise<Array>} Cached products
 */
export async function getCachedProducts(shopId) {
  try {
    const db = await openDB();
    const transaction = db.transaction(PRODUCTS_STORE, "readonly");
    const store = transaction.objectStore(PRODUCTS_STORE);
    const index = store.index("shop_id");

    const request = index.getAll(shopId);
    const products = await requestToPromise(request);
    await transactionDone(transaction);

    return products.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error("Failed to get cached products:", error);
    return [];
  }
}

/**
 * Get cache metadata
 * @param {string} shopId - Shop ID
 * @returns {Promise<Object|null>} Cache metadata or null
 */
export async function getCacheMetadata(shopId) {
  try {
    const db = await openDB();
    const transaction = db.transaction(CACHE_METADATA_STORE, "readonly");
    const store = transaction.objectStore(CACHE_METADATA_STORE);

    const request = store.get(`products_${shopId}`);
    const metadata = await requestToPromise(request);
    await transactionDone(transaction);

    return metadata || null;
  } catch (error) {
    console.error("Failed to get cache metadata:", error);
    return null;
  }
}

/**
 * Clear cached products for a shop
 * @param {string} shopId - Shop ID
 */
export async function clearCachedProducts(shopId) {
  try {
    const db = await openDB();
    const transaction = db.transaction([PRODUCTS_STORE, CACHE_METADATA_STORE], "readwrite");

    // Clear products for this shop
    const productsStore = transaction.objectStore(PRODUCTS_STORE);
    const index = productsStore.index("shop_id");
    const range = IDBKeyRange.only(shopId);
    await requestToPromise(index.openCursor(range)).then((cursor) => {
      if (cursor) {
        cursor.delete();
        return cursor.continue();
      }
    });

    // Clear metadata
    const metadataStore = transaction.objectStore(CACHE_METADATA_STORE);
    await requestToPromise(metadataStore.delete(`products_${shopId}`));

    await transactionDone(transaction);
    return { success: true };
  } catch (error) {
    console.error("Failed to clear cached products:", error);
    return { success: false, error };
  }
}

/**
 * Check if cache is stale (older than 1 hour)
 * @param {string} shopId - Shop ID
 * @returns {Promise<boolean>} True if cache is stale
 */
export async function isCacheStale(shopId) {
  const metadata = await getCacheMetadata(shopId);
  if (!metadata) return true;

  const cachedAt = new Date(metadata.cached_at);
  const now = new Date();
  const ageMinutes = (now - cachedAt) / (1000 * 60);

  return ageMinutes > 60; // Cache expires after 1 hour
}
