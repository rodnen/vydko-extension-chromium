export class LanguagePopupManager {

  constructor(dom, i18n) {
    this.dom = dom;
    this.i18n = i18n;
  }

  #closePopups = (currentPopup) => {
    document.querySelectorAll('.popup-menu.active')
      .forEach(menu => {
        if (menu !== currentPopup) {
          menu.classList.remove('active');
        }
      });
  };

  async init() {
    const { languageBtn, languagePopupMenu } = this.dom;
    if (!languageBtn || !languagePopupMenu) return;

    const currentSelected = languagePopupMenu.querySelector(`.menu-item[data-value="${this.i18n.getLocale()}"]`);
    currentSelected.setAttribute('selected', '');

    languageBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#closePopups(languagePopupMenu);
      languagePopupMenu.classList.toggle('active');
    });

    document.addEventListener('click', () => languagePopupMenu.classList.remove('active'));

    languagePopupMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      const item = e.target.closest('[data-value]');
      if (!item) return;

      this.setLanguage(item.dataset.value);

      const selected = languagePopupMenu.querySelector('.menu-item[selected]');
      if (selected) selected.removeAttribute('selected');
      item.setAttribute('selected', '');

      if (item.classList.contains('close-at-click')) mainPopupMenu.classList.remove('active');
    });
  }

  async setLanguage(locale) {
    await this.i18n.setLocale(locale);

    this.i18n.localize();
  }
}
