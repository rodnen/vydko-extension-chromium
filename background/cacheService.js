import { CONSTANTS } from '../config/constants.js';
import { Utils } from '../utils/utils.js';

export class BackgroundCacheService {
  #pendingRequests = new Map();

  cacheKey(cacheParts) {
    if (Array.isArray(cacheParts)) {
      return [CONSTANTS.CACHE_KEY_PREFIX, ...cacheParts].join(':');
    }

    const sortedParts = Object.keys(cacheParts)
      .sort()
      .map(key => cacheParts[key]);

    return [CONSTANTS.CACHE_KEY_PREFIX, ...sortedParts].join(':');
  }

  async get(cacheParts) {
    const key = this.cacheKey(cacheParts);
    const stored = await Utils.getStorageData(key);
    if (!stored[key]) return null;

    const { ts, html } = stored[key];
    const valid = Date.now() - ts < CONSTANTS.CACHE_TTL_MIN * 60 * 1000;

    if (!valid) {
      await Utils.removeStorageData(key);
      return null;
    }

    return html;
  }

  async set(cacheParts, value) {
    const key = this.cacheKey(cacheParts);
    await Utils.setStorageData({
      [key]: { ts: Date.now(), html: value }
    });
  }

  async getDtekRawData(type) {
    const key = `dtek:raw:data-${type}`;
    const stored = await Utils.getStorageData(key);
    const entry = stored[key];

    if (!entry?.ts) return null;

    const valid = Date.now() - entry.ts < CONSTANTS.CACHE_TTL_MIN * 60 * 1000;
    if (!valid) {
      await Utils.removeStorageData(key);
      return null;
    }

    return entry.payload;
  }

  getOrCreateRequest(key, factory) {
    const existing = this.#pendingRequests.get(key);
    if (existing) return existing;

    const request = Promise.resolve()
      .then(factory)
      .finally(() => this.#pendingRequests.delete(key));

    this.#pendingRequests.set(key, request);
    return request;
  }

  async clearTableCache(force = false) {
    try {
      const all = await chrome.storage.local.get();
      const cacheKeys = Object.keys(all)
        .filter(key => key.startsWith(CONSTANTS.CACHE_KEY_PREFIX));
      const now = Date.now();

      const toRemove = force
        ? cacheKeys
        : cacheKeys.filter(key => {
          const timestamp = all[key]?.ts;
          return !timestamp || now - timestamp >= CONSTANTS.CACHE_TTL_MIN * 60 * 1000;
        });

      if (toRemove.length) {
        await chrome.storage.local.remove(toRemove);
      }

      return { success: true, removed: toRemove.length, force };
    } catch (error) {
      return { success: false, error };
    }
  }

  async clearAllCache() {
    try {
      const all = await chrome.storage.local.get();
      const removedCount = Object.keys(all).length;

      await chrome.storage.local.clear();

      return { success: true, removed: removedCount };
    } catch (error) {
      return { success: false, error };
    }
  }
}
