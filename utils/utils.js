import { CONSTANTS } from "../config/constants.js";
const INVALID_VALUES = new Set([undefined, null, '', 'none']);

/**
 * Утилітарний клас для роботи з Chrome API та загальними функціями
 */
class Utils {
  /**
   * Надсилає повідомлення через chrome.runtime.sendMessage
   * @param {Object} message - повідомлення для відправки
   * @returns {Promise<any>} - відповідь
   */
  static sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, response => {
        if (chrome.runtime.lastError) {
          const error = new Error(chrome.runtime.lastError.message);
          console.error('sendMessage:', error.message);
          reject(error);
          return;
        }
        resolve(response);
      });
    });
  }

  /**
   * Парсить рядок дати у timestamp
   * @param {string} str - рядок у форматі "HH:MM DD.MM.YYYY"
   * @returns {number} - timestamp у мілісекундах
   */
  static parseToTimestamp(str) {
    const [time, date] = str.split(' ');

    const [hours, minutes] = time.split(':').map(Number);
    const [day, month, year] = date.split('.').map(Number);

    const d = new Date(year, month - 1, day, hours, minutes);

    return d.getTime();
  }

  /* ---------- утиліти часу ---------- */
  static minutesToTime(min) {
    if (min === 1440) return '00:00';
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  // Конвертує хвилини доби (0-1439) + unix-timestamp дня (сек) у Date
  static minutesToDate(baseTimestampSec, minutes) {
    return new Date((baseTimestampSec + minutes * 60) * 1000);
  }

  /**
   * Отримує дані з chrome.storage.local
   * @param {string|string[]} keys - ключ або масив ключів
   * @returns {Promise<Object>} - об'єкт з даними
   */
  static getStorageData(keys) {
    return chrome.storage.local.get(keys);
  }

  /**
   * Отримує значення за конкретним ключем
   * @param {string} key - ключ
   * @returns {Promise<any>} - значення
   */
  static async getStorageValue(key) {
    const result = await chrome.storage.local.get(key);
    return result[key];
  }

  /**
   * Зберігає дані у chrome.storage.local
   * @param {Object} data - об'єкт з даними для збереження
   * @returns {Promise<void>}
   */
  static setStorageData(data) {
    return chrome.storage.local.set(data);
  }

  /**
   * Видаляє дані з chrome.storage.local
   * @param {string|string[]} key - ключ або масив ключів
   * @returns {Promise<void>}
   */
  static removeStorageData(key) {
    return chrome.storage.local.remove(key);
  }

  /**
   * Створює затримку на вказаний час
   * @param {number} ms - мілісекунди
   * @returns {Promise<void>}
   */
  static delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static shortenId(id, startLen = 5, endLen = 5) {
    if (!id || id.length <= startLen + endLen) return id;
    return `${id.slice(0, startLen)}...${id.slice(-endLen)}`;
  }

  static DSOID_TO_DTEK_TYPE = {
    'none': 'none', //Не обрано
    301: 'dnem',    // ДНЕМ
    303: 'сek',     // ЦЕК
    902: 'kem',     // КЕМ
  };

  static setErrorTextarea(el) {
    el.closest('.custom-textarea')?.classList.add('input-error');
  }

  static clearErrorTextarea(el) {
    el.closest('.custom-textarea')?.classList.remove('input-error');
  }

  /**
   * Генерує HTML для відображення помилки завантаження
   * @returns {string} - HTML рядок
   */
  static buildLoadErrorHTML(i18n, error = {}) {
    return `
          <p class="message p-8" data-i18n="loadErrorTitle">${i18n.get('loadErrorTitle')}</p>

          ${error?.message
        ? `<p class="message p-8 secondary-text"><span data-i18n="loadErrorReason">${i18n.get('loadErrorReason')}</span>: ${error.message}</p>`
        : ''}

          ${error?.url
        ? `<a href="${error.url}" target="_blank" rel="noopener noreferrer" class="message p-8 secondary-text" data-i18n="loadErrorOpenSite">${i18n.get('loadErrorOpenSite')}</a>`
        : ''}

          <br>

          <p class="message p-8 secondary-text" data-i18n="loadErrorConnectionHelp">${i18n.get('loadErrorConnectionHelp')}</p>
          <p class="message p-8 secondary-text">
              <span data-i18n="loadErrorCacheBefore">${i18n.get('loadErrorCacheBefore')}</span>
              <b data-i18n="loadErrorClearCache">${i18n.get('loadErrorClearCache')}</b>
              <span data-i18n="loadErrorCacheAfter">${i18n.get('loadErrorCacheAfter')}</span>
          </p>
      `;
  }

  static buildStatusIndicatorHTML(i18n, type) {
    const config = {
      ok: { titleKey: 'outages', statusKey: 'notApplicable' },
      warning: { title: '⏳', statusKey: 'statusBadgeWarning' },
      danger: { title: '🚨', statusKey: 'statusBadgeDanger' },
      info: { title: '⏳', statusKey: 'statusBadgeInfo' },
      choose: { title: '👆', statusKey: 'statusBadgeChoose' }
    };

    const { titleKey, title, statusKey } = config[type] ?? {};

    const titleText = titleKey ? i18n.get(titleKey) : (title ?? '');
    const statusText = statusKey ? i18n.get(statusKey) : '';

    return `
          <div class="status-indicator flex-center flex-col">
              <div class="status-title ${type}"${titleKey ? ` data-i18n="${titleKey}"` : ''}>${titleText}</div>
              <div class="status-badge ${type}"${statusKey ? ` data-i18n="${statusKey}"` : ''}>
                  ${statusText}
              </div>
          </div>
      `;
  }

  /**
 * Повертає розмір даних у chrome.storage.local.
 * @param {string|string[]|null} keys null - усі ключі
 * @returns {Promise<{bytes:number, formatted:string}>}
 */
  static async getStorageSize(keys = null) {
    const bytes = await chrome.storage.local.getBytesInUse(keys);

    return { bytes };
  }

  /**
  * Форматує байти у найближчу одиницю.
  * @param {number} bytes
  * @param {number} decimals
  * @returns {string}
  */
  static formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Б';

    const units = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];
    const index = Math.min(
      Math.floor(Math.log(bytes) / Math.log(1024)),
      units.length - 1
    );

    const value = bytes / Math.pow(1024, index);

    return `${value.toFixed(index === 0 ? 0 : decimals)} ${units[index]}`;
  }

  static toIso(str) {
    if (typeof str !== 'string' || !str.trim()) {
      return null;
    }

    const match = str.trim().match(
      /^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/
    );

    if (!match) {
      return null;
    }

    const [, day, month, year, hours, minutes] = match;

    const date = new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hours),
        Number(minutes)
      )
    );

    if (
      date.getUTCFullYear() !== Number(year) ||
      date.getUTCMonth() !== Number(month) - 1 ||
      date.getUTCDate() !== Number(day) ||
      date.getUTCHours() !== Number(hours) ||
      date.getUTCMinutes() !== Number(minutes)
    ) {
      return null;
    }

    return `${year}-${month}-${day}T${hours}:${minutes}:00+00:00`;
  }

  static semverCompare(a, b) {
    if (!a || !b) return undefined;
    if (a === b) return 0;
    const clean = v => v.replace(/^[^0-9]*/, '').split('.').map(Number);
    const [va, vb] = [clean(a), clean(b)];
    for (let i = 0; i < 3; i++) {
      if (va[i] > vb[i]) return 1;
      if (va[i] < vb[i]) return -1;
    }
    return 0;
  }

  static async getInstallDate() {
    const { installDate } = await chrome.storage.sync.get('installDate');
    return installDate ? installDate : undefined;
  }

  static async copyStaticText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.error("Error: ", err);
      return false;
    }
  }

  static async getLocale() {
    const { locale } = await this.getStorageData(['locale']);
    return { locale }
  }

  static async getProvider() {
    const provider = await this.getStorageValue('provider');
    return CONSTANTS.PROVIDERS.includes(provider)
      ? provider
      : CONSTANTS.PROVIDERS[0];
  }

  static setProvider(provider) {
    if (!CONSTANTS.PROVIDERS.includes(provider)) {
      throw new Error(`Unknown provider: ${provider}`);
    }
    return this.setStorageData({ provider });
  }

  static isInvalidValue = (...values) => values.some(value => INVALID_VALUES.has(value));

  static getLabel(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    return String(value.city ?? value.street ?? value.house ?? value.name ?? value.value ?? '');
  }
}

// Експорт для використання як модуль
export { Utils };

// Також експортуємо за замовчуванням для зручності
export default Utils;
