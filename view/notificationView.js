import { CONSTANTS } from '../config/constants.js';
import { Utils } from '../utils/utils.js';

// ============================================================================
// ВІДОБРАЖЕННЯ СПОВІЩЕНЬ — тільки UI. Ніколи не приймає рішення "надсилати чи ні".
// Реагує на зміни в storage, які робить background (NotificationScheduler).
// ============================================================================
export class NotificationView {
  #countdownIntervalId = null;
  #unsubscribeLocale = null;

  #onStorageChanged = (changes, area) => {
    if (area !== 'local') return;
    if (changes[CONSTANTS.NOTIFICATION_ENABLED_KEY] || changes[CONSTANTS.NOTIFICATION_DATES_KEY]) {
      this.init();
    }
  };

  constructor(dom, i18n) {
    this.dom = dom;
    this.i18n = i18n;
    chrome.storage.onChanged.addListener(this.#onStorageChanged);
    // Одиниці й відмінювання залежать від мови, тож лічильник треба
    // перемалювати одразу після її зміни, а не за хвилину.
    this.#unsubscribeLocale = i18n.onLocaleChange(() => this.init());
  }

  async init() {
    const state = await Utils.getStorageData([
      CONSTANTS.NOTIFICATION_ENABLED_KEY,
      CONSTANTS.NOTIFICATION_DATES_KEY,
    ]);
    this.#render(state);
  }

  /** Викликати при закритті popup, якщо є такий хук — прибирає листенери й таймер. */
  destroy() {
    chrome.storage.onChanged.removeListener(this.#onStorageChanged);
    this.#unsubscribeLocale?.();
    this.#unsubscribeLocale = null;
    if (this.#countdownIntervalId) {
      clearInterval(this.#countdownIntervalId);
      this.#countdownIntervalId = null;
    }
  }

  /** Форматує кількість одиниць часу за правилами поточної мови (Intl). */
  #formatUnit(value, unit, unitDisplay) {
    return new Intl.NumberFormat(this.i18n.getLocale(), {
      style: 'unit',
      unit,
      unitDisplay,
      maximumFractionDigits: 0
    }).format(value);
  }

  /**
   * Форматує різницю у мс залежно від поточної мови:
   * - Якщо 1 параметр → повна форма з правильним відмінюванням
   *   (uk: "1 день", "2 години", "30 хвилин"; en: "1 day", "2 hours", "30 minutes")
   * - Якщо декілька параметрів → коротка (uk: "1 дн. 2 год 30 хв", en: "1 day 2 hr 30 min")
   * - Менше хвилини → локалізований рядок
   */
  #formatCountdown(diffMs) {
    const totalMinutes = Math.max(0, Math.floor(diffMs / 60000));
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;

    if (totalMinutes === 0) {
      return this.i18n.get('countdownLessThanMinute');
    }

    const parts = [
      [days, 'day'],
      [hours, 'hour'],
      [minutes, 'minute']
    ].filter(([value]) => value > 0);

    const display = parts.length === 1 ? 'long' : 'short';

    return parts
      .map(([value, unit]) => this.#formatUnit(value, unit, display))
      .join(' ');
  }

  #createCountdownEl(container) {
    const el = document.createElement('div');
    el.className = 'glass-panel outage-countdown flex-center secondary-text';
    container.insertBefore(el, container.firstChild);
    return el;
  }

  #updateTimerUI(enabled, nextTimestamp) {
    if (this.#countdownIntervalId) {
      clearInterval(this.#countdownIntervalId);
      this.#countdownIntervalId = null;
    }

    const container = this.dom?.header?.querySelector('.app-header-btns');
    if (!container) return;

    const existing = container.querySelector('.outage-countdown');

    if (!enabled || !nextTimestamp) {
      existing?.remove();
      return;
    }

    const el = existing ?? this.#createCountdownEl(container);
    el.textContent = this.#formatCountdown(nextTimestamp - Date.now());

    this.#countdownIntervalId = setInterval(() => {
      const diff = nextTimestamp - Date.now();

      if (diff <= 0) {
        clearInterval(this.#countdownIntervalId);
        this.#countdownIntervalId = null;
        this.init(); // перечитати — можливо, вже є наступна подія в розкладі
        return;
      }

      el.textContent = this.#formatCountdown(diff);
    }, 60000);
  }

  #updateButtonUI(enabled) {
    if (!this.dom?.notificationBtn) return;

    const icon = this.dom.notificationBtn.querySelector('.icon');
    const text = this.dom.notificationBtn.querySelector('span:last-child');

    const map = {
      on: { icon: 'ic_bell_ringing', local: 'enabled', text: this.i18n.get('enabled') },
      off: { icon: 'ic_bell_slash', local: 'disabled', text: this.i18n.get('disabled') }
    };

    const state = map[enabled ? 'on' : 'off'];
    const prevState = map[!enabled ? 'on' : 'off'];

    if (icon) icon.classList.replace(prevState.icon, state.icon);
    if (text) {
      text.textContent = state.text;
      text.dataset.i18n = state.local;
    }
  }


  #render({ [CONSTANTS.NOTIFICATION_ENABLED_KEY]: enabled, [CONSTANTS.NOTIFICATION_DATES_KEY]: schedule = [] }) {
    this.#updateButtonUI(enabled);
    const nextTimestamp = schedule.find(ts => ts > Date.now()) ?? null;
    this.#updateTimerUI(enabled, nextTimestamp);
  }
}
