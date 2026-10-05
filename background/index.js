import { I18n } from '../core/i18n.js';
import { AddressService } from './addressService.js';
import { AlarmController } from './alarmController.js';
import { BackgroundCacheService } from './cacheService.js';
import { MessageRouter } from './messageRouter.js';
import { ScheduleService } from './scheduleService.js';
import { UpdateService } from './updateService.js';

export function createBackgroundServices({ i18n, localizationReady }) {
  const cacheService = new BackgroundCacheService();
  const addressService = new AddressService(i18n);
  const scheduleService = new ScheduleService({
    cacheService,
    addressService,
    i18n
  });
  const updateService = new UpdateService({ i18n });

  return {
    cacheService,
    addressService,
    scheduleService,
    updateService,
    alarmController: new AlarmController({ i18n, localizationReady }),
    messageRouter: new MessageRouter({
      updateService,
      scheduleService,
      addressService,
      cacheService,
      i18n,
      localizationReady
    })
  };
}

export function registerBackgroundServices() {
  const i18n = new I18n();
  const localizationReady = i18n.init();
  localizationReady.catch(error => {
    console.error('[i18n] Failed to initialize background localization', error);
  });

  let localeSync = Promise.resolve();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !('locale' in changes)) return;

    localeSync = localeSync
      .then(() => localizationReady)
      .then(async () => {
        const { locale = 'uk' } = await chrome.storage.local.get('locale');
        if (locale !== i18n.getLocale()) await i18n.setLocale(locale);
      })
      .catch(error => {
        console.error('[i18n] Failed to sync background locale', error);
      });
  });

  const services = createBackgroundServices({ i18n, localizationReady });

  services.alarmController.register();
  services.updateService.registerNotificationHandler();
  services.messageRouter.register();

  return services;
}
