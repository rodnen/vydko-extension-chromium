import { CONSTANTS } from '../config/constants.js';
import { YasnoAddressApi } from '../services/api/yasnoAddressApi.js';
import { DtekAddressApi } from '../services/api/dtekAddressApi.js';
import { serializeError } from './errorUtils.js';

const DEFAULT_PARAMS = {
  dnem: {
    city: 'м. Дніпро',
    street: 'тупик Шкільний'
  },
  kem: {
    city: null,
    street: 'бул. Шевченка Тараса'
  }
};

export class AddressService {
  #dtekApiInstances;

  constructor(i18n) {
    this.i18n = i18n;
    this.#dtekApiInstances = {
      dnem: new DtekAddressApi('dnem', i18n),
      kem: new DtekAddressApi('kem', i18n)
    };
  }

  isYasnoType(type) {
    return type === CONSTANTS.PROVIDER.YASNO;
  }

  getDtekApi(type) {
    const api = this.#dtekApiInstances[type];
    if (!api) {
      throw new Error(this.i18n.get('apiDtekUnknownType', String(type)));
    }
    return api;
  }

  async getCities(params) {
    try {
      const { regionId, dsoId, query } = params;
      const api = new YasnoAddressApi({ regionId, dsoId }, this.i18n);
      const data = await api.getCities(query);
      return { success: true, data };
    } catch (error) {
      console.error('[Address] помилка getCities:', error);
      return { success: false, error: serializeError(error, this.i18n) };
    }
  }

  async getStreets(type, params) {
    try {
      if (this.isYasnoType(type)) {
        const { regionId, dsoId, cityId, query } = params;
        const api = new YasnoAddressApi({ regionId, dsoId }, this.i18n);
        const data = await api.getStreets(cityId, query);
        return { success: true, data };
      }

      const data = await this.getDtekApi(type).getStreets({ city: params.query });
      return { success: true, data };
    } catch (error) {
      console.error('[Address] помилка getStreets:', error);
      return { success: false, error: serializeError(error, this.i18n) };
    }
  }

  async getHouses(type, params) {
    try {
      if (this.isYasnoType(type)) {
        const { regionId, dsoId, cityId, streetId, query } = params;
        const api = new YasnoAddressApi({ regionId, dsoId }, this.i18n);
        const data = await api.getHouses(cityId, streetId, query);
        return { success: true, data };
      }

      const data = await this.getDtekApi(type).getHomeNum(params);
      return { success: true, data };
    } catch (error) {
      console.error('[Address] помилка getHouseNumbers:', error);
      return { success: false, error: serializeError(error, this.i18n) };
    }
  }

  async getHouseData(type, params) {
    try {
      if (this.isYasnoType(type)) {
        const { regionId, dsoId, cityId, streetId, houseId } = params;
        const api = new YasnoAddressApi({ regionId, dsoId }, this.i18n);
        const data = await api.getGroup(cityId, streetId, houseId);
        return { success: true, data };
      }

      const response = await this.getDtekApi(type).getHomeNum(params);
      const data = response.data?.[params.house]
        || response.data?.data?.[params.house]
        || {};

      return {
        success: true,
        data,
        updateTimestamp: response.updateTimestamp
      };
    } catch (error) {
      console.error('[DTEK/Yasno] помилка getHouseData:', error);
      return { success: false, error: serializeError(error, this.i18n) };
    }
  }

  async fetchDtekDefaultData(type) {
    const params = DEFAULT_PARAMS[type];
    const data = await this.getDtekApi(type).getHomeNum(params);
    return { success: true, data: data.fact };
  }
}

export { DEFAULT_PARAMS };
