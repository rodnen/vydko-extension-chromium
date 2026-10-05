
import { Utils } from '../utils/utils.js';
import { PROVIDER_STRATEGIES } from '../strategies/providerStrategies.js';
import { BoxView } from '../view/boxView.js';

const LOAD_DATA_MIN_INTERVAL_MS = 800;

// ============================================================================
// МЕНЕДЖЕР ДАНИХ
// ============================================================================
export class DataManager {
  #box;

  #lastRunAt = 0;
  #isRunning = false;
  #pendingCall = false;
  #throttleTimer = null;
  #coalesceScheduled = false;
  #updatedOn = null;

  constructor(dom, cacheManager, i18n, selectManager, dateManager) {
    this.dom = dom;
    this.cacheManager = cacheManager;
    this.i18n = i18n;
    this.selectManager = selectManager;
    this.dateManager = dateManager;
    this.#box = new BoxView(dom, i18n);
    this.i18n.onLocaleChange(() => this.#renderUpdatedOn());
  }

  #renderUpdatedOn() {
    if (this.#updatedOn == null) {
      this.#box.setUpdatedOn(null);
      return;
    }

    this.#box.setUpdatedOn(this.i18n.formatUpdatedOn(this.#updatedOn));
  }

  async loadData() {
    if (this.#coalesceScheduled) return;
    this.#coalesceScheduled = true;

    await Promise.resolve();
    this.#coalesceScheduled = false;

    const elapsed = Date.now() - this.#lastRunAt;

    if (this.#isRunning || elapsed < LOAD_DATA_MIN_INTERVAL_MS) {
      this.#pendingCall = true;
      this.#scheduleTrailingRun(Math.max(0, LOAD_DATA_MIN_INTERVAL_MS - elapsed));
      return;
    }

    await this.#runLoadData();
  }

  #scheduleTrailingRun(delay) {
    if (this.#throttleTimer) return;

    this.#throttleTimer = setTimeout(async () => {
      this.#throttleTimer = null;

      if (!this.#pendingCall) return;
      this.#pendingCall = false;

      await this.#runLoadData();
    }, delay);
  }

  async #runLoadData() {
    this.#isRunning = true;
    this.#lastRunAt = Date.now();

    try {
      this.#box.showLoading();
      await this.#fetchAndRender();
    } finally {
      this.#isRunning = false;

      if (this.#pendingCall) {
        this.#scheduleTrailingRun(LOAD_DATA_MIN_INTERVAL_MS);
      }
    }
  }

  async #fetchAndRender() {
    const { group, regionId, dsoId } = this.selectManager.getValues();

    if (Utils.isInvalidValue(group, regionId, dsoId)) {
      this.#box.setContent(Utils.buildStatusIndicatorHTML(this.i18n, 'choose'));
      this.#updatedOn = null;
      this.#renderUpdatedOn();
      return;
    }

    const provider = this.cacheManager.getActiveProvider();
    const strategy = PROVIDER_STRATEGIES[provider];

    if (!strategy) {
      const errorMsg = `Unknown provider key: ${provider}`;
      this.#box.showError(errorMsg);
      return;
    }

    const dayType = this.dateManager.dom.activeDateBtn?.dataset.type ?? 'today';
    const currentDayNumber = new Date().getDate();

    const context = { group, regionId, dsoId, dayType, currentDayNumber };
    const payload = strategy.buildPayload(context);

    try {
      const response = await chrome.runtime.sendMessage(payload);
      const { success, html, status, updatedOn, error } = response;
      this.#updatedOn = updatedOn;

      if (!success) {
        this.#box.showError(error);
        return;
      }

      const statusHTML = status
        ? Utils.buildStatusIndicatorHTML(this.i18n, status)
        : '';

      this.#box.setContent(`${html ?? ''}${statusHTML}`);
      this.#box.scrollToSelected();
      this.#renderUpdatedOn();
    } catch (error) {
      const errorMsg = `loadData error: ${error}`;
      console.error('[DataManager]', errorMsg);
      this.#box.showError(errorMsg);
    }
  }

  scrollToCurrentElement() {
    this.#box.scrollToSelected();
  }
}
