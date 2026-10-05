import { CONSTANTS } from '../config/constants.js';
// ============================================================================
// МЕНЕДЖЕР ДАТ
// ============================================================================
export class DateManager {
  constructor(dom, i18n, onDateChange) {
    this.dom = dom;
    this.i18n = i18n;
    this.onDateChange = onDateChange;
    this.init();
  }

  init() {
    this.updateDateNumbers();
    this.#setupDateButtons();
    this.updateIndicator();

    this.i18n.onLocaleChange(() => {
      this.updateDateNumbers();
    });
  }

  #checkEasterEgg(today) {
    if (today.getDate() !== CONSTANTS.EASTER_EGG_DATES.today) return;
    if (this.dom.dateGroup.querySelector('.easter')) return;

    const easterEgg = Object.assign(document.createElement('img'), {
      src: CONSTANTS.EASTER_EGG_GIF,
      alt: '67',
      className: 'easter z-1'
    });
    this.dom.dateGroup.appendChild(easterEgg);
  }

  #setupDateButtons() {
    this.dom.dateGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('.date-btn');
      if (!btn || btn.classList.contains('active')) return;

      this.dom.activeDateBtn?.classList.remove('active');
      btn.classList.add('active');

      this.updateIndicator();
      this.onDateChange?.();
    });
  }

  updateDateNumbers() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const { dateGroup } = this.dom;

    const todayBtn = dateGroup.querySelector('[data-type="today"]');
    const tomorrowBtn = dateGroup.querySelector('[data-type="tomorrow"]');

    if (todayBtn) todayBtn.textContent = `${this.i18n.get('today')} ${this.i18n.formatDate(today)}`;
    if (tomorrowBtn) tomorrowBtn.textContent = `${this.i18n.get('tomorrow')} ${this.i18n.formatDate(tomorrow)}`;

    this.#checkEasterEgg(today);
  }

  updateIndicator() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const { dateIndicator: indicator, activeDateBtn: activeBtn, dateGroup } = this.dom;
        if (!activeBtn || !indicator) return;

        const btnRect = activeBtn.getBoundingClientRect();
        const groupRect = dateGroup.getBoundingClientRect();

        indicator.style.cssText = `width:${btnRect.width}px;height:${btnRect.height}px;transform:translateX(${btnRect.left - groupRect.left - CONSTANTS.INDICATOR_PADDING}px)`;
      });
    });
  }
}
