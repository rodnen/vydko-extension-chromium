import { CONSTANTS } from '../config/constants.js';
import { Utils } from '../utils/utils.js';

// ============================================================================
// ПЛАНУВАЛЬНИК СПОВІЩЕНЬ — єдине джерело, звідки надсилаються сповіщення.
// Живе тільки в background/service worker. Popup його НЕ імпортує.
// ============================================================================
export class NotificationScheduler {
  /**
   * Рахує моменти (у хв "до події"), коли треба сповіщати.
   * Приклад: delay=30, frequency=15 -> [30, 15, 0]
   */
  static #buildScheduleSteps(delayMinutes, frequencyMinutes) {
    const delay = Number(delayMinutes) || 0;
    const freq = Math.max(Number(frequencyMinutes) || 1, 1);

    const steps = [];
    for (let t = delay; t > 0; t -= freq) {
      steps.push(t);
    }
    steps.push(0); // сповіщення в момент самої події
    return steps;
  }

  /**
   * Викликається періодично з chrome.alarms.onAlarm.
   * Сам знаходить найближчу подію в розкладі й перевіряє її.
   */
  static async checkUpcoming(i18n) {
    const nextTimestamp = await this.#getNextTimestamp();
    if (!nextTimestamp) return;
    await this.checkAndNotify(String(nextTimestamp), nextTimestamp, null, i18n);
  }

  /**
   * Головна перевірка.
   * prefetchedSettings — якщо ENABLED/DELAY/FREQUENCY вже на руках, щоб не робити зайвий похід у storage.
   */
  static async checkAndNotify(eventKey, eventTimestamp, prefetchedSettings = null, i18n) {
    const settings = prefetchedSettings ?? await Utils.getStorageData([
      CONSTANTS.NOTIFICATION_ENABLED_KEY,
      CONSTANTS.NOTIFICATION_DELAY_KEY,
      CONSTANTS.NOTIFICATION_FREQUENCY_KEY,
    ]);

    if (!settings[CONSTANTS.NOTIFICATION_ENABLED_KEY]) return;

    const delayMinutes = settings[CONSTANTS.NOTIFICATION_DELAY_KEY];
    const frequencyMinutes = settings[CONSTANTS.NOTIFICATION_FREQUENCY_KEY];
    const steps = this.#buildScheduleSteps(delayMinutes, frequencyMinutes);

    const {
      [CONSTANTS.NOTIFICATION_STATE_KEY]: savedState
    } = await Utils.getStorageData([
      CONSTANTS.NOTIFICATION_STATE_KEY
    ]);

    let state = savedState || {};

    if (state.eventKey !== eventKey) {
      state = {
        eventKey,
        sentCount: 0,
        lastSentAt: 0,
        lastCheckedAt: 0
      };
    }

    if (state.sentCount >= steps.length) {
      state.lastCheckedAt = Date.now();
      await Utils.setStorageData({ [CONSTANTS.NOTIFICATION_STATE_KEY]: state });
      return;
    }

    const now = Date.now();
    const minutesLeft = (eventTimestamp - now) / 60000;

    let dueStepIndex = -1;
    for (let i = state.sentCount; i < steps.length; i++) {
      const stepTimestamp = eventTimestamp - steps[i] * 60000;
      if (now >= stepTimestamp) {
        dueStepIndex = i;
      } else {
        break;
      }
    }

    const shouldNotify = dueStepIndex !== -1;

    if (shouldNotify) {

      const actualMinutesLeft = Math.max(0, Math.ceil(minutesLeft));

      this.#fireNotification(
        eventTimestamp,
        actualMinutesLeft,
        i18n
      );

      state.sentCount = dueStepIndex + 1;
      state.lastSentAt = now;
    }

    state.lastCheckedAt = now;

    await Utils.setStorageData({
      [CONSTANTS.NOTIFICATION_STATE_KEY]: state
    });
  }

  /**
   * Зберігає новий розклад відключень і одразу перевіряє,
   * чи не треба сповістити негайно (напр. якщо найближча подія вже дуже скоро).
   */
  static async saveOutageSchedule(outageDates, i18n) {
    if (!outageDates) return;

    const timestamps = [...new Set(
      outageDates.map(d => (d instanceof Date ? d.getTime() : Number(d)))
    )]
      .filter(ts => ts > Date.now())
      .sort((a, b) => a - b);

    await Utils.setStorageData({
      [CONSTANTS.NOTIFICATION_DATES_KEY]: timestamps
    });

    await this.checkUpcoming(i18n);
  }

  static async #getNextTimestamp() {
    const { [CONSTANTS.NOTIFICATION_DATES_KEY]: schedule = [] } =
      await Utils.getStorageData([CONSTANTS.NOTIFICATION_DATES_KEY]);

    const now = Date.now();
    return schedule.find(ts => ts > now) ?? null;
  }

  static #fireNotification(eventTimestamp, actualMinutesLeft, i18n) {
    const title = actualMinutesLeft > 0
      ? i18n.get('notificationOutageSoonTitle', String(actualMinutesLeft))
      : i18n.get('notificationOutageNowTitle');

    const time = new Date(eventTimestamp).toLocaleTimeString(i18n.getLocale(), {
      hour: '2-digit',
      minute: '2-digit'
    });

    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title,
      message: i18n.get('notificationOutageTime', time),
      priority: 1
    });
  }
}
