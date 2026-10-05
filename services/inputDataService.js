import { CONSTANTS } from '../config/constants.js';
import { Utils } from '../utils/utils.js';
const { getLabel } = Utils;

export class InputDataService {
  #currentProvider = null;
  #currentRegionId = null;
  #currentDsoId = null;

  constructor(provider, dsoId, regionId, cacheManager) {
    this.#currentProvider = provider;
    this.#currentRegionId = regionId;
    this.#currentDsoId = dsoId;
    this.cache = cacheManager;

    this.citiesCache = null; // { key, promise } — тепер кешується per query
    this.streetsCache = null; // { key, promise }
    this.housesCache = null;  // { key, promise } — для yasno, per query
    this.dtekMapPromise = null;

    this.housesData = {};
    this.updateTimestamp = null;
  }

  get provider() {
    return this.#currentProvider;
  }

  get dsoId() {
    return this.#currentDsoId;
  }

  get regionId() {
    return this.#currentRegionId;
  }

  #parseTimestamp(responseData) {
    const raw = responseData?.updateTimestamp ?? null;
    if (raw == null) return null;
    return typeof raw === 'number' ? raw : Utils.parseToTimestamp(raw);
  }

  // Приводить відповідь бекенда (масив рядків / масив об'єктів / об'єкт-мапу)
  // до плаского масиву назв. Формат реальної відповіді DTEK на getCities/getStreets
  // не підтверджений прикладом — тому обробляємо кілька ймовірних варіантів.
  #normalizeNameList(data) {
    const list = Array.isArray(data) ? data : Object.values(data ?? {});
    return list
      .map(item => {
        if (typeof item === 'string') return item;
        return item?.name ?? item?.title ?? item?.value ?? null;
      })
      .filter(Boolean);
  }

  #normalizeApostrophes(str) {
    return str.replace(/[''′´`]/g, '’');
  }

  async search(type, query, state) {
    const lowerQuery = this.#normalizeApostrophes(query.toLowerCase());
    switch (type) {
      case 'city': {
        const cities = await this.#loadCities(lowerQuery);
        return cities
          .filter(item => getLabel(item).toLowerCase().includes(lowerQuery))
          .slice(0, 20);
      }

      case 'street': {
        const streets = await this.#loadStreets(lowerQuery, state.city);
        return streets
          .filter(item => getLabel(item).toLowerCase().includes(lowerQuery))
          .slice(0, 20);
      }

      case 'house': {
        if (this.#currentProvider === CONSTANTS.PROVIDER.YASNO) {
          if (!query.trim()) {
            return Array.isArray(this.housesData) ? this.housesData.slice(0, 20) : [];
          }

          const city = state?.city ?? this.currentCity;
          const street = state?.street ?? this.currentStreet;
          const houses = await this.#loadYasnoHouses(query.trim(), city, street);

          return houses.slice(0, 20);
        }

        const entries = Array.isArray(this.housesData)
          ? this.housesData
          : Object.keys(this.housesData);

        return entries
          .filter(entry => getLabel(entry).toLowerCase().includes(lowerQuery))
          .slice(0, 20);
      }
    }
  }

  async #loadCities(query) {
    const cacheKey = query;

    if (this.citiesCache?.key === cacheKey) {
      return this.citiesCache.promise;
    }

    const promise = (async () => {
      if (this.#currentProvider === CONSTANTS.PROVIDER.YASNO) {
        const response = await chrome.runtime.sendMessage({
          action: 'fetchCity',
          type: CONSTANTS.PROVIDER.YASNO,
          params: {
            regionId: this.#currentRegionId,
            dsoId: this.#currentDsoId,
            query
          }
        });

        if (!response?.success || !response.data) {
          console.error('[InputDataService.#loadCities] Failed:', response?.error);
          this.citiesCache = null;
          return [];
        }

        return response.data;
      }

      // DTEK: query тут ігнорується навмисно — фільтрація по назві міста
      // відбувається пізніше, у search(). Тут беремо лише ключі мапи.
      const map = await this.#loadDtekCityStreetMap();
      return Object.keys(map);
    })();

    this.citiesCache = { key: cacheKey, promise };
    return promise;
  }

  async #loadStreets(query, city) {
    const isYasno = this.#currentProvider === CONSTANTS.PROVIDER.YASNO;

    if (isYasno) {
      const cityId = city?.id ?? null;
      const cacheKey = `${cityId}:${query}`;

      if (this.streetsCache?.key === cacheKey) {
        return this.streetsCache.promise;
      }

      const promise = (async () => {
        const response = await chrome.runtime.sendMessage({
          action: 'fetchStreet',
          type: CONSTANTS.PROVIDER.YASNO,
          params: {
            regionId: this.#currentRegionId,
            dsoId: this.#currentDsoId,
            cityId,
            query
          }
        });

        if (!response?.success || !response.data) {
          console.error('[InputDataService.#loadStreets] Failed:', response?.error);
          this.streetsCache = null;
          return [];
        }

        return response.data;
      })();

      this.streetsCache = { key: cacheKey, promise };
      return promise;
    }

    const map = await this.#loadDtekCityStreetMap();
    const cityLabel = getLabel(city);
    return this.#normalizeNameList(map[cityLabel] ?? map ?? []);
  }

  async #loadDtekCityStreetMap() {
    if (this.dtekMapPromise) return this.dtekMapPromise;

    this.dtekMapPromise = (async () => {
      const response = await chrome.runtime.sendMessage({
        action: 'fetchStreet',
        type: Utils.DSOID_TO_DTEK_TYPE[this.dsoId],
        params: {}
      });

      if (!response?.success || !response.data) {
        console.error('[InputDataService.#loadDtekCityStreetMap] Failed:', response?.error);
        this.dtekMapPromise = null; // дозволяємо повторну спробу пізніше
        return {};
      }

      return response.data?.streets ?? response.data ?? {};
    })();

    return this.dtekMapPromise;
  }

  async #loadYasnoHouses(query, city, street) {
    const cityId = city?.id ?? null;
    const streetId = street?.id ?? null;

    if (this.dsoId !== CONSTANTS.KEM_DSO_ID[CONSTANTS.PROVIDER.YASNO])
      if (cityId == null || streetId == null) return [];

    const cacheKey = `${cityId}:${streetId}:${query.toLowerCase()}`;

    if (this.housesCache?.key === cacheKey) {
      return this.housesCache.promise;
    }

    const promise = (async () => {
      const response = await chrome.runtime.sendMessage({
        action: 'fetchHouses',
        type: CONSTANTS.PROVIDER.YASNO,
        params: {
          regionId: this.#currentRegionId,
          dsoId: this.#currentDsoId,
          cityId,
          streetId,
          query
        }
      });

      if (!response?.success || !response.data) {
        console.error('[InputDataService.#loadYasnoHouses] Failed:', response?.error);
        if (this.housesCache?.key === cacheKey) this.housesCache = null;
        return [];
      }

      const data = response.data.data || response.data;
      return Array.isArray(data) ? data : [];
    })();

    this.housesCache = { key: cacheKey, promise };
    return promise;
  }

  async #loadDtekHouses(city, street) {
    const cached = this.cache.getHouses(city, street);

    if (cached) {
      this.housesData = cached.data;
      this.updateTimestamp = cached.updateTimestamp;
      return;
    }

    await this.fetchHouses(city, street);
  }

  // loadHousesForStreet — додати запам'ятовування контексту (city/street),
  // потрібне пізніше для запиту group (Yasno):
  async loadHousesForStreet(city, street, house = null) {
    this.currentCity = city;
    this.currentStreet = street;
    this.housesCache = null;

    if (!street) {
      this.housesData = {};
      return;
    }

    if (this.#currentProvider === CONSTANTS.PROVIDER.YASNO) {
      await this.fetchHouses(city, street);
      return;
    }

    await this.#loadDtekHouses(city, street);

    if (house) {
      await this.refreshHouseStatusIfNeeded(this.dsoId, city, street, house);
    }
  }

  async fetchHouses(city, street) {
    const isYasno = this.#currentProvider === CONSTANTS.PROVIDER.YASNO;

    const params = isYasno
      ? {
        regionId: this.#currentRegionId,
        dsoId: this.#currentDsoId,
        cityId: city?.id,
        streetId: street?.id,
        query: ''
      }
      : { city, street };

    const response = await chrome.runtime.sendMessage({
      action: 'fetchHouses',
      type: isYasno ? CONSTANTS.PROVIDER.YASNO : Utils.DSOID_TO_DTEK_TYPE[this.dsoId],
      params
    });

    if (response.success && response.data) {
      const data = response.data.data || response.data || {};
      const updateTimestamp = this.#parseTimestamp(response.data) ?? this.#parseTimestamp(response);

      // DTEK: об'єкт { "12": {...} }. Yasno: масив { id, house } —
      // лишаємо як є в обох випадках, без normalizeNameList.
      this.housesData = data;
      this.updateTimestamp = updateTimestamp;

      this.cache.setHouses(city, street, data, updateTimestamp);
    } else {
      console.error('[InputDataService.fetchHouses] Failed:', response.error);
    }
  }

  async refreshHouseStatusIfNeeded(dsoId, city, street, house) {
    if (!house) return;

    const cached = this.cache.getHouseData();
    if (cached) {
      return;
    }

    const response = await chrome.runtime.sendMessage({
      action: 'fetchHouseData',
      type: Utils.DSOID_TO_DTEK_TYPE[dsoId],
      params: { city, street, house }
    });

    const data = response.data;
    const timestamp = this.#parseTimestamp(response);

    if (response.success && data) {
      this.housesData = data
      this.updateTimestamp = timestamp;
      this.cache.setHouseData(data, timestamp);
    }
  }

  async isValidCity(city) {
    if (!city) return false;
    if (this.#currentProvider === CONSTANTS.PROVIDER.DTEK && Utils.DSOID_TO_DTEK_TYPE[this.dsoId] === 'kem') return false; // 'kem' не має міст

    const label = getLabel(city);
    if (!label) return false;

    const cities = await this.#loadCities(label);
    return cities.some(item => getLabel(item).toLowerCase() === label.toLowerCase());
  }

  async isValidStreet(city, street) {
    if (!street) return false;
    if (this.#currentProvider === CONSTANTS.PROVIDER.YASNO && !city) return false;
    if (this.#currentProvider === CONSTANTS.PROVIDER.DTEK && Utils.DSOID_TO_DTEK_TYPE[this.dsoId] === 'dnem' && !city) return false;

    const label = getLabel(street);
    if (!label) return false;

    const streets = await this.#loadStreets(label, city);
    return streets.some(item => getLabel(item).toLowerCase() === label.toLowerCase());
  }

  // getHouseData — тепер async. Для 'yasno' дані по будинку (group/subgroup)
  // не приходять разом зі списком будинків, а запитуються окремо через
  // fetchHouseData. Для DTEK лишилась стара локальна логіка.
  async getHouseData(house) {
    const label = getLabel(house);
    if (!label) return null;

    if (this.#currentProvider === CONSTANTS.PROVIDER.YASNO) {
      const houseId = house?.id ?? null;
      if (houseId == null) return null;

      const response = await chrome.runtime.sendMessage({
        action: 'fetchHouseData',
        type: CONSTANTS.PROVIDER.YASNO,
        params: {
          regionId: this.#currentRegionId,
          dsoId: this.#currentDsoId,
          cityId: this.currentCity?.id ?? null,
          streetId: this.currentStreet?.id ?? null,
          houseId
        }
      });

      if (!response?.success || !response.data) {
        console.error('[InputDataService.getHouseData] Failed:', response?.error);
        return null;
      }

      // Очікуваний формат: { group, subgroup }
      return response.data;
    }

    if (Array.isArray(this.housesData)) {
      return this.housesData.find(entry => getLabel(entry) === label) ?? null;
    }

    return this.housesData[label] ?? null;
  }

  getUpdateTimestamp() {
    return this.updateTimestamp;
  }

  clearHouses() {
    this.housesData = {};
    // Не видаляємо з кешу — кеш очиститься автоматично по TTL
    // або при виборі іншої вулиці (getHouses перевіряє city+street)
  }
}
