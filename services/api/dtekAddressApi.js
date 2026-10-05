import { CONSTANTS } from '../../config/constants.js';

/**
 * Клас для роботи з DTEK API (сайти dnem / kem).
 *
 * Приклад використання:
 *
 *   const dnem = new DtekAddressApi('dnem', i18n);
 *   const streets = await dnem.getStreets({ city: 'Дніпро' });
 *   const houses = await dnem.getHomeNum({ city: 'Дніпро', street: 'Хрещатик' });
 *
 *   const kem = new DtekAddressApi('kem', i18n);
 *   const streetsKem = await kem.getStreets();
 *   const housesKem = await kem.getHomeNum({ street: 'Хрещатик' });
 */

const URLS_BY_TYPE = {
  dnem: {
    origin: CONSTANTS.DTEK_DNEM_ORIGIN_URL,
    referer: CONSTANTS.DTEK_DNEM_SHUTDOWN_URL,
    ajax: CONSTANTS.DTEK_DNEM_AJAX_URL,
  },
  kem: {
    origin: CONSTANTS.DTEK_KEM_ORIGIN_URL,
    referer: CONSTANTS.DTEK_KEM_SHUTDOWN_URL,
    ajax: CONSTANTS.DTEK_KEM_AJAX_URL,
  },
};

export class DtekAddressApi {
  /**
   * @param {'dnem' | 'kem'} type - Тип сайту ДТЕК
   * @param {I18n} i18n - локалізатор з вибраною користувачем мовою
   */
  constructor(type, i18n) {
    if (!URLS_BY_TYPE[type]) {
      throw new Error(i18n.get('apiDtekUnknownType', String(type)));
    }
    this.type = type;
    this.urls = URLS_BY_TYPE[type];
    this.i18n = i18n;
  }

  /** Отримати CSRF-токен та csrf-параметр з головної сторінки. */
  async fetchCsrf() {
    const { referer: refererPage } = this.urls;

    try {
      const pageResponse = await fetch(refererPage, {
        method: 'GET',
        credentials: 'include',
      });

      if (!pageResponse.ok) {
        throw {
          message: this.i18n.get('apiDtekPageLoadError'),
          url: refererPage,
        };
      }

      const html = await pageResponse.text();
      const csrfToken = html.match(/<meta name="csrf-token" content="(.*?)">/)?.[1];
      const csrfParam = html.match(/<meta name="csrf-param" content="(.*?)">/)?.[1] || '_csrf';

      if (!csrfToken) {
        throw {
          message: this.i18n.get('apiDtekCsrfMissing'),
          url: refererPage,
        };
      }
      return { csrfToken, csrfParam };
    }
    catch (e) {
      throw {
        message: e.message,
        url: refererPage,
      };
    }
  }

  /** Побудувати form-data у форматі, який очікує DTEK ajax-ендпоінт. */
  buildFormData({ method, fields, csrfParam, csrfToken }) {
    const params = { [csrfParam]: csrfToken, method };
    fields.forEach((field, i) => {
      params[`data[${i}][name]`] = field.name;
      params[`data[${i}][value]`] = field.value;
    });
    return new URLSearchParams(params);
  }

  /** Виконати POST-запит до ajax-ендпоінта DTEK. */
  async request(method, fields) {
    const { origin: originPage, referer: refererPage, ajax: ajaxPage } = this.urls;
    const { csrfToken, csrfParam } = await this.fetchCsrf();

    const formData = this.buildFormData({ method, fields, csrfParam, csrfToken });

    try {
      const response = await fetch(ajaxPage, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Referer': refererPage,
          'Origin': originPage,
        },
        credentials: 'include',
        body: formData.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw {
          message: this.i18n.get('apiDtekHttpError', [
            String(response.status),
            errorText
          ]),
          url: refererPage,
        };
      }

      return response.json();
    }
    catch (e) {
      throw {
        message: e.message,
        url: refererPage,
      };
    }
  }

  /**
   * Отримати список вулиць.
   * @param {{ city?: string }} params - для "dnem" потрібне city, для "kem" не використовується
   */
  async getStreets({ city } = {}) {
    const fields =
      this.type === 'dnem'
        ? [{ name: 'city', value: city }]
        : [];

    return this.request('getStreets', fields);
  }

  /**
   * Отримати список номерів будинків.
   * @param {{ city?: string, street: string }} params - для "dnem" потрібні city і street, для "kem" тільки street
   */
  async getHomeNum({ city, street }) {
    const dateStr = new Date()
      .toLocaleString('uk-UA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
      .replace(/,/g, '');

    const fields =
      this.type === 'dnem'
        ? [
          { name: 'city', value: city },
          { name: 'street', value: street },
          { name: 'updateFact', value: dateStr },
        ]
        : [
          { name: 'street', value: street },
          { name: 'updateFact', value: dateStr },
        ];

    return this.request('getHomeNum', fields);
  }
}
