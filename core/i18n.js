export class I18n {

  #locale = null;
  #messages = {};
  #cache = new Map();
  #monthFormatter = null;
  #localeListeners = new Set();

  #yearSuffixes = {
    uk: 'р.',
  };

  async init() {
    if (this.#locale) return;

    const { locale } = await chrome.storage.local.get('locale');
    this.#locale = locale ?? 'uk';
    await this.#load(this.#locale);
    this.#updateFormatters();
  }

  #updateFormatters() {
    this.#monthFormatter = new Intl.DateTimeFormat(this.#locale, {
      month: 'short'
    });
  }

  #emitLocaleChange() {
    for (const callback of this.#localeListeners) {
      callback(this.#locale);
    }
  }

  async #load(locale) {
    if (this.#cache.has(locale)) {
      this.#messages = this.#cache.get(locale);
      return;
    }

    const url = chrome.runtime.getURL(
      `_locales/${locale}/messages.json`
    );

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to load locale: ${locale}`);
    }

    const messages = await response.json();

    this.#cache.set(locale, messages);
    this.#messages = messages;
  }

  onLocaleChange(callback) {
    this.#localeListeners.add(callback);

    return () => {
      this.#localeListeners.delete(callback);
    };
  }

  get(key, substitutions = []) {
    const message = this.#messages[key]?.message ?? key;
    const values = Array.isArray(substitutions) ? substitutions : [substitutions];

    return values.reduce(
      (text, value, index) => text.replaceAll(`$${index + 1}`, () => String(value)),
      message
    );
  }

  getMonthShort(month) {
    if (!month) return null;

    return this.#monthFormatter.format(
      new Date(2000, month, 1)
    );
  }

  formatDate(date) {
    if (!date) return null;

    return new Intl.DateTimeFormat(this.#locale, {
      day: 'numeric',
      month: 'short'
    }).format(date);
  }

  formatDateOnly(date) {
    if (!date) return null;

    const d = new Date(date);

    const formatter = new Intl.DateTimeFormat(this.#locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    const parts = formatter.formatToParts(d);
    const get = (type) => parts.find(p => p.type === type)?.value ?? '';

    const day = get('day');
    const month = get('month');
    const year = get('year');

    const yearSuffix = this.#yearSuffixes[this.#locale] ?? '';

    return `${day} ${month} ${year} ${yearSuffix}`;
  }

  formatFullDateTime(value) {
    if (value == null || value === '') return '—';

    let date;
    if (value instanceof Date || typeof value === 'number') {
      date = new Date(value);
    } else if (typeof value === 'string') {
      const match = value.trim().match(
        /^(\d{2}):(\d{2})\s+(\d{2})\.(\d{2})\.(\d{4})$/
      );

      if (match) {
        const [, hour, minute, day, month, year] = match.map(Number);
        date = new Date(0);
        date.setFullYear(year, month - 1, day);
        date.setHours(hour, minute, 0, 0);

        if (
          date.getFullYear() !== year ||
          date.getMonth() !== month - 1 ||
          date.getDate() !== day ||
          date.getHours() !== hour ||
          date.getMinutes() !== minute
        ) {
          return '—';
        }
      } else {
        date = new Date(value);
      }
    } else {
      return '—';
    }

    if (!Number.isFinite(date.getTime())) return '—';

    const formatter = new Intl.DateTimeFormat(this.#locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const parts = formatter.formatToParts(date);
    const get = (type) => parts.find(p => p.type === type)?.value ?? '';

    const day = get('day');
    const month = get('month');
    const year = get('year');
    const hour = get('hour');
    const minute = get('minute');

    const yearSuffix = this.#yearSuffixes[this.#locale] ?? '';

    return `${hour}:${minute} ${day} ${month} ${year} ${yearSuffix}`;
  }

  /**
   * Форматує дату у вигляді "HH:MM день місяць рік"
   * Наприклад: "12:41 4 бер. 2026 р."
   *
   * @param {Date|string|number} date - дата для форматування
   * @returns {string} - відформатований рядок
   */
  formatFullDate(date) {
    if (!date) return '—';

    const formatted = new Intl.DateTimeFormat(this.#locale, {
      hour: '2-digit',
      minute: '2-digit',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(new Date(date));

    return formatted;
  }

  formatBytes(bytes, decimals = 2) {
    if (!Number.isFinite(bytes) || bytes < 0) return '';

    const isUkrainian = this.#locale.startsWith('uk');

    const units = isUkrainian
      ? ['Б', 'Кб', 'Мб', 'Гб', 'Тб']
      : ['B', 'Kb', 'Mb', 'Gb', 'Tb'];

    const index = bytes === 0
      ? 0
      : Math.min(
        Math.floor(Math.log(bytes) / Math.log(1024)),
        units.length - 1
      );

    const value = bytes / (1024 ** index);

    const formatted = new Intl.NumberFormat(this.#locale, {
      maximumFractionDigits: index === 0 ? 0 : decimals
    }).format(value);

    return `${formatted} ${units[index]} `;
  }

  formatUpdatedOn(updatedOn) {
    if (!updatedOn) return null;

    const date = new Date(updatedOn);
    const now = new Date();

    const time = date.toLocaleTimeString(this.#locale, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC'
    });

    const isSameDay = (a, b) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();

    if (isSameDay(date, now)) {
      return { text: `${this.get('updatedAt')} `, time: time };
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    if (isSameDay(date, yesterday)) {
      return { text: `${this.get('updatedYesterdayAt')} `, time: time };
    }

    const day = date.getDate();
    const month = this.getMonthShort(date.getMonth());

    return { text: `${this.get('updatedAt')} `, time: `${day} ${month} ${time} ` };
  }

  async setLocale(locale) {
    if (locale === this.#locale) {
      return;
    }

    await this.#load(locale);

    this.#locale = locale;

    await chrome.storage.local.set({
      locale
    });

    this.#updateFormatters();
    this.#emitLocaleChange();
  }

  getLocale() {
    return this.#locale;
  }

  localize(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(element => {
      const message = this.get(element.dataset.i18n);

      if (message) {
        element.textContent = message;
      }
    });

    root.querySelectorAll('[data-i18n-title]').forEach(element => {
      const message = this.get(element.dataset.i18nTitle);

      if (message) {
        element.title = message;
      }
    });
  }
}
