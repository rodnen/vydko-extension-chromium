// ============================================================================
// МЕНЕДЖЕР ПОВІДОМЛЕНЬ (статичний)
// ============================================================================
export class MessageManager {
  // --------------------------------------------------------------------------
  // Поля
  // --------------------------------------------------------------------------
  static #maxToastCount = 5;
  static #defaultDuration = 3000;
  static #activeToasts = new Map();

  static #elements = {
    header: null,
    container: null
  };

  // --------------------------------------------------------------------------
  // Конфігурація (необов'язкова)
  // --------------------------------------------------------------------------
  /**
   * Викликати лише якщо хедер не є першим <header> на сторінці.
   * MessageManager.configure({ header: document.querySelector('#my-header') });
   */
  static configure({ header } = {}) {
    if (header) MessageManager.#elements.header = header;
  }

  // ==========================================================================
  // PUBLIC API — статус у хедері
  // ==========================================================================
  static showUpdateStatus({
    text = '',
    textParts = null,
    icon = 'ic_info',
    url = null,
    type = 'info',
    id = 'update-status'
  } = {}) {
    const header = MessageManager.#getHeader();
    if (!header) return null;

    const host = MessageManager.#getStatusHost();
    host.classList.add('flex-center', 'g-5');
    let block = MessageManager.#findStatusBlock(id);

    if (block) {
      MessageManager.#updateStatusBlock(block, { id, text, textParts, icon, url, type });
      MessageManager.#revealStatusBlock(block);
      return block;
    }

    block = MessageManager.#createStatusBlock({ text, textParts, icon, url, type, id, closable: false });
    host.append(block);
    requestAnimationFrame(() => MessageManager.#revealStatusBlock(block));
    return block;
  }

  static hideStatus(block) {
    if (!block) return;

    block.style.opacity = '0';
    block.style.transform = 'translateY(-10px)';

    block.addEventListener('transitionend', () => {
      block.remove();
      const host = MessageManager.#getStatusHost();
      // Прибираємо класи лише коли в хості не залишилось інших статусів
      if (host && !host.querySelector('.message-block')) {
        host.classList.remove('flex-center', 'g-5');
      }
    }, { once: true });
  }

  static clearStatuses() {
    const header = MessageManager.#getHeader();
    if (!header) return;
    header
      .querySelectorAll('.message-block')
      .forEach(block => MessageManager.hideStatus(block));
  }

  // ==========================================================================
  // PUBLIC API — toast
  // ==========================================================================
  static toast({
    text = '',
    icon = 'ic_info',
    type = 'info',
    id = null,
    duration = MessageManager.#defaultDuration,
    emotional = false
  } = {}) {
    const container = MessageManager.#getContainer();

    if (id && MessageManager.#activeToasts.has(id)) {
      MessageManager.#updateToast(id, { text, icon, type, emotional });
      return id;
    }

    if (MessageManager.#activeToasts.size >= MessageManager.#maxToastCount) {
      const oldestId = MessageManager.#activeToasts.keys().next().value;
      MessageManager.hideToast(oldestId);
    }

    const toastId = id ?? `toast-${Date.now()}-${Math.random()}`;

    const messageText = emotional && MessageManager.#activeToasts.size >= 1
      ? MessageManager.#addEmotionalEnding(text)
      : text;

    const toast = MessageManager.#createToastElement({
      text: messageText,
      icon,
      type,
      id: toastId
    });

    container.appendChild(toast);

    // duration: Infinity — тост не зникає сам, закрити можна лише через hideToast(id)
    const timerId = Number.isFinite(duration)
      ? setTimeout(() => MessageManager.hideToast(toastId), duration)
      : null;

    MessageManager.#activeToasts.set(toastId, { element: toast, timerId });

    requestAnimationFrame(() => toast.classList.add('show'));

    return toastId;
  }

  static hideToast(id) {
    const toastData = MessageManager.#activeToasts.get(id);
    if (!toastData) return;

    const { element, timerId } = toastData;
    if (timerId) clearTimeout(timerId);

    // Видаляємо з Map одразу: повторний hideToast не спрацює двічі,
    // а тост, що вже зникає, не займає місце в ліміті
    MessageManager.#activeToasts.delete(id);

    element.classList.remove('show');
    element.addEventListener('transitionend', () => element.remove(), { once: true });

    // Страховка на випадок, якщо transitionend не спрацює
    setTimeout(() => element.remove(), 500);
  }

  static clearAllToasts() {
    [...MessageManager.#activeToasts.keys()]
      .forEach(id => MessageManager.hideToast(id));
  }

  // ==========================================================================
  // PRIVATE — ліниве отримання DOM-елементів
  // ==========================================================================
  static #getHeader() {
    const els = MessageManager.#elements;
    if (!els.header?.isConnected) {
      els.header = document.querySelector('header');
    }
    return els.header;
  }

  static #getStatusHost() {
    const header = MessageManager.#getHeader();
    return header?.querySelector('.app-name') ?? header;
  }

  static #getContainer() {
    const els = MessageManager.#elements;
    if (els.container?.isConnected) return els.container;

    let container = document.querySelector('.validator-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'validator-container z-999 flex-col-rev flex-center g-10';
      document.body.appendChild(container);
    }
    els.container = container;
    return container;
  }

  // ==========================================================================
  // PRIVATE — статус у хедері
  // ==========================================================================
  static #findStatusBlock(id) {
    return MessageManager.#getHeader()
      ?.querySelector(`.message-block[data-id="${id}"]`);
  }

  static #revealStatusBlock(block) {
    block.style.opacity = '1';
    block.style.transform = 'translateY(0)';
  }

  static #createStatusBlock({ text, textParts, icon, type, url, id, closable }) {
    const block = document.createElement('a');
    if (url) {
      block.href = url;
      block.target = '_blank';
    }

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
    MessageManager.#setStatusText(textEl, text, textParts);
    content.appendChild(textEl);

    item.append(iconEl, content);

    if (closable) {
      item.appendChild(MessageManager.#createCloseButton(block));
    }

    block.appendChild(item);
    return block;
  }

  static #createCloseButton(block) {
    const closeBtn = document.createElement('button');
    const closeIcon = document.createElement('div');

    closeBtn.className = 'btn app-btn small glass-panel flex-center';
    closeBtn.style.cssText = 'background: var(--accent-glass);';
    closeIcon.className = 'icon ic_cross';
    closeBtn.append(closeIcon);

    closeBtn.addEventListener('click', () => MessageManager.hideStatus(block), { once: true });
    return closeBtn;
  }

  static #updateStatusBlock(block, { id, text, textParts, icon, url, type }) {
    if (url) {
      block.href = url;
      block.target = '_blank';
    } else {
      block.removeAttribute('href');
      block.removeAttribute('target');
    }

    const item = block.querySelector('.message-item');
    const iconEl = block.querySelector('.icon');
    const textEl = block.querySelector('.message-text');

    if (item) {
      item.dataset.id = id;
      item.dataset.type = type;
    }
    if (iconEl) iconEl.className = `icon small ${icon}`;
    if (textEl) MessageManager.#setStatusText(textEl, text, textParts);
  }

  static #setStatusText(element, text, textParts) {
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
  static #createToastElement({ text, icon, type, id }) {
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

  static #updateToast(id, { text, icon, type, emotional }) {
    const { element } = MessageManager.#activeToasts.get(id);
    const iconEl = element.querySelector('.icon');
    const textEl = element.querySelector('.toast-text');

    element.dataset.type = type;
    element.classList.add('show');

    if (iconEl) iconEl.className = `icon ${icon}`;
    if (textEl) {
      textEl.textContent = emotional
        ? MessageManager.#addEmotionalEnding(text)
        : text;
    }
  }

  static #addEmotionalEnding(text) {
    const endings = ['!', '>:(', '😤', '💢', '🤬', '!! 😠', '😡💥'];
    const randomEnding = endings[Math.floor(Math.random() * endings.length)];
    return `${text} ${randomEnding}`;
  }
}
