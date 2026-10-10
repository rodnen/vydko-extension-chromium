import { CONSTANTS } from '../config/constants.js';
import { Utils } from '../utils/utils.js';
import { SwapText } from '../utils/swapText.js';

export class ThemeView {
  themes = ['system', 'dark', 'light'];
  #swap = null;

  constructor(dom, i18n) {
    this.dom = dom;
    this.i18n = i18n;
  }

  async init() {
    const { theme } = await Utils.getStorageData(['theme']);
    this.applyTheme(theme || this.themes[0], false);
  }

  async toggleTheme() {
    const { theme } = await Utils.getStorageData(['theme']);
    const current = theme || this.themes[0];
    const next = this.getNextTheme(current);
    await Utils.setStorageData({ theme: next });
    this.applyTheme(next, true);

    return next;
  }

  getNextTheme(current) {
    const index = this.themes.indexOf(current);
    return this.themes[(index + 1) % this.themes.length];
  }

  applyTheme(theme, animate = false) {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    this.#updateButtonUI(theme, animate);
  }

  refreshLabels() {
    this.#swap?.refresh();
  }

  #updateButtonUI(theme, animate) {
    if (!this.dom.themeBtn) return;

    const icon = this.dom.themeBtn.querySelector('.icon');
    const text = this.dom.themeBtn.querySelector('[data-direction]');

    const icons = { system: 'ic_system', dark: 'ic_moon', light: 'ic_sun' };

    if (icon) {
      icon.classList.remove(...Object.values(icons));
      icon.classList.add(icons[theme]);
    }

    if (text) {
      this.#swap ??= new SwapText(text, {
        label: key => this.i18n.get(key),
        localized: true
      });
      this.#swap.set(theme, { animate });
    }
  }
}
