/**
 * Клас для збору, буферизації та відправки помилок на віддалений endpoint (наприклад Google Forms)
 */
import { CONSTANTS } from '../config/constants.js';
import { Utils } from './utils.js';

class ErrorReporter {
  /**
   * @param {Object} config - конфігурація репортера
   * @param {string} config.endpoint - URL для відправки (formResponse)
   * @param {Object} config.fieldsMap - мапа полів { error: "entry.xxx", stack: "entry.xxx", ... }
   * @param {number} [config.maxQueue=20] - максимальний розмір черги
   */
  constructor({
    endpoint,
    fieldsMap,
    appId = "yasno-extension",
    maxQueue = 20,
    rateLimitMs = 3000
  }) {
    this.endpoint = endpoint;
    this.fieldsMap = fieldsMap;
    this.queue = [];
    this.maxQueue = maxQueue;

    this.appId = appId;
    this.rateLimitMs = rateLimitMs;
    this.lastSendTime = 0;
  }

  /**
   * Додає помилку до внутрішньої черги
   * @param {Object} data - дані помилки
   * @param {string} [data.error] - текст помилки
   * @param {string} [data.stack] - стек викликів
   * @param {string} [data.url] - URL сторінки
   */
  capture(data) {
    this.queue.push(this.#normalize(data));

    if (this.queue.length > this.maxQueue) {
      this.queue.shift();
    }
  }

  /**
   * Приводить дані до формату полів форми. Діалог звіту передає активного
   * провайдера як `provider`, а поле форми називається `mode`: без цього
   * відповідності провайдер завжди губився.
   */
  #normalize(data) {
    return {
      error: data.error || "",
      stack: data.stack || "",
      mode: data.mode || data.provider || "",
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screen: `${screen.width}x${screen.height}`,
      version: chrome.runtime.getManifest().version,
      appId: this.appId
    };
  }

  /**
   * Негайно відправляє звіт і чекає результат. На відміну від capture()+flush()
   * не мовчить при збої або спрацюванні rate-limit, а кидає помилку, щоб UI
   * не показував «Надіслано» для звіту, який нікуди не пішов.
   * @param {Object} data
   * @returns {Promise<void>}
   */
  async submit(data) {
    await this.send(this.#normalize(data));
  }

  /**
   * Відправляє всі накопичені помилки
   * Якщо відправка не вдалася — елемент повертається назад у чергу
   * @returns {Promise<void>}
   */
  async flush() {
    const now = Date.now();
    if (now - this.lastSendTime < this.rateLimitMs) return;
    if (!this.queue.length) return;

    this.lastSendTime = now;

    const items = [...this.queue];
    this.queue = [];

    for (const item of items) {
      try {
        await this.send(item);
      } catch (e) {
        this.queue.push(item);
      }
    }
  }

  /**
   * Відправляє один запис на сервер
   * @param {Object} data - дані для відправки
   * @returns {Promise<void>}
   */
  async send(data) {
    const formData = new URLSearchParams();

    for (const key in this.fieldsMap) {
      if (data[key] !== undefined) {
        formData.append(this.fieldsMap[key], data[key]);
      }
    }

    formData.append("entry.APP_ID", this.appId);

    // no-cors повертає непрозору відповідь, тож перевірити статус неможливо;
    // але мережеві збої та тайм-аут тут усе одно кинуть помилку.
    await Utils.fetchWithTimeout(
      this.endpoint,
      { method: "POST", mode: "no-cors", body: formData },
      CONSTANTS.FETCH_TIMEOUT_MS
    );
  }


  /**
   * Очищає чергу помилок
   */
  clear() {
    this.queue = [];
  }

  /**
   * Повертає кількість елементів у черзі
   * @returns {number}
   */
  size() {
    return this.queue.length;
  }
}

export { ErrorReporter };
export default ErrorReporter;
