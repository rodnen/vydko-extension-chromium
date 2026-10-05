import { CONSTANTS } from '../config/constants.js';
import { Utils } from '../utils/utils.js';
// ============================================================================
// МЕНЕДЖЕР ТЕМИ
// ============================================================================
export class ProviderView {

  constructor(dom) {
    this.dom = dom;
  }

  async init() {
    const provider = await Utils.getProvider();
    this.applyProvider(provider);
  }

  async toggleProvider() {
    const provider = await Utils.getProvider();
    const current = provider;

    const next = this.getNextProvider(current);
    await Utils.setProvider(next);
    this.applyProvider(next);
    return next;
  }

  getNextProvider(current) {
    const index = CONSTANTS.PROVIDERS.indexOf(current);
    const safeIndex = index < 0 ? -1 : index;
    return CONSTANTS.PROVIDERS[(safeIndex + 1) % CONSTANTS.PROVIDERS.length];
  }

  applyProvider(provider) {
    this.#updateButtonUI(provider);
  }

  #updateButtonUI(provider) {
    if (!this.dom.providerBtn) return;

    const text = this.dom.providerBtn.querySelector('span:last-child');

    if (text) {
      text.textContent = CONSTANTS.PROVIDER_LABELS[provider] ?? '';
    }
  }
}
