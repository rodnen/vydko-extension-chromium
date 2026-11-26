import { CONSTANTS } from '../config/constants.js';
import { Utils } from '../utils/utils.js';
// ============================================================================
// МЕНЕДЖЕР СЕЛЕКТІВ
// Читає/пише значення через CacheManager (один об'єкт в пам'яті)
// ============================================================================

export class SelectManager {
  #currentDsoId = null;
  #currentProvider = null;
  #groupRequests = new Map();

  constructor(dom, i18n, cache, onSelectionChange) {
    this.dom = dom;
    this.i18n = i18n;
    this.cache = cache;
    this.onSelectionChange = onSelectionChange;

    this.selects = [
      { element: dom.queueSelect, cacheKey: 'group', type: 'queue', defaultValue: CONSTANTS.DEFAULT_QUEUE },
      { element: dom.dsoSelect, cacheKey: 'dsoId', type: 'dsoId', defaultValue: CONSTANTS.DEFAULT_DSO_ID }
    ];

    this.handleOutsideClick = this.handleOutsideClick.bind(this);
  }

  async init() {
    if (!this.dom.queueSelect || !this.dom.dsoSelect) return;

    document.addEventListener('click', this.handleOutsideClick, true);
    this.selects.forEach(select => this.#setupSelect(select));
    this.#currentProvider = this.cache.getActiveProvider();

    this.#regenerateDsoOptions(this.#currentProvider, false);
    await this.loadSavedValues();
  }

  async setProvider(provider) {
    if (!CONSTANTS.PROVIDERS.includes(provider)) {
      console.error('[setProvider] unknown provider:', provider);
      return;
    }

    if (provider === this.#currentProvider) return;

    this.#currentProvider = provider;
    this.#currentDsoId = null;

    this.#regenerateDsoOptions(provider, false);
    await this.loadSavedValues();
  }

  handleOutsideClick(e) {
    const clickedInsideSelect = this.selects.some(({ element }) =>
      element && element.contains(e.target)
    );
    if (!clickedInsideSelect) this.#closeAll();
  }

  #closePopups() {
    document.querySelectorAll('.popup-menu.active')
      .forEach(menu => {
        menu.classList.remove('active');
      });
  };

  #closeAll() {
    this.selects.forEach(({ element }) => element?.classList.remove('open'));
  }

  #setupSelect({ element, cacheKey, defaultValue, type }) {
    if (!element) return;

    element.addEventListener('click', (e) => {
      const option = e.target.closest('.option');

      if (option) {
        this.setSelectValue(element, type, option.dataset.value, defaultValue);

        const patch = { [cacheKey]: option.dataset.value };
        if (type === 'dsoId') patch.regionId = option.dataset.region;
        this.cache.setSelect(this.#currentProvider, patch);

        element.classList.remove('open');

        if (type === 'dsoId') this.#handleDsoChange(option.dataset.value);

        this.onSelectionChange?.(type);
      } else {
        e.stopPropagation();
        this.selects.forEach(({ element: other }) => {
          if (other !== element) other?.classList.remove('open');
        });
        element.classList.toggle('open');
        this.#closePopups();
      }
    });
  }

  // ---- ОСР (dsoId) ---------------------------------------------------

  #buildDsoOptionsFragment(options) {
    const fragment = document.createDocumentFragment();

    options.forEach(({ region, value, label }, index) => {
      const opt = document.createElement('div');
      opt.className = 'option';
      opt.dataset.region = String(region);
      opt.dataset.value = String(value);
      opt.dataset.i18n = label;
      opt.textContent = this.i18n.get(label);

      fragment.appendChild(opt);

      if (index < options.length - 1) {
        const separator = document.createElement('div');
        separator.className = 'menu-separator';
        fragment.appendChild(separator);
      }
    });

    return fragment;
  }

  #regenerateDsoOptions(provider, resetValue = true) {
    const dsoSelect = this.dom.dsoSelect;
    const optionsContainer = dsoSelect?.querySelector('.select-options');
    if (!optionsContainer) return;

    const options = CONSTANTS.DSOID_OPTIONS[provider] ?? [];
    optionsContainer.replaceChildren(this.#buildDsoOptionsFragment(options));

    if (!resetValue) return;

    this.setSelectValue(dsoSelect, 'dsoId', CONSTANTS.DEFAULT_DSO_ID, CONSTANTS.DEFAULT_DSO_ID);
    this.cache.setSelect(provider, { dsoId: CONSTANTS.DEFAULT_DSO_ID, region: dsoSelect.dataset.region });

    this.#currentDsoId = null;
    this.#handleDsoChange(CONSTANTS.DEFAULT_DSO_ID, resetValue);
  }

  // ОСР визначає набір груп (dnem / kem / cek), тому реагуємо саме на зміну
  // dsoId, а не regionId: у 301 і 303 regionId однаковий (3), а групи різні.
  #handleDsoChange(dsoId, resetValue = true) {
    if (dsoId === this.#currentDsoId) return;

    this.#currentDsoId = dsoId;
    this.#regenerateQueueOptions(dsoId, resetValue);
  }

  #getDsoKey(dsoId) {
    return Utils.DSOID_TO_DTEK_TYPE[dsoId] ?? 'none';
  }

  // ---- ЧЕРГИ (queue) -------------------------------------------------

  /**
   * Повертає закешовані групи для ОСР. Якщо кешу немає — робить один
   * мережевий запит через background і записує результат у кеш.
   */
  async #ensureGroups(dsoId) {
    const dsoKey = this.#getDsoKey(dsoId);
    if (!dsoKey || dsoKey === 'none') return [];

    const cached = this.cache.getGroups(dsoKey);
    if (cached?.length) return cached;

    const requestKey = `${this.#currentProvider}:${dsoKey}`;
    const pending = this.#groupRequests.get(requestKey);
    if (pending) return pending;

    const provider = this.#currentProvider;
    const regionId = this.dom.dsoSelect?.dataset.region;
    const payload = provider === CONSTANTS.PROVIDER.YASNO
      ? { action: 'fetchGroups', provider, regionId, dsoId }
      : { action: 'fetchGroups', provider, type: dsoKey };

    const request = Utils.sendMessage(payload)
      .then(response => {
        if (!response?.success) {
          console.error('[SelectManager] group fetch failed:', response?.error);
          return [];
        }

        const groups = Array.isArray(response.groups) ? response.groups : [];
        if (groups.length) this.cache.setGroups(dsoKey, groups);
        return groups;
      })
      .catch(error => {
        console.error('[SelectManager] group fetch failed:', error);
        return [];
      })
      .finally(() => {
        this.#groupRequests.delete(requestKey);
      });

    this.#groupRequests.set(requestKey, request);
    return request;
  }

  #buildQueueOptionsFragment(dsoKey) {
    const fragment = document.createDocumentFragment();

    const allOption = document.createElement('div');
    allOption.className = 'option';
    allOption.dataset.value = CONSTANTS.DEFAULT_QUEUE;
    allOption.dataset.i18n = 'all';
    allOption.textContent = this.i18n.get('all');
    fragment.appendChild(allOption);

    for (const value of this.cache.getGroups(dsoKey) ?? []) {
      const opt = document.createElement('div');
      opt.className = 'option';
      opt.dataset.value = value;
      opt.textContent = value;
      fragment.appendChild(opt);
    }

    return fragment;
  }

  #renderQueueOptions(dsoKey) {
    const optionsContainer = this.dom.queueSelect?.querySelector('.select-options');
    if (!optionsContainer) return false;

    optionsContainer.replaceChildren(this.#buildQueueOptionsFragment(dsoKey));
    return true;
  }

  // Група з даних будинку може бути відсутня в закешованому списку
  // (наприклад, якщо список груп ще не встиг оновитися). Додаємо її,
  // щоб вибір будинку не «губився».
  #ensureQueueOption(value) {
    const optionsContainer = this.dom.queueSelect?.querySelector('.select-options');
    if (!optionsContainer || !value) return;

    if (optionsContainer.querySelector(`.option[data-value="${value}"]`)) return;

    const opt = document.createElement('div');
    opt.className = 'option';
    opt.dataset.value = value;
    opt.textContent = value;
    optionsContainer.appendChild(opt);
  }

  #regenerateQueueOptions(dsoId, resetValue = true) {
    if (!this.dom.queueSelect) return;

    const dsoKey = this.#getDsoKey(dsoId);
    const cachedGroups = this.cache.getGroups(dsoKey) ?? [];

    // Одразу прибираємо варіанти попереднього ОСР, навіть якщо груп
    // для нового ще немає в кеші.
    if (!this.#renderQueueOptions(dsoKey)) return;

    const saved = this.cache.getSelect(this.#currentProvider).group;

    // Поки список груп невідомий, довіряємо збереженій групі, щоб одразу
    // завантажити правильний розклад. Щойно API поверне список, він
    // перевіряється і, за потреби, виправляється у #loadGroups.
    const initialValue = !resetValue
      && dsoKey !== 'none'
      && saved
      && (!cachedGroups.length || cachedGroups.includes(saved))
      ? saved
      : CONSTANTS.DEFAULT_QUEUE;

    if (initialValue !== CONSTANTS.DEFAULT_QUEUE) this.#ensureQueueOption(initialValue);

    this.setSelectValue(this.dom.queueSelect, 'queue', initialValue, CONSTANTS.DEFAULT_QUEUE);

    if (resetValue) {
      this.cache.setSelect(this.#currentProvider, { group: initialValue });
    }

    // Групи ще не закешовані (перший запуск або новий ОСР) — вантажимо
    // у фоні, щоб не блокувати відкриття попапа на час мережевого запиту.
    if (!cachedGroups.length) this.#loadGroups(dsoId);
  }

  /**
   * Догружає групи у фоні та перебудовує селект, коли вони прийшли.
   * На першому запуску список з'являється одразу після відповіді API,
   * не затримуючи init() і перемикання режиму.
   */
  async #loadGroups(dsoId) {
    const provider = this.#currentProvider;
    const dsoKey = this.#getDsoKey(dsoId);
    const groups = await this.#ensureGroups(dsoId);

    // Поки чекали відповідь, користувач міг обрати інший ОСР або режим.
    if (!groups.length || dsoId !== this.#currentDsoId || provider !== this.#currentProvider) return;

    this.#renderQueueOptions(dsoKey);

    const queueSelect = this.dom.queueSelect;
    const current = queueSelect.dataset.value;
    const saved = this.cache.getSelect(this.#currentProvider).group;
    const value = groups.includes(current)
      ? current
      : (groups.includes(saved) ? saved : CONSTANTS.DEFAULT_QUEUE);

    this.setSelectValue(queueSelect, 'queue', value, CONSTANTS.DEFAULT_QUEUE);

    if (value === current) return;

    this.cache.setSelect(this.#currentProvider, { group: value });
    this.onSelectionChange?.('queue');
  }

  /**
   * Порівнює закешований список груп зі свіжим (він приходить разом із
   * розкладом, без окремого запиту). Якщо набір змінився — оновлює кеш
   * і перебудовує селект. Повертає true, якщо вибрану групу довелося
   * змінити (тоді DataManager має перезавантажити таблицю).
   */
  updateGroups(dsoKey, groups) {
    if (!dsoKey || dsoKey === 'none' || !Array.isArray(groups) || !groups.length) {
      return false;
    }

    const cached = this.cache.getGroups(dsoKey) ?? [];
    if (this.#sameGroups(cached, groups)) return false;

    this.cache.setGroups(dsoKey, groups);

    if (this.#getDsoKey(this.#currentDsoId) !== dsoKey) return false;
    if (!this.#renderQueueOptions(dsoKey)) return false;

    const queueSelect = this.dom.queueSelect;
    const previous = queueSelect.dataset.value;
    const saved = this.cache.getSelect(this.#currentProvider).group;
    const value = groups.includes(previous)
      ? previous
      : (groups.includes(saved) ? saved : CONSTANTS.DEFAULT_QUEUE);

    this.setSelectValue(queueSelect, 'queue', value, CONSTANTS.DEFAULT_QUEUE);

    if (value === previous) return false;

    this.cache.setSelect(this.#currentProvider, { group: value });
    this.onSelectionChange?.('queue');
    return true;
  }

  #sameGroups(a, b) {
    return a.length === b.length && a.every((value, index) => value === b[index]);
  }

  setSelectValue(element, type, value, defaultValue) {
    if (!element) return;

    const option = element.querySelector(`.option[data-value="${value}"]`);
    if (!option) return;

    const trigger = element.querySelector('.select-trigger');
    const isDefault = value === defaultValue;

    if (trigger) {
      trigger.textContent = isDefault ? '' : option.textContent;

      if (type === 'dsoId') {
        if (isDefault) {
          delete trigger.dataset.i18n;
        } else {
          trigger.dataset.i18n = option.dataset.i18n;
        }
      }
    }

    if (type === 'dsoId') {
      element.dataset.region = option.dataset.region;
    }

    const selected = element.querySelector('.option[selected]');
    if (selected && selected !== option) {
      selected.removeAttribute('selected');
    }
    option.setAttribute('selected', '');

    element.dataset.value = value;
    element.classList.toggle('has-value', !isDefault);
  }

  async setAndSaveValue(type, value) {
    const select = this.selects.find(s => s.type === type);
    if (!select) return;

    if (type === 'queue') {
      const dsoKey = this.#getDsoKey(this.#currentDsoId);
      const hasGroups = Boolean(this.cache.getGroups(dsoKey)?.length);

      this.#renderQueueOptions(dsoKey);
      this.#ensureQueueOption(value);

      // Список груп ще не закешований — підвантажуємо його у фоні,
      // не затримуючи застосування групи з даних будинку.
      if (!hasGroups) this.#loadGroups(this.#currentDsoId);
    }

    this.setSelectValue(select.element, select.type, value, select.defaultValue);

    const patch = { [select.cacheKey]: value };
    if (type === 'dsoId') patch.regionId = select.element.dataset.region;
    this.cache.setSelect(this.#currentProvider, patch);

    this.onSelectionChange?.(type);
  }

  async loadSavedValues() {
    const saved = this.cache.getSelect(this.#currentProvider);
    let dsoChanged = false;

    const dsoSelect = this.selects.find(s => s.type === 'dsoId');
    if (dsoSelect) {
      const savedDsoId = saved.dsoId;
      const option = savedDsoId && dsoSelect.element?.querySelector(`.option[data-value="${savedDsoId}"]`);
      const dsoIdValue = option ? savedDsoId : dsoSelect.defaultValue;

      this.setSelectValue(dsoSelect.element, dsoSelect.type, dsoIdValue, dsoSelect.defaultValue);

      this.#handleDsoChange(dsoIdValue, false);
      dsoChanged = true;
    }

    const queueSelect = this.selects.find(s => s.type === 'queue');
    if (queueSelect) {
      const savedQueue = saved.group;
      const exists = savedQueue && queueSelect.element?.querySelector(`.option[data-value="${savedQueue}"]`);
      const queueValue = exists ? savedQueue : queueSelect.defaultValue;

      this.setSelectValue(queueSelect.element, queueSelect.type, queueValue, queueSelect.defaultValue);

      // Якщо групи вже відомі, а збереженої в них немає — виправляємо кеш.
      // Поки груп немає, залишаємо збережене значення для наступної спроби.
      const groups = this.cache.getGroups(this.#getDsoKey(this.#currentDsoId)) ?? [];
      if (queueValue !== savedQueue && groups.length) {
        this.cache.setSelect(this.#currentProvider, { group: queueValue });
      }
    }

    this.onSelectionChange?.(dsoChanged ? 'dsoId' : 'queue');
  }

  getValues() {
    return {
      group: this.dom.queueSelect?.dataset.value,
      regionId: this.dom.dsoSelect?.dataset.region,
      dsoId: this.dom.dsoSelect?.dataset.value
    };
  }
}
