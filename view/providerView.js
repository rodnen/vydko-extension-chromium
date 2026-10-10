import { CONSTANTS } from '../config/constants.js';
import { Utils } from '../utils/utils.js';
import { SwapText } from '../utils/swapText.js';

// ============================================================================
// МЕНЕДЖЕР ПРОВАЙДЕРА
// ============================================================================
export class ProviderView {
  #swap = null;

  constructor(dom) {
    this.dom = dom;
  }

  async init() {
    const provider = await Utils.getProvider();
    this.applyProvider(provider, false);
  }

  async toggleProvider() {
    const current = await Utils.getProvider();
    const next = this.getNextProvider(current);
    await Utils.setProvider(next);
    this.applyProvider(next, true);
    return next;
  }

  getNextProvider(current) {
    const index = CONSTANTS.PROVIDERS.indexOf(current);
    const safeIndex = index < 0 ? -1 : index;
    return CONSTANTS.PROVIDERS[(safeIndex + 1) % CONSTANTS.PROVIDERS.length];
  }

  applyProvider(provider, animate = false) {
    this.#updateButtonUI(provider, animate);
  }

  #updateButtonUI(provider, animate) {
    if (!this.dom.providerBtn) return;

    const text = this.dom.providerBtn.querySelector('[data-direction]');
    if (!text) return;

    this.#swap ??= new SwapText(text, {
      label: key => CONSTANTS.PROVIDER_LABELS[key] ?? ''
    });
    this.#swap.set(provider, { animate });
  }
}
