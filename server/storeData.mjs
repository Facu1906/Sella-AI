import { readFile } from "fs/promises";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// In-memory cache — avoids re-reading disk on every request
const cache = new Map();

/**
 * Load products + policies for a given store ID.
 * Files expected at: /catalog/{storeId}/products.json
 *                    /catalog/{storeId}/policies.json
 *
 * @param {string} storeId  e.g. "demo-store"
 * @returns {{ products: object[], policies: object }}
 */
export async function loadStoreData(storeId) {
  if (cache.has(storeId)) return cache.get(storeId);

  const base = resolve(__dirname, "..", "catalog", storeId);

  const [productsRaw, policiesRaw] = await Promise.all([
    readFile(`${base}/products.json`, "utf-8"),
    readFile(`${base}/policies.json`, "utf-8"),
  ]);

  const data = {
    products: JSON.parse(productsRaw),
    policies: JSON.parse(policiesRaw),
  };

  cache.set(storeId, data);
  console.log(`[store] Loaded "${storeId}" — ${data.products.length} products`);
  return data;
}

/** Clear cache for a store (useful during dev / hot-reload). */
export function clearStoreCache(storeId) {
  cache.delete(storeId);
}