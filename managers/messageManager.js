// ============================================================================
// МЕНЕДЖЕР ПОВІДОМЛЕНЬ
// ============================================================================
export class MessageManager {
  // --------------------------------------------------------------------------
  // Поля
  // --------------------------------------------------------------------------
  #maxToastCount = 5;
  #defaultDuration = 3000;
  #activeToasts = new Map();

  #elements = {
    header: null,
    container: null
  };

  // --------------------------------------------------------------------------
  // Ініціалізація
  // --------------------------------------------------------------------------
  constructor(dom = {}) {
    this.#elements.header = dom.header || document.querySelector('header');
    this.#initContainer();
  }

  // ==========================================================================
  // PUBLIC API — статус у хедері
  // ==========================================================================
  showUpdateStatus({
    text = '',
    textParts = null,
    icon = 'ic_info',
    url = null,
    type = 'info',
    id = 'update-status'
  } = {}) {
    if (!this.#elements.header) return null;

    const host = this.#elements.header.querySelector('.app-name') ?? this.#elements.header;
    host.classList.add('flex-center', 'g-5');
    let block = this.#findStatusBlock(id);

    if (block) {
      this.#updateStatusBlock(block, { id, text, textParts, icon, url, type });
      this.#revealStatusBlock(block);
      return block;
    }

    block = this.#createStatusBlock({ text, textParts, icon, url, type, id, closable: false });
    host.append(block);
    requestAnimationFrame(() => this.#revealStatusBlock(block));
    return block;
  }

  hideStatus(block) {
    if (!block) return;

    block.style.opacity = '0';
    block.style.transform = 'translateY(-10px)';

    block.addEventListener('transitionend', () => {
      block.remove()
      const host = this.#elements.header.querySelector('.app-name') ?? this.#elements.header;
      host.classList.remove('flex-center', 'g-5');
    }, { once: true });
  }

  clearStatuses() {
    if (!this.#elements.header) return;
    this.#elements.header
      .querySelectorAll('.message-block')
      .forEach(block => this.hideStatus(block));
  }

  // ==========================================================================
  // PUBLIC API — toast
  // ==========================================================================
  showToast({
    text = '',
    icon = 'ic_info',
    type = 'info',
    id = null,
    duration = this.#defaultDuration,
    emotional = false
  } = {}) {
    if (this.#activeToasts.size >= this.#maxToastCount) {
      const oldestId = this.#activeToasts.keys().next().value;
      this.hideToast(oldestId);
    }

    const toastId = id ?? `toast-${Date.now()}-${Math.random()}`;

    if (id && this.#activeToasts.has(id)) {
      this.#updateToast(id, { text, icon, type, emotional });
      return toastId;
    }

    const messageText = emotional && this.#activeToasts.size >= 1
      ? this.#addEmotionalEnding(text)
      : text;

    const toast = this.#createToastElement({
      text: messageText,
      icon,
      type,
      id: toastId
    });

    this.#elements.container.appendChild(toast);

    const timerId = setTimeout(() => this.hideToast(toastId), duration);
    this.#activeToasts.set(toastId, { element: toast, timerId });

    requestAnimationFrame(() => toast.classList.add('show'));

    return toastId;
  }

  hideToast(id) {
    const toastData = this.#activeToasts.get(id);
    if (!toastData) return;

    const { element, timerId } = toastData;
    clearTimeout(timerId);

    element.classList.remove('show');
    element.addEventListener('transitionend', () => {
      element.remove();
      this.#activeToasts.delete(id);
    }, { once: true });
  }

  clearAllToasts() {
    this.#activeToasts.forEach((_, id) => this.hideToast(id));
  }

  // ==========================================================================
  // PRIVATE — ініціалізація
  // ==========================================================================
  #initContainer() {
    let container = document.querySelector('.validator-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'validator-container z-999 flex-col-rev flex-center g-10';
      document.body.appendChild(container);
    }
    this.#elements.container = container;
  }

  // ==========================================================================
  // PRIVATE — статус у хедері
  // ==========================================================================
  #findStatusBlock(id) {
    return this.#elements.header.querySelector(`.message-block[data-id="${id}"]`);
  }

  #revealStatusBlock(block) {
    block.style.opacity = '1';
    block.style.transform = 'translateY(0)';
  }

  #createStatusBlock({ text, textParts, icon, type, url, id, closable }) {
    const block = document.createElement('a');
    block.href = url;
    block.target = '_blank';

    block.className = 'message-block p-0-5';
    block.dataset.id = id;
    block.style.cssText = 'opacity: 0; transform: translateY(-10px); transition: all 0.2s ease;';

    const item = document.createElement('div');
    item.className = 'message-item g-5';
    item.dataset.type = type;

    const iconEl = document.createElement('span');
    iconEl.className = `icon small ${icon}`;

    const content = document.createElement('div');
    content.className = 'message-content flex-between';

    const textEl = document.createElement('span');
    textEl.className = 'message-text t11_px';
    this.#setStatusText(textEl, text, textParts);
    content.appendChild(textEl);

    item.append(iconEl, content);

    if (closable) {
      item.appendChild(this.#createCloseButton(block));
    }

    block.appendChild(item);
    return block;
  }

  #createCloseButton(block) {
    const closeBtn = document.createElement('button');
    const closeIcon = document.createElement('div');

    closeBtn.className = 'btn app-btn small glass-panel flex-center';
    closeBtn.style.cssText = 'background: var(--accent-glass);';
    closeIcon.className = 'icon ic_cross';
    closeBtn.append(closeIcon);

    closeBtn.addEventListener('click', () => this.hideStatus(block), { once: true });
    return closeBtn;
  }

  #updateStatusBlock(block, { id, text, textParts, icon, url, type }) {
    block.href = url;
    block.target = '_blank';

    const item = block.querySelector('.message-item');
    const iconEl = block.querySelector('.icon');
    const textEl = block.querySelector('.message-text');

    if (item) {
      item.dataset.id = id;
      item.dataset.type = type;
    }
    if (iconEl) iconEl.className = `icon small ${icon}`;
    if (textEl) this.#setStatusText(textEl, text, textParts);
  }

  #setStatusText(element, text, textParts) {
    element.replaceChildren();

    if (!textParts?.length) {
      element.textContent = text;
      return;
    }

    textParts.forEach(({ text: partText, i18nKey }) => {
      const part = document.createElement('span');
      if (i18nKey) part.dataset.i18n = i18nKey;
      part.textContent = partText;
      element.appendChild(part);
    });
  }

  // ==========================================================================
  // PRIVATE — toast
  // ==========================================================================
  #createToastElement({ text, icon, type, id }) {
    const toast = document.createElement('div');
    toast.className = 'toast-msg glass-panel g-8 flex-center';
    toast.dataset.type = type;
    toast.dataset.id = id;

    if (icon) {
      const iconEl = document.createElement('span');
      iconEl.className = `icon ${icon}`;
      toast.appendChild(iconEl);
    }

    const textEl = document.createElement('span');
    textEl.className = 'toast-text';
    textEl.textContent = text;
    toast.appendChild(textEl);

    return toast;
  }

  #updateToast(id, { text, icon, type, emotional }) {
    const { element } = this.#activeToasts.get(id);
    const iconEl = element.querySelector('.icon');
    const textEl = element.querySelector('.toast-text');

    if (element) {
      element.dataset.type = type;
      element.classList.add('show');
    }
    if (iconEl) iconEl.className = `icon ${icon}`;
    if (textEl) textEl.textContent = emotional ? this.#addEmotionalEnding(text) : text;
  }

  #addEmotionalEnding(text) {
    const endings = ['!', '>:(', '😤', '💢', '🤬', '!! 😠', '😡💥'];
    const randomEnding = endings[Math.floor(Math.random() * endings.length)];
    return `${text} ${randomEnding}`;
  }
}
