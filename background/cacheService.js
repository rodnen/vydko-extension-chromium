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

  /**
   * Прибирає з appCache лише кешовані адресні дані (списки будинків і дані
   * будинку), зберігаючи вибраний ОСР, чергу та адресу користувача.
   * @param {string} raw
   * @returns {string|null} оновлений JSON або null, якщо його неможливо розібрати
   */
  #stripAddressCache(raw) {
    try {
      const cache = JSON.parse(raw);
      if (!cache || typeof cache !== 'object') return null;

      for (const provider of Object.values(cache)) {
        const byDso = provider?.byDso;
        if (!byDso || typeof byDso !== 'object') continue;

        for (const dso of Object.values(byDso)) {
          if (!dso || typeof dso !== 'object') continue;
          delete dso.houses;
          delete dso.houseData;
        }
      }

      return JSON.stringify(cache);
    } catch {
      return null;
    }
  }

  /**
   * Очищає лише кеш таблиць і кеш адрес. Налаштування користувача
   * (провайдер, тема, мова, сповіщення, вибрана адреса) не змінюються.
   */
  async clearAllCache() {
    try {
      const all = await chrome.storage.local.get();
      const toRemove = Object.keys(all).filter(key =>
        key.startsWith(CONSTANTS.CACHE_KEY_PREFIX) ||
        key.startsWith('dtek:raw:')
      );

      let appCacheCleared = false;
      if (typeof all.appCache === 'string') {
        const stripped = this.#stripAddressCache(all.appCache);
        if (stripped == null) {
          toRemove.push('appCache');
        } else {
          await Utils.setStorageData({ appCache: stripped });
          appCacheCleared = stripped !== all.appCache;
        }
      }

      if (toRemove.length) {
        await Utils.removeStorageData(toRemove);
      }

      return {
        success: true,
        removed: toRemove.length + (appCacheCleared ? 1 : 0)
      };
    } catch (error) {
      return { success: false, error };
    }
  }
}
