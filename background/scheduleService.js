import { CONSTANTS } from '../config/constants.js';
import { Utils } from '../utils/utils.js';
import { NotificationScheduler } from '../managers/notificationScheduler.js';
import { AddressService } from './addressService.js';
import { serializeError } from './errorUtils.js';
import { renderYasnoTable } from './renderers/yasnoRenderer.js';
import { renderDtekTable } from './renderers/dtekRenderer.js';
import { YasnoAddressApi } from '../services/api/yasnoAddressApi.js';

export class ScheduleService {
  constructor({ cacheService, addressService, i18n }) {
    this.cache = cacheService;
    this.address = addressService ?? new AddressService(i18n);
    this.i18n = i18n;
  }

  async buildYasnoTable(
    group = 'all',
    regionId = '3',
    dsoId = '301',
    currentDayNumber = new Date().getDate(),
    dayType = 'today'
  ) {
    if (Utils.isInvalidValue(regionId, dsoId)) {
      return {
        success: true,
        html: '',
        status: 'choose',
        updatedOn: null,
        outageDates: []
      };
    }

    const cacheParts = {
      renderVersion: 2,
      group,
      regionId,
      dsoId,
      dayType,
      locale: this.i18n.getLocale()
    };
    const cached = await this.cache.get(cacheParts);
    if (cached) return cached;

    const requestKey = JSON.stringify(['yasno-table', cacheParts]);
    return this.cache.getOrCreateRequest(requestKey, async () => {
      const secondCheck = await this.cache.get(cacheParts);
      if (secondCheck) return secondCheck;

      try {
        const api = new YasnoAddressApi({ regionId, dsoId }, this.i18n);
        const data = await api.getPlannedOutages();
        const result = renderYasnoTable(data, group, currentDayNumber, dayType, this.i18n);

        await this.cache.set(cacheParts, result);
        return result;
      } catch (error) {
        console.error('[BG] Yasno: error', error);
        return { success: false, error: serializeError(error, this.i18n) };
      }
    });
  }

  async buildDtekTable(type = 'dnem', group = 'all', dayType = 'today') {
    if (Utils.isInvalidValue(type)) {
      return {
        success: true,
        html: '',
        status: 'choose',
        updatedOn: null,
        outageDates: []
      };
    }

    try {
      const cacheParts = [
        'table-v2',
        `dtek-${type}`,
        type,
        group,
        dayType,
        this.i18n.getLocale()
      ];
      const cached = await this.cache.get(cacheParts);
      if (cached) return cached;

      const rawData = await this.address.fetchDtekDefaultData(type);
      if (!rawData) return null;

      const rendered = renderDtekTable(rawData, group, dayType, this.i18n);
      const result = {
        success: rawData.success,
        html: rendered?.html ?? '',
        status: rendered?.status ?? null,
        outageDates: rendered?.outageDates ?? [],
        updatedOn: Utils.toIso(rawData.data?.update)
      };

      await this.cache.set(cacheParts, result);
      return result;
    } catch (error) {
      console.error('[DTEK] error:', error);
      return { success: false, error: serializeError(error, this.i18n) };
    }
  }

  async saveScheduleAndReturn(result) {
    if (result?.success && result.outageDates) {
      await NotificationScheduler.saveOutageSchedule(result.outageDates, this.i18n);
    }

    return result;
  }
}

export { CONSTANTS };
