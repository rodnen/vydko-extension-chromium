import { CONSTANTS } from '../config/constants.js';
import { Utils } from '../utils/utils.js';
import { BoxView } from '../view/boxView.js';

// ============================================================================
// МЕНЕДЖЕР ОНОВЛЕННЯ
// При force-refresh очищає кеш поточного режиму через CacheManager
// ============================================================================
export class RefreshManager {
  #isRefreshing = false;
  #box;
  #messageManager;

  constructor(dom, cacheManager, messageManager, i18n, onRefresh) {
    this.dom = dom;
    this.cache = cacheManager;
    this.#messageManager = messageManager;
    this.onRefresh = onRefresh;
    this.i18n = i18n;
    this.#box = new BoxView(dom, i18n);
    this.init();
  }

  #toast(text, type, icon, duration = 3000, emotional = false) {
    return this.#messageManager?.showToast({ text, type, icon, duration, emotional });
  }

  init() {
    this.dom.refreshBtn?.addEventListener('click', () => {
      if (!this.#isRefreshing) this.refresh();
    });
  }

  #setButtonState(state) {
    const btn = this.dom.refreshBtn;
    if (!btn) return;
    btn.classList.remove('ready', 'refreshing');
    btn.classList.add(state);
  }

  async refresh() {
    this.#isRefreshing = true;

    const startTime = Date.now();

    this.#box.showLoading();
    this.#setButtonState('refreshing');

    try {
      const provider = this.cache.getActiveProvider();
      this.cache.clearProviderData(provider);
      await Utils.sendMessage({ action: 'clearTableCache', force: true });
      await this.onRefresh();
    } catch (error) {
      console.error('[RefreshManager] refresh error:', error);
      this.#box.showError();
    } finally {
      this.#toast(this.i18n.get('updated'), 'info', 'ic_info', 2000);

      const remaining = CONSTANTS.REFRESH_MIN_DURATION - (Date.now() - startTime);
      if (remaining > 0) await Utils.delay(remaining);

      this.#box.clearLoading();

      this.#setButtonState('ready');

      setTimeout(() => this.dom.refreshBtn?.classList.remove('ready'), CONSTANTS.REFRESH_ANIMATION_DURATION);
      this.#isRefreshing = false;
    }
  }
}
