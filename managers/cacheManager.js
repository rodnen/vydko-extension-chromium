import { CONSTANTS } from '../config/constants.js';
import { Utils } from '../utils/utils.js';

// Структура сховища (chrome.storage.local → ключ 'appCache'):
// {
//   yasno: {
//     select:    { group, dsoId, regionId },
//     byDso: {
//       [dsoId]: {
//         location:  { city, street, house, group },
//         houses:    { city, street, data, updateTimestamp },
//         houseData: { data, updateTimestamp }
//       }
//     }
//   },
//   dtek: {
//     select:    { group, dsoId, regionId },
//     byDso: {
//       [dsoId]: {
//         location:  { city, street, house, group },
//         houses:    { city, street, data, updateTimestamp },
//         houseData: { data, updateTimestamp }
//       }
//     }
//  }
export class CacheManager {
  #mem = {};
  #saveTimer = null;
  #activeProvider = null;
  #activeDsoId = null;
  static #STORAGE_KEY = 'appCache';


  // Завантажити весь кеш із storage один раз
  async load() {
    this.#activeProvider = await Utils.getProvider();

    try {
      const raw = await Utils.getStorageValue(CacheManager.#STORAGE_KEY);
      this.#mem = raw ? JSON.parse(raw) : {};
    } catch {
      this.#mem = {};
    }
  }

  // Дебаунсований запис у storage (300 мс)
  #scheduleSave() {
    clearTimeout(this.#saveTimer);
    this.#saveTimer = setTimeout(() => {
      Utils.setStorageData({ [CacheManager.#STORAGE_KEY]: JSON.stringify(this.#mem) });
    }, 300);
  }

  // Безпечний доступ до гілки режиму
  #providerObj(provider = this.#activeProvider) {
    return (this.#mem[provider] ??= {});
  }

  #dsoObj(dsoId = this.#activeDsoId) {
    const providerObj = this.#providerObj();
    providerObj.byDso ??= {};
    return (providerObj.byDso[dsoId] ??= {});
  }

  // ── Активний режим (yasno / dtek) ──────────────────────────────────────
  // Викликається один раз при ініціалізації (наприклад, з InputManager),
  // далі всі методи без явного provider (old modeKey) (location/houses/houseData) працюють
  // саме з цією гілкою.
  getActiveProvider() {
    return this.#activeProvider;
  }

  async setActiveProvider(provider) {
    if (!CONSTANTS.PROVIDERS.includes(provider)) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    await Utils.setProvider(provider);
    this.#activeProvider = provider;
  }

  // ── Активний dsoId ───────────────────────────────────────────────────
  // Викликається щоразу, коли користувач змінює ОСР — location/houses/houseData
  // без явного dsoId далі працюють саме з гілкою цього ОСР.
  setActiveDsoId(dsoId) {
    this.#activeDsoId = dsoId;
  }

  getActiveDsoId() {
    return this.#activeDsoId;
  }

  // ── Значення селектів, окремо для кожного режиму ───────────────────────
  getSelect(provider = this.#activeProvider) {
    return this.#providerObj(provider).select ?? {};
  }

  setSelect(provider = this.#activeProvider, patch) {
    const providerObj = this.#providerObj(provider);
    providerObj.select = { ...(providerObj.select ?? {}), ...patch };
    this.#scheduleSave();
  }

  // ── Location-преференції (тільки DTEK, без TTL) ───────────────────────
  getLocation(dsoId = this.#activeDsoId) {
    return this.#dsoObj(dsoId).location ?? {};
  }

  setLocation(patch, dsoId = this.#activeDsoId) {
    const dso = this.#dsoObj(dsoId);
    dso.location = { ...(dso.location ?? {}), ...patch };
    this.#scheduleSave();
  }

  clearLocationFields(...keys) {
    const loc = this.#dsoObj().location;
    if (!loc) return;
    keys.forEach(k => delete loc[k]);
    this.#scheduleSave();
  }

  // ── Список будинків (TTL 24 год) ────────────────────────────────
  getHouses(city, street, dsoId = this.#activeDsoId) {
    const entry = this.#dsoObj(dsoId).houses;
    if (!entry) return null;
    if (JSON.stringify(entry.city) !== JSON.stringify(city) || JSON.stringify(entry.street) !== JSON.stringify(street)) return null;
    if (Date.now() - entry.cachedAt > CONSTANTS.CACHE_TTL.HOUSES) return null;
    return entry;
  }

  setHouses(city, street, data, updateTimestamp, dsoId = this.#activeDsoId) {
    this.#dsoObj(dsoId).houses = { city, street, data, updateTimestamp, cachedAt: Date.now() };
    this.#scheduleSave();
  }

  getHouseData(dsoId = this.#activeDsoId) {
    const entry = this.#dsoObj(dsoId).houseData;
    if (entry?.updateTimestamp == null) return null;
    if (Date.now() - entry.updateTimestamp > CONSTANTS.CACHE_TTL.HOUSE_DATA) return null;
    return entry;
  }

  setHouseData(data, updateTimestamp, dsoId = this.#activeDsoId) {
    this.#dsoObj(dsoId).houseData = { data, updateTimestamp };
    this.#scheduleSave();
  }

  // ── Force-refresh: очищає кешовані дані, зберігає location та select ──
  clearProviderData(provider) {
    const { select, byDso } = this.#providerObj(provider);
    const preservedByDso = {};
    if (byDso) {
      for (const [dsoId, dso] of Object.entries(byDso)) {
        if (dso.location) preservedByDso[dsoId] = { location: dso.location };
      }
    }

    this.#mem[provider] = {
      ...(select ? { select } : {}),
      ...(Object.keys(preservedByDso).length ? { byDso: preservedByDso } : {}),
    };
    this.#scheduleSave();
  }
}
