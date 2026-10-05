// ============================================================================
// ВІЗУАЛЬНИЙ ШАР ДІАЛОГУ
// Відповідає ВИКЛЮЧНО за DOM: показ/приховування, рендер title/content/footer,
// побудову кнопок футера та делегування кліків. Жодної бізнес-логіки тут немає —
// цей клас нічого не знає про валідацію, кроки візарда чи відправку даних.
// ============================================================================
export class DialogView {
  #LOADER_HTML = '<div class="update-wrapper"><div class="loader"></div></div>';
  #FULLSCREEN_CLASS = '_dialog-fullscreen';
  #MODAL_CLASS = '_dialog-modal';
  #ANIM_MS = 250;

  #resetTimer = null;

  #dialog = null;

  #title = null;
  #content = null;
  #wrapper = null;

  #footerDivider = null;
  #footerContent = null;

  #backButton = null;
  #closeButton = null;

  #dialogStack = [];
  #currentSnapshot = null;

  /** Обробник кліків, що додається/знімається для конкретного відкритого діалогу (крок візарда тощо). */
  #stepHandler = null;

  /** Викликається для будь-якого кліку по [data-action], який не перехопив #stepHandler. */
  #onBaseAction = null;

  constructor(dom) {
    this.#dialog = dom.dialog;
    this.#title = dom.dialogTitle;
    this.#content = dom.dialogContent;
    this.#wrapper = dom.dialogWrapper;
    this.#init();
  }

  // ---------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------

  #init() {
    if (!this.#wrapper) return;

    this.#content.innerHTML = this.#LOADER_HTML;
    this.#wrapper.addEventListener('click', this.#handleWrapperClick);
  }

  #handleWrapperClick = (e) => {
    const actionEl = e.target.closest('[data-action]');
    if (actionEl) {
      this.#onBaseAction?.(actionEl.dataset.action, e, actionEl);
      return;
    }
    if (e.target === this.#wrapper) this.closeDialog();
  };

  #applyReset() {
    this.#title.textContent = '';
    this.#content.innerHTML = this.#LOADER_HTML;
    this.removeFooter();
    this.setFullScreen(false);
    this.#toggleBackButton(false);
    this.#dialogStack = [];
    this.#currentSnapshot = null;
    this.#resetTimer = null;
  }

  #resetDialog() {
    this.#wrapper.classList.remove('show');
    this.#resetTimer = setTimeout(() => { this.#applyReset() }, 400)
  }

  #toggleBackButton(show) {
    if (show) this.#addBackButton();
    else this.#removeBackButton();
  }

  #toggleCloseButton(show) {
    if (show) this.#addCloseButton();
    else this.#removeCloseButton();
  }

  #addBackButton() {
    if (this.#backButton) return;

    this.#backButton = this.#createElement('button', 'btn app-btn g-6 flex-center glass-panel title-back-btn');
    this.#backButton.innerHTML = this.#buildArrowIcon('left');
    this.#backButton.addEventListener('click', () => this.#handleBackClick());

    this.#title.parentNode.insertBefore(this.#backButton, this.#title);
  }

  #handleBackClick() {
    if (this.#dialogStack.length > 0) this.goBack();
    else this.closeDialog();
  }

  #removeBackButton() {
    if (!this.#backButton) return;

    this.#backButton.remove();
    this.#backButton = null;
  }

  #addCloseButton() {
    if (this.#closeButton) return;

    this.#closeButton = this.#createElement('button', 'btn app-btn g-6 flex-center glass-panel close-btn');
    this.#closeButton.innerHTML = `<div class="icon ic_cross"></div>`
    this.#closeButton.addEventListener('click', () => this.closeDialog());

    this.#title.after(this.#closeButton);
  }

  #removeCloseButton() {
    if (!this.#closeButton) return;

    this.#closeButton.remove();
    this.#closeButton = null;
  }

  #createElement(tag, className) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    return el;
  }

  #buildArrowIcon(position) {
    return `<div class="arrow-icon _6px ${position}"></div>`;
  }

  /** Будує info-іконку + попап у футері. infoData = { action, content, title } */
  #buildFooterButton(btnData) {
    const btn = this.#createElement('button', `glass-panel dialog-btn g-8 flex-center flex-row ${btnData.variant || 'default'}`);
    btn.title = btnData.title || '';
    btn.dataset.action = btnData.action;

    if (btnData.icon === 'left') btn.innerHTML = `${this.#buildArrowIcon(btnData.icon)}${btnData.text}`;
    else if (btnData.icon === 'right') btn.innerHTML = `${btnData.text}${this.#buildArrowIcon(btnData.icon)}`;
    else btn.textContent = btnData.text;

    return btn;
  }

  #buildFooterInfo(infoData) {
    const container = this.#createElement('div', 'btn app-btn g-6 flex-center glass-panel');
    const icon = this.#createElement('div', 'icon ic_info');

    container.dataset.action = infoData.action || '';
    if (infoData.title) icon.title = infoData.title;

    container.appendChild(icon);
    if (infoData.content) {
      container.insertAdjacentHTML('beforeend', infoData.content);
    }

    container.addEventListener('mouseenter', () => container.classList.add('open'));
    container.addEventListener('mouseleave', () => container.classList.remove('open'));

    return container;
  }

  /**
  * Замінює title/content з crossfade + анімацією висоти контейнера.
  * Повністю сумісний за сигнатурою з прямим updateTitle/updateContent.
  */
  #animateSwap(title, content, isHTML, direction = 'forward') {
    const contentEl = this.#content;
    const titleEl = this.#title;
    const MAX_CONTENT_HEIGHT = 300;
    const HEIGHT_ANIM_MS = 200;

    const startHeight = contentEl.offsetHeight;
    contentEl.style.height = `${startHeight}px`;
    contentEl.style.overflow = 'hidden';

    const outClass = direction === 'back' ? 'is-sliding-out-back' : 'is-sliding-out';
    const inClass = direction === 'back' ? 'is-sliding-in-back' : 'is-sliding-in';

    contentEl.classList.add(outClass);
    titleEl.classList.add('is-fading');

    const swap = () => {
      contentEl.removeEventListener('transitionend', swap);
      contentEl.classList.remove(outClass);

      this.updateTitle(title);
      this.updateContent(content, isHTML);
      titleEl.classList.remove('is-fading');

      contentEl.style.height = 'auto';
      const endHeight = contentEl.offsetHeight;
      contentEl.style.height = `${startHeight}px`;

      contentEl.classList.add(inClass);
      void contentEl.offsetHeight;

      contentEl.style.height = `${endHeight}px`;
      contentEl.classList.remove(inClass);

      if (endHeight >= MAX_CONTENT_HEIGHT) {
        contentEl.style.overflow = '';
      }

      const finishHeightAnim = () => {
        contentEl.removeEventListener('transitionend', clearHeight);
        contentEl.style.height = 'auto';
        contentEl.style.overflow = '';
      };

      const clearHeight = (e) => {
        if (e.target !== contentEl || e.propertyName !== 'height') return;
        finishHeightAnim();
      };

      contentEl.addEventListener('transitionend', clearHeight);
      setTimeout(finishHeightAnim, HEIGHT_ANIM_MS + 50);
    };

    contentEl.addEventListener('transitionend', swap, { once: true });
    setTimeout(() => {
      if (contentEl.classList.contains(outClass)) swap();
    }, this.#ANIM_MS + 50);
  }


  /** Реєструє колбек для дій, що не належать конкретному кроку діалогу (напр. 'checkUpdate'). */
  setBaseActionHandler(handler) {
    this.#onBaseAction = handler;
  }

  get isOpen() {
    return this.#wrapper?.classList.contains('show') ?? false;
  }

  showDialog() {
    if (this.#resetTimer) {
      clearTimeout(this.#resetTimer);
      this.#applyReset();
    }
    this.#wrapper.classList.add('show');
  }


  closeDialog() {
    this.detachStepHandler();
    this.#resetDialog()
  }

  // ---------------------------------------------------------------------
  // Header / content
  // ---------------------------------------------------------------------

  updateTitle(title) {
    this.#title.textContent = title;
  }

  updateContent(content, isHTML = false) {
    let updateWrapper = this.#content.querySelector(':scope > .update-wrapper');
    if (!updateWrapper) {
      this.#content.innerHTML = this.#LOADER_HTML;
      updateWrapper = this.#content.querySelector(':scope > .update-wrapper');
    }

    const value = content ?? '';
    updateWrapper[isHTML ? 'innerHTML' : 'textContent'] = value;
    updateWrapper.classList.toggle('has-content', String(value).trim().length > 0);
  }

  updateDialog(title, content, isHTML = false, isFullScreen = false, hasBackButton = false) {
    if (hasBackButton) this.#pushCurrentSnapshot();
    else this.#dialogStack = [];

    this.#currentSnapshot = { title, content, isHTML, isFullScreen, footerContent: this.#footerContent };

    if (hasBackButton) {
      this.#animateSwap(title, content, isHTML, 'forward');
    } else {
      this.updateTitle(title);
      this.updateContent(content, isHTML);
    }

    this.setFullScreen(isFullScreen);
    this.#toggleBackButton(hasBackButton || isFullScreen);
  }

  goBack() {
    const snapshot = this.#dialogStack.pop();
    if (!snapshot) return;

    this.#currentSnapshot = snapshot;

    this.#animateSwap(snapshot.title, snapshot.content, snapshot.isHTML, 'back');
    this.setFullScreen(snapshot.isFullScreen);
    this.#toggleBackButton(this.#dialogStack.length > 0);

    if (!snapshot.footerContent) return;
    this.replaceFooter(snapshot.footerContent);
  }

  #pushCurrentSnapshot() {
    if (this.#currentSnapshot) this.#dialogStack.push(this.#currentSnapshot);
  }

  /** Вмикає/вимикає повноекранний режим діалогу (клас-модифікатор без border-radius, на весь екран). */
  setFullScreen(isFullScreen) {
    const fullScreen = !!isFullScreen;

    this.#dialog.classList.toggle(this.#FULLSCREEN_CLASS, fullScreen);
    this.#dialog.classList.toggle(this.#MODAL_CLASS, !fullScreen);

    this.#toggleCloseButton(!fullScreen);
  }

  /** Пошук елемента всередині поточного контенту діалогу. */
  query(selector) {
    return this.#dialog.querySelector(selector);
  }

  // ---------------------------------------------------------------------
  // Footer
  // ---------------------------------------------------------------------

  appendFooter(content = null) {
    if (this.#footerContent) return;

    this.#footerDivider = this.#createElement('div', 'divider');
    this.#footerContent = this.#createElement('div', 'footer-content');

    if (content) {
      this.#footerContent.append(content);
    }

    this.#dialog.appendChild(this.#footerDivider);
    this.#dialog.appendChild(this.#footerContent);
  }

  removeFooter() {
    if (!this.#footerContent) return;

    this.#footerContent.remove();
    this.#footerDivider.remove();

    this.#footerContent = null;
    this.#footerDivider = null;
  }

  replaceFooter(content) {
    this.removeFooter();
    this.appendFooter(content);
  }

  /**
   * Будує обгортку "footer-buttons" з лівою/правою кнопкою та опційною info-іконкою
   * з попапом при наведенні. Використовується у всіх багатокрокових діалогах.
   * footer = {
   *   info?: { action, content, title },
   *   left:  { action, text, variant, icon, title },
   *   right: { action, text, variant, icon, title }
   * }
   */
  buildFooterButtons(footer) {
    const wrapper = document.createElement('div');
    wrapper.className = 'footer-buttons p-8 g-8 flex-row flex-end';

    if (footer.info) {
      wrapper.appendChild(this.#buildFooterInfo(footer.info));
    }

    ['left', 'right'].forEach((side) => {
      const btnData = footer[side];
      if (!btnData) return;
      wrapper.appendChild(this.#buildFooterButton(btnData));
    });

    return wrapper;
  }

  // ---------------------------------------------------------------------
  // Обробник кліків для конкретного кроку/діалогу
  // ---------------------------------------------------------------------

  attachStepHandler(handler) {
    this.detachStepHandler();
    this.#stepHandler = handler;
    this.#wrapper.addEventListener('click', handler);
  }

  detachStepHandler() {
    if (this.#stepHandler) {
      this.#wrapper.removeEventListener('click', this.#stepHandler);
      this.#stepHandler = null;
    }
  }
}
