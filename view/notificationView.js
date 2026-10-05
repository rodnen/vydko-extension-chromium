import { CONSTANTS } from '../config/constants.js';
import { Utils } from '../utils/utils.js';

// ============================================================================
// ВІДОБРАЖЕННЯ СПОВІЩЕНЬ — тільки UI. Ніколи не приймає рішення "надсилати чи ні".
// Реагує на зміни в storage, які робить background (NotificationScheduler).
// ============================================================================
export class NotificationView {
  #countdownIntervalId = null;

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
    if (this.#countdownIntervalId) {
      clearInterval(this.#countdownIntervalId);
      this.#countdownIntervalId = null;
    }
  }

  #pluralize(number, one, two, five) {
    const n = Math.abs(number) % 100;
    const n1 = n % 10;

    if (n > 10 && n < 20) return `${number} ${five}`;
    if (n1 > 1 && n1 < 5) return `${number} ${two}`;
    if (n1 === 1) return `${number} ${one}`;
    return `${number} ${five}`;
  }

  /**
   * Форматує різницю у мс у вигляд:
   * - Якщо 1 параметр → "1 день", "2 години", "1 година", "30 хвилин", "менше 1 хвилини"
   * - Якщо декілька параметрів → "1д. 2г. 30хв."
   */
  #formatCountdown(diffMs) {
    const totalMinutes = Math.max(0, Math.floor(diffMs / 60000));
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;

    const nonZeroCount = [days, hours, minutes].filter(v => v > 0).length;

    if (totalMinutes === 0) {
      return 'менше 1 хвилини';
    }

    if (nonZeroCount === 1) {
      if (days > 0) return this.#pluralize(days, 'день', 'дні', 'днів');
      if (hours > 0) return this.#pluralize(hours, 'година', 'години', 'годин');
      return this.#pluralize(minutes, 'хвилина', 'хвилини', 'хвилин');
    }

    const parts = [];
    if (days > 0) parts.push(`${days}д.`);
    if (hours > 0) parts.push(`${hours}г.`);
    if (minutes > 0) parts.push(`${minutes}хв.`);

    return parts.join(' ');
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
