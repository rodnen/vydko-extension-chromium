import { CONSTANTS } from '../config/constants.js';
import { NotificationScheduler } from '../managers/notificationScheduler.js';
import { Utils } from '../utils/utils.js';

const ALARM_NAME = 'checkOutageNotifications';

export class AlarmController {
  constructor({ i18n, localizationReady = Promise.resolve() }) {
    this.i18n = i18n;
    this.localizationReady = localizationReady;
  }

  async isNotificationsEnabled() {
    const { [CONSTANTS.NOTIFICATION_ENABLED_KEY]: enabled } =
      await Utils.getStorageData([CONSTANTS.NOTIFICATION_ENABLED_KEY]);

    return !!enabled;
  }

  async syncAlarmState() {
    const enabled = await this.isNotificationsEnabled();

    if (enabled) {
      await chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
      console.log('[Notifications] Alarm started');
    } else {
      const cleared = await chrome.alarms.clear(ALARM_NAME);
      if (cleared) console.log('[Notifications] Alarm stopped');
    }
  }

  async runAlarmSync(context) {
    try {
      await this.localizationReady;
      await this.syncAlarmState();
    } catch (error) {
      console.error(`[Notifications] Failed to sync alarm on ${context}`, error);
    }
  }

  register() {
    chrome.runtime.onInstalled.addListener(async details => {
      await this.runAlarmSync('install');

      if (details.reason === 'install') {
        await chrome.storage.sync.set({ installDate: Date.now() });
      }
    });

    chrome.runtime.onStartup.addListener(() => {
      this.runAlarmSync('startup');
    });

    chrome.alarms.onAlarm.addListener(alarm => {
      if (alarm.name !== ALARM_NAME) return;

      this.localizationReady
        .then(() => NotificationScheduler.checkUpcoming(this.i18n))
        .catch(error => {
          console.error('[Notifications] Failed to check upcoming outages', error);
        });
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;

      if (CONSTANTS.NOTIFICATION_ENABLED_KEY in changes) {
        this.runAlarmSync('settings change');
        return;
      }

      const relevant = [
        CONSTANTS.NOTIFICATION_DELAY_KEY,
        CONSTANTS.NOTIFICATION_FREQUENCY_KEY
      ];

      if (relevant.some(key => key in changes)) {
        this.localizationReady
          .then(() => NotificationScheduler.checkUpcoming(this.i18n))
          .catch(error => {
            console.error('[Notifications] Failed to check upcoming outages', error);
          });
      }
    });
  }
}

export { ALARM_NAME };
