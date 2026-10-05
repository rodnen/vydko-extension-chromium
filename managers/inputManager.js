import { CONSTANTS } from '../config/constants.js';
import { Utils } from '../utils/utils.js';
import { InputDropdownManager } from './inputDropdownManager.js';
import { InputDataService } from '../services/inputDataService.js';

const { getLabel } = Utils;

// ============================================================================
// Константи модуля
// ============================================================================

const MIN_SEARCH_LENGTH = 1;

const INPUT_DEBOUNCE_DELAY_MS = 250;

const REFRESH_BASE_DELAY_MS = 5000;
const REFRESH_MAX_DELAY_MS = 30000;
const REFRESH_BACKOFF_MULTIPLIER = 1.5;

const KYIV_DSO_ID = CONSTANTS.KEM_DSO_ID[CONSTANTS.PROVIDER.YASNO];

// ============================================================================
// МЕНЕДЖЕР ІНПУТІВ
// Зберігає location-преференції та house-дані через CacheManager.
// Міста/вулиці більше не беруться з локального settlements.json — усі дані
// (список міст, вулиць, будинків) запитуються асинхронно через InputDataService,
// який звертається до background. Через це пошук і валідація полів тепер
// асинхронні: input/blur-хендлери очікують відповідь мережі.
// ============================================================================
export class InputManager {
  constructor(dom, cacheManager, i18n, onInputFinalSelect) {
    this.dom = dom;
    this.cache = cacheManager;
    this.i18n = i18n;
    this.onInputFinalSelect = onInputFinalSelect;

    this.inputsWrapper = null;
    this.refreshTimeout = null;
    this.retryAttempt = 0;
    this.isRefreshing = false;
    this.debounceTimer = null;

    this.inputMap = {
      city: 'cityInput',
      street: 'streetInput',
      house: 'houseInput'
    };

    this.dataService = null;
    this.inputs = null;
    this.renderedDsoId = null;

    this.dropdownManager = new InputDropdownManager(this.dom, this.inputMap);

    this.state = { city: null, street: null, house: null };
    this.searchTokens = { city: 0, street: 0, house: 0 };

    this.handleOutsideClick = this.handleOutsideClick.bind(this);
  }

  async init() {
    if (!this.dom.cityInput) return;
    this.i18n.onLocaleChange(() => {
      this.#updateNoOutageDate();
      this.#updateOutageDate();
    });
    await this.#initDataService();

    document.addEventListener('click', this.handleOutsideClick, true);

    this.inputs.forEach(input => this.setupInput(input));
    this.updateInputStates();
    this.startRefreshTimer();
  }

  getValues() {
    return {
      city: this.state.city,
      street: this.state.street,
      house: this.state.house
    };
  }

  closeAll() {
    this.dropdownManager.closeAll();
  }

  // ------------------------------------------------------------------
  // Ініціалізація dataService / конфігурації полів
  // ------------------------------------------------------------------

  // Створює dataService і конфіг інпутів (раніше тут ще й вантажився
  // data/settlements.json — тепер дані завантажуються лениво, per-запит,
  // всередині InputDataService).
  async #initDataService() {
    const provider = this.cache.getActiveProvider();
    const { dsoId, regionId } = this.cache.getSelect(provider);

    // Якщо режим і dsoId не змінились — dataService лишається той самий.
    if (this.dataService && this.dataService.provider === provider && this.dataService.dsoId === dsoId) {
      return;
    }

    this.cache.setActiveDsoId(dsoId);
    this.dataService = new InputDataService(provider, dsoId, regionId, this.cache);

    this.inputs = [
      {
        type: 'city',
        key: 'cityInput',
        cacheKey: 'city',
        isInvalid: async (value) => !value || !(await this.dataService.isValidCity(value)),
        onInvalid: () => this.clearCity()
      },
      {
        type: 'street',
        key: 'streetInput',
        cacheKey: 'street',
        isInvalid: async (value) => !value || !(await this.dataService.isValidStreet(this.state.city, value)),
        onInvalid: () => this.clearStreet(),
        dependsOn: 'city'
      },
      {
        type: 'house',
        key: 'houseInput',
        cacheKey: 'house',
        isInvalid: async () => false,
        onInvalid: () => this.clearHouse(),
        dependsOn: 'street'
      }
    ];
  }

  // Формат houseData відрізняється між режимами: DTEK віддає sub_type_reason
  // (масив на кшталт ["GPV1.2"]), Yasno — окремі поля group/subgroup.
  #extractGroup(houseData) {
    if (this.dataService.provider === CONSTANTS.PROVIDER.DTEK) {
      const reason = houseData?.sub_type_reason?.find(
        value => typeof value === 'string' && value.trim()
      )?.trim();
      const match = reason?.match(/^(?:GPV)?(\d+\.\d+)$/i);
      return match?.[1] ?? null;
    }

    const { group, subgroup } = houseData ?? {};
    if (group == null || subgroup == null) return null;

    return `${group}.${subgroup}`;
  }

  // ------------------------------------------------------------------
  // Таймер періодичного оновлення house-даних
  // ------------------------------------------------------------------

  startRefreshTimer() {
    this.stopRefreshTimer();
    this.scheduleNextRefresh();
  }

  scheduleNextRefresh() {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }

    const houseData = this.cache.getHouseData();
    const updateTimestamp = houseData?.updateTimestamp;

    let delay;

    if (!updateTimestamp) {
      const calculatedDelay = REFRESH_BASE_DELAY_MS * Math.pow(REFRESH_BACKOFF_MULTIPLIER, this.retryAttempt);
      delay = Math.min(calculatedDelay, REFRESH_MAX_DELAY_MS);

      this.retryAttempt++;
    } else {
      this.retryAttempt = 0;

      const elapsed = Date.now() - updateTimestamp;
      const remaining = CONSTANTS.CACHE_TTL.HOUSE_DATA - elapsed;
      delay = Math.max(0, remaining);
    }

    this.refreshTimeout = setTimeout(async () => {
      try {
        await this.checkAndRefreshData();
      } catch (error) {
        console.error('[scheduleNextRefresh] Refresh failed:', error);
      } finally {
        this.scheduleNextRefresh();
      }
    }, delay);
  }

  stopRefreshTimer() {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }
  }

  async checkAndRefreshData() {
    if (this.isRefreshing) {
      return;
    }

    if (!this.state.city || !this.state.street || !this.state.house) {
      return;
    }

    this.isRefreshing = true;
    try {
      const cached = this.cache.getHouseData();
      const updateTimestamp = cached?.updateTimestamp;

      const needsRefresh = !updateTimestamp ||
        (Date.now() - updateTimestamp >= CONSTANTS.CACHE_TTL.HOUSE_DATA);

      if (needsRefresh) {
        await this.refreshHouseData();

        const newData = this.cache.getHouseData();
        if (newData?.data) {
          await this.showHouseData();
        }
      }
    } finally {
      this.isRefreshing = false;
    }
  }

  async refreshHouseData() {
    try {
      await this.dataService.loadHousesForStreet(
        this.state.city,
        this.state.street,
        this.state.house
      );

      const houseData = await this.dataService.getHouseData(this.state.house);

      if (!houseData) {
        return;
      }

      const timestamp = this.dataService.getUpdateTimestamp();
      this.cache.setHouseData(houseData, timestamp);
      await this.showHouseData();

    } catch (error) {
      console.error('[refreshHouseData] CRITICAL ERROR:', error);
      throw error;
    }
  }

  // ------------------------------------------------------------------
  // Обробники подій полів вводу
  // ------------------------------------------------------------------

  handleOutsideClick(e) {
    if (!this.inputsWrapper?.contains(e.target)) {
      this.dropdownManager.closeAll();
    }
  }

  setupInput({ type, key, isInvalid, onInvalid, dependsOn }) {
    const input = this.dom[key];
    if (!input || input.dataset.initialized) return;
    input.dataset.initialized = 'true';

    input.addEventListener('input', (e) => {
      const value = e.target.value.trim();

      clearTimeout(this.debounceTimer);

      if (dependsOn && !this.state[dependsOn]) {
        this.dropdownManager.remove(type);
        return;
      }

      const token = ++this.searchTokens[type];

      this.debounceTimer = setTimeout(async () => {
        if (this.searchTokens[type] !== token) return;

        if (value.length < MIN_SEARCH_LENGTH) {
          this.dropdownManager.remove(type);
          return;
        }

        const matches = await this.dataService.search(type, value, this.state);
        if (this.searchTokens[type] !== token) return;

        if (!matches.length) {
          this.dropdownManager.remove(type);
          return;
        }

        this.dropdownManager.render(type, matches, (t, option) => {
          this.selectOption(t, option);
          this.dropdownManager.remove(t);
        });
      }, INPUT_DEBOUNCE_DELAY_MS);
    });

    if (type !== 'house') {
      input.addEventListener('blur', async () => {
        clearTimeout(this.debounceTimer);

        const value = input.value.trim();
        if (this.state[type] !== null && value === getLabel(this.state[type])) return;

        const token = ++this.searchTokens[type];

        if (await isInvalid(value)) {
          if (this.searchTokens[type] !== token) return;
          input.value = '';
          this.state[type] = null;
          onInvalid?.();
          this.updateInputStates();
        }
      });
    }
  }

  // ------------------------------------------------------------------
  // Робота зі значеннями полів
  // ------------------------------------------------------------------

  setInputValue(type, value) {
    const config = this.inputs.find(i => i.type === type);
    const input = this.dom[config.key];
    if (!input) return;

    input.value = getLabel(value);
    this.state[type] = value || null;
  }

  async setAndSaveValue(type, value) {
    const config = this.inputs.find(i => i.type === type);
    if (!config) return;

    this.setInputValue(type, value);
    this.cache.setLocation({ [config.cacheKey]: value });
    this.updateInputStates();
  }

  async selectOption(type, option) {
    ++this.searchTokens[type];
    await this.setAndSaveValue(type, option);

    if (type === 'city') {
      this.clearStreet();
    }

    if (type === 'street') {
      this.clearHouse();
      await this.dataService.loadHousesForStreet(this.state.city, option);
    }

    if (type === 'house') {
      const houseData = await this.dataService.getHouseData(option);

      if (!houseData) {
        console.error('[selectOption] Не вдалося отримати дані по будинку');
        return;
      }

      const timestamp = this.dataService.getUpdateTimestamp();
      const group = this.#extractGroup(houseData);
      const { group: selectedGroup } = this.cache.getSelect();

      this.cache.setHouseData(houseData, timestamp);

      if (group) {
        this.cache.setLocation({ group });
        if (group !== selectedGroup) await this.onInputFinalSelect(group);
      } else {
        this.cache.setLocation({ group: CONSTANTS.DEFAULT_QUEUE });
        if (selectedGroup !== CONSTANTS.DEFAULT_QUEUE) {
          await this.onInputFinalSelect(CONSTANTS.DEFAULT_QUEUE);
        }
        console.warn('[selectOption] API не повернув групу для будинку:', houseData);
      }

      await this.showHouseData();
    }
  }

  // Завантажуємо збережені значення з in-memory кешу (без звернення до storage)
  async loadSavedValues() {
    const loc = this.cache.getLocation();

    if (this.dataService.dsoId !== KYIV_DSO_ID) {
      if (!loc.city || !(await this.dataService.isValidCity(loc.city))) return;
      this.setInputValue('city', loc.city);
    }

    if (!loc.street || (!(await this.dataService.isValidStreet(loc.city, loc.street)) && this.dataService.dsoId !== KYIV_DSO_ID)) return;
    this.setInputValue('street', loc.street);
    await this.dataService.loadHousesForStreet(loc.city, loc.street, loc.house ?? null);

    if (!loc.house) return;
    this.setInputValue('house', loc.house);

    const { group: selectGroup } = this.cache.getSelect();
    if (loc.group && loc.group !== selectGroup) {
      await this.onInputFinalSelect(loc.group);
    }

    await this.showHouseData();
    this.updateInputStates();
  }

  clearCity() {
    this.clearField('city');
    this.clearStreet();
  }

  clearStreet() {
    this.clearField('street');
    this.clearHouse();
  }

  clearHouse() {
    this.clearField('house');
    this.dataService.clearHouses();
  }

  clearField(type) {
    const config = this.inputs.find(i => i.type === type);
    this.state[type] = null;
    const input = this.dom[config.key];
    if (input) input.value = '';
    this.cache.setLocation({ [config.cacheKey]: '' });
  }

  updateInputStates() {
    const extended = this.inputsWrapper?.dataset.extended === 'true';
    const hasCity = this.state.city !== null;
    const hasStreet = this.state.street !== null;
    const isKyivLocked = String(this.dataService?.dsoId) === KYIV_DSO_ID;

    if (this.dom.cityInput) {
      this.dom.cityInput.disabled = isKyivLocked ? true : !extended;
    }
    if (this.dom.streetInput) {
      this.dom.streetInput.disabled = !extended || !hasCity;
      if (!hasCity) this.dom.streetInput.value = '';
    }
    if (this.dom.houseInput) {
      this.dom.houseInput.disabled = !extended || !hasStreet;
      if (!hasStreet) this.dom.houseInput.value = '';
    }
  }

  // ------------------------------------------------------------------
  // Рендер стану електропостачання
  // ------------------------------------------------------------------

  #buildOutageHtml(data, updateTimestamp) {
    const { sub_type, start_date, end_date } = data;
    const group = this.#extractGroup(data);
    const groupStatus = group
      ? ''
      : `<p><strong data-i18n="outageGroupNotSpecified">${this.i18n.get('outageGroupNotSpecified')}</strong></p>`;
    const timestamp = updateTimestamp == null || updateTimestamp === ''
      ? NaN
      : Number(updateTimestamp);
    const formattedUpdateDate = Number.isFinite(timestamp)
      ? this.i18n.formatFullDate(new Date(timestamp))
      : '—';

    return `
        <div class="outage-card glass-blur p-8 z-5 popup">
            <div class="outage-body">
            ${groupStatus}
            <p><span data-i18n="outageReason">${this.i18n.get('outageReason')}</span><strong>${sub_type}</strong></p>
            <p><span data-i18n="outageStart">${this.i18n.get('outageStart')}</span><strong data-outage-start-date="${start_date ?? ''}">${this.i18n.formatFullDateTime(start_date)}</strong></p>
            <p><span data-i18n="outageEnd">${this.i18n.get('outageEnd')}</span><strong><span data-i18n="outageEndPrefix">${this.i18n.get('outageEndPrefix')}</span> <span data-outage-end-date="${end_date ?? ''}">${this.i18n.formatFullDateTime(end_date)}</span></strong></p>
            <p><span data-i18n="outageUpdated">${this.i18n.get('outageUpdated')}</span><strong data-outage-updated-timestamp="${Number.isFinite(timestamp) ? timestamp : ''}">${formattedUpdateDate}</strong></p>
            </div>
        </div>
        `;
  }

  #buildNoOutageHtml(updateTimestamp) {
    const updated = this.i18n.get('outageUpdated');
    const html = `
      <div class="outage-card glass-blur glass-panel p-8 z-5 popup info-mode">
        <div class="outage-body info-text">
          <p>
            <span data-i18n="noPowerBefore">${this.i18n.get('noPowerBefore')}</span>
            <strong><span data-i18n="noPowerEmphasis">${this.i18n.get('noPowerEmphasis')}</span></strong>
            <span data-i18n="noPowerAfter">${this.i18n.get('noPowerAfter')}</span>
          </p>
          <p>
            <span data-i18n="checkAgainBefore">${this.i18n.get('checkAgainBefore')}</span>
            <strong><span data-i18n="checkAgainEmphasis">${this.i18n.get('checkAgainEmphasis')}</span></strong>
            <span data-i18n="checkAgainAfter">${this.i18n.get('checkAgainAfter')}</span>
          </p>
          <p><span data-i18n="outageUpdated">${updated}</span> <strong data-outage-updated-date="${updateTimestamp}">${this.i18n.formatFullDate(new Date(updateTimestamp))}</strong></p>
        </div>
      </div>
    `;
    return html;
  }

  #updateNoOutageDate() {
    const dateElement = this.dom.contentWrapper.querySelector('[data-outage-updated-date]');
    if (!dateElement) return;

    const rawTimestamp = dateElement.dataset.outageUpdatedDate;
    const timestamp = rawTimestamp === '' ? NaN : Number(rawTimestamp);
    if (!Number.isFinite(timestamp)) return;

    dateElement.textContent = this.i18n.formatFullDate(new Date(timestamp));
  }

  #updateOutageDate() {
    const container = this.dom.contentWrapper;
    if (!container) return;

    const startDate = container.querySelector('[data-outage-start-date]');
    if (startDate) {
      startDate.textContent = this.i18n.formatFullDateTime(startDate.dataset.outageStartDate);
    }

    const endDate = container.querySelector('[data-outage-end-date]');
    if (endDate) {
      endDate.textContent = this.i18n.formatFullDateTime(endDate.dataset.outageEndDate);
    }

    const updatedDate = container.querySelector('[data-outage-updated-timestamp]');
    if (updatedDate) {
      const rawTimestamp = updatedDate.dataset.outageUpdatedTimestamp;
      const timestamp = rawTimestamp === '' ? NaN : Number(rawTimestamp);
      updatedDate.textContent = Number.isFinite(timestamp)
        ? this.i18n.formatFullDate(new Date(timestamp))
        : '—';
    }
  }

  async showHouseData() {
    if (this.dataService.provider === CONSTANTS.PROVIDER.YASNO) return;

    const cached = this.cache.getHouseData();
    const data = cached?.data;
    const updateTimestamp = cached?.updateTimestamp;

    let container = this.dom.contentWrapper.querySelector('#content-header');

    if (!container) {
      container = document.createElement('div');
      container.id = 'content-header';
      container.classList.add('flex-col');
      this.dom.contentWrapper.insertBefore(container, this.dom.contentWrapper.firstChild);
    }

    if (!data) {
      container.innerHTML = `
        <button id="toggle-outage-btn" data-i18n-title="inputLoadingTitle" class="glass-panel flex-center g-10" title="${this.i18n.get('inputLoadingTitle')}">
          <div class="loader small"></div>
          <span data-i18n="inputUpdatingData">${this.i18n.get('inputUpdatingData')}</span>
        </button>`;
      return;
    }

    const hasOutage = data.sub_type?.trim() !== '';
    const outageHtml = hasOutage
      ? this.#buildOutageHtml(data, updateTimestamp)
      : this.#buildNoOutageHtml(updateTimestamp);

    container.innerHTML = `
        <button id="toggle-outage-btn" class="glass-panel flex-center g-10 ${hasOutage ? 'outage-active' : ''}" data-i18n-title="inputViewOutageStatus" title="${this.i18n.get('inputViewOutageStatus')}">
          ${hasOutage
        ? `<span class="icon ic_warning"></span><span class="btn-text"><span data-i18n="inputPowerUnavailable">${this.i18n.get('inputPowerUnavailable')}</span></span>`
        : `<span class="btn-text"><span data-i18n="inputPowerStatus">${this.i18n.get('inputPowerStatus')}</span></span>`
      }
        </button>
        ${outageHtml}
    `;

    const button = container.querySelector('#toggle-outage-btn');
    const popup = container.querySelector('.outage-card');

    button.addEventListener('click', (e) => {
      e.stopPropagation();
      popup.classList.toggle('active');
    });

    document.addEventListener('click', () => popup.classList.remove('active'));
    popup.addEventListener('click', (e) => e.stopPropagation());
  }

  // ------------------------------------------------------------------
  // Побудова/знищення DOM полів вводу
  // ------------------------------------------------------------------

  #buildClearButtonHtml(action) {
    return `<button class="btn app-btn glass-panel flex-center small input-clear" data-action="${action}" data-i18n-title="inputClear" title="${this.i18n.get('inputClear')}"><div class="icon ic_cross"></div></button>`;
  }

  #bindClearButton(root, action, handler) {
    const btn = root.querySelector(`[data-action="${action}"]`);
    if (btn) {
      btn.addEventListener('click', handler);
    }
  }

  async renderInputs() {
    await this.#initDataService();
    const dsoId = this.dataService.dsoId;

    if (this.inputsWrapper) {
      this.removeInputs();
    }

    this.renderedDsoId = dsoId;

    const { extended } = await Utils.getStorageData(['extended']);
    const isExtended = extended === true;
    const disabled = isExtended ? '' : 'disabled';

    const isKyivLocked = String(dsoId) === KYIV_DSO_ID;
    const cityDisabled = isKyivLocked ? 'disabled' : disabled;
    const cityValue = isKyivLocked ? 'м. Київ' : '';
    const cityButtonHtml = isKyivLocked
      ? ''
      : this.#buildClearButtonHtml('clearCity');

    const titleVal = [this.i18n.get('inputExpand'), this.i18n.get('inputCollapse')];

    const root = document.createElement('div');
    root.className = 'location-root flex-col';
    root.dataset.extended = String(extended ?? false);
    root.innerHTML = `
        <div class="input-wrapper g-8">
            <div class="custom-input glass-panel">
                <input id="city" class="city-input" value="${cityValue}" ${cityDisabled} placeholder=" " />
                <label for="city" class="input-label" data-i18n="inputCity">${this.i18n.get('inputCity')}</label>
                ${cityButtonHtml}
            </div>
            <div class="custom-input glass-panel">
                <input id="street" class="street-input" ${disabled} placeholder=" " />
                <label for="street" class="input-label" data-i18n="inputStreet">${this.i18n.get('inputStreet')}</label>
                ${this.#buildClearButtonHtml('clearStreet')}
            </div>
            <div class="custom-input glass-panel">
                <input id="house" class="house-number-input" ${disabled} placeholder=" " />
                <label for="house" class="input-label" data-i18n="inputHouseNumber">${this.i18n.get('inputHouseNumber')}</label>
                ${this.#buildClearButtonHtml('clearHouse')}
            </div>
        </div>
        <button class="location-btn flex-center" title="${isExtended ? titleVal[1] : titleVal[0]}">
            <div class="arrow-icon _8px ${isExtended ? 'up' : 'down'}"></div>
        </button>
    `;

    this.dom.controls.appendChild(root);
    this.inputsWrapper = root;

    this.dom.cityInput = root.querySelector('#city');
    this.dom.streetInput = root.querySelector('#street');
    this.dom.houseInput = root.querySelector('#house');
    this.dom.locationBtn = root.querySelector('.location-btn');

    if (isKyivLocked) {
      this.state.city = 'м. Київ';
    }

    this.updateInputStates();

    this.dom.locationBtn.addEventListener('click', async () => {
      const newExtended = root.dataset.extended !== 'true';

      root.dataset.extended = String(newExtended);
      await Utils.setStorageData({ extended: newExtended });

      const arrowIcon = this.dom.locationBtn.querySelector('.arrow-icon');
      arrowIcon?.classList.toggle('down', !newExtended);
      arrowIcon?.classList.toggle('up', newExtended);

      this.dom.locationBtn.title = newExtended ? titleVal[1] : titleVal[0];

      this.updateInputStates();
    });

    this.#bindClearButton(root, 'clearCity', () => this.clearCity());
    this.#bindClearButton(root, 'clearStreet', () => this.clearStreet());
    this.#bindClearButton(root, 'clearHouse', () => this.clearHouse());

    await this.loadSavedValues();
    await this.init();
  }

  removeInputs() {
    if (!this.inputsWrapper) return;
    this.stopRefreshTimer();

    this.inputsWrapper.remove();
    this.inputsWrapper = null;
    this.renderedDsoId = null;

    this.dom.cityInput = null;
    this.dom.streetInput = null;
    this.dom.houseInput = null;

    this.state.city = null;
    this.state.street = null;
    this.state.house = null;

    this.dom.contentWrapper.querySelector('#content-header')?.remove();
  }
}
