import { Utils } from '../utils/utils.js';

export class BoxView {
  #box;
  #footer;

  constructor(dom, i18n) {
    this.dom = dom;
    this.i18n = i18n;
    this.#box = dom.box;
    this.#footer = dom.footer;
    this.#createUpdatedWrapper();
  }

  #createUpdatedWrapper() {
    const existing = this.#footer.querySelector('.updated-wrapper');
    if (existing) return existing;

    const container = document.createElement('div');
    container.className = 'updated-wrapper';
    this.#footer.prepend(container);
    return container;
  }

  #expandUpdatedOn(container, text, time) {
    let el = container.querySelector('.updated-on');
    if (!el) {
      el = document.createElement('div');
      el.className = 'flex-center g-5 updated-on glass-panel secondary-text';

      const textEl = document.createElement('span');
      textEl.className = 'updated-on-text';

      const timeEl = document.createElement('span');
      timeEl.className = 'updated-on-time';

      el.append(textEl, timeEl);
      container.appendChild(el);
    }

    const textEl = el.querySelector('.updated-on-text');
    const timeEl = el.querySelector('.updated-on-time');

    textEl.textContent = text;
    timeEl.textContent = time;

    const width = el.getBoundingClientRect().width;
    container.style.width = `${width}px`;

    if (!container.classList.contains('is-expanded')) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          container.classList.add('is-expanded');
          container.addEventListener('transitionend', (e) => {
            if (e.target !== container) return;
            requestAnimationFrame(() => el.classList.add('is-visible'));
          }, { once: true });
        });
      });
    } else {
      requestAnimationFrame(() => el.classList.add('is-visible'));
    }
  }

  #collapseUpdatedOn(container) {
    if (!container) return;

    const el = container.querySelector('.updated-on');
    container.style.width = '30px';
    container.classList.remove('is-expanded');

    if (!el) return;

    el.classList.remove('is-visible');

    const removeContent = () => {
      if (container.classList.contains('is-expanded')) return;
      el.remove();
    };
    const onTransitionEnd = (e) => {
      if (e.target !== container || e.propertyName !== 'width') return;
      container.removeEventListener('transitionend', onTransitionEnd);
      removeContent();
    };

    container.addEventListener('transitionend', onTransitionEnd);
    setTimeout(() => {
      container.removeEventListener('transitionend', onTransitionEnd);
      removeContent();
    }, 450);
  }

  showLoading() {
    this.#box.classList.remove('error', 'flex-center');
    this.#box.classList.add('loading', 'flex-center');
    this.#box.innerHTML = `<div class="loading-wrapper g-10 flex-center flex-row"><div class="loader"></div><p>${this.i18n.get('loading')}</p></div>`;
  }

  showError(error) {
    this.#box.classList.remove('loading', 'flex-center');
    this.#box.classList.add('error', 'flex-center');
    this.#box.innerHTML = Utils.buildLoadErrorHTML(this.i18n, error);
  }

  setContent(html) {
    this.#box.classList.remove('loading', 'flex-center');
    this.#box.classList.remove('error', 'flex-center');
    this.#box.innerHTML = html;
  }

  setUpdatedOn(obj) {
    const container = this.#footer.querySelector('.updated-wrapper');

    const { text, time } = obj ?? {};

    if (text == null || time == null) {
      this.#collapseUpdatedOn(container);
      return;
    }

    if (!container) {
      this.#expandUpdatedOn(this.#createUpdatedWrapper(), text, time);
      return;
    }

    const el = container.querySelector('.updated-on');

    if (el && el.classList.contains('is-visible')) {
      el.classList.remove('is-visible');
      el.addEventListener('transitionend', (e) => {
        if (e.target !== el) return;
        this.#expandUpdatedOn(container, text, time);
      }, { once: true });
    } else {
      this.#expandUpdatedOn(container, text, time);
    }
  }

  /** Знімає лише індикатор завантаження. НЕ чіпає клас 'error' —
   *  його знімає тільки showLoading()/setContent(), тобто коли
   *  реально стартував новий процес або прийшли валідні дані. */
  clearLoading() {
    this.#box.classList.remove('loading', 'flex-center');
  }

  /** Явне скидання стану помилки (якщо колись знадобиться окремо). */
  clearError() {
    this.#box.classList.remove('error', 'flex-center');
  }

  scrollToTop() {
    this.#box.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /** Прокручує до вибраного рядка таблиці, якщо він далеко від верху; інакше — просто нагору. */
  scrollToSelected(selector = '._table_current_selected', minIndex = 4) {
    const el = this.#box.querySelector(selector);
    const index = el?.dataset.index !== undefined ? Number(el.dataset.index) : null;

    if (el && index !== null && index >= minIndex) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      this.scrollToTop();
    }
  }
}
