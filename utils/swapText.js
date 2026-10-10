// ============================================================================
// ТЕКСТ З АНІМАЦІЄЮ ЗСУВУ
// ============================================================================
const VECTORS = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };

export class SwapText {
  #win;
  #current = null;
  #key = null;
  #widthAnim = null;

  /**
   * @param {HTMLElement} el
   * @param {object} options
   * @param {(key: string) => string} options.label  - як отримати текст за ключем
   * @param {boolean} [options.localized=false]      - true: додає data-i18n словам (для локалізатора)
   * @param {number}  [options.duration=450]
   */
  constructor(el, { label, localized = false, duration = 600 } = {}) {
    this.el = el;
    this.label = label ?? (key => key);
    this.localized = localized;
    this.duration = duration;

    el.classList.add('swap-text');
    this.#win = document.createElement('span');
    this.#win.className = 'swap-text__window';
    this.#win.style.boxSizing = 'border-box';
    el.replaceChildren(this.#win);
  }

  get direction() {
    return VECTORS[this.el.dataset.direction] ? this.el.dataset.direction : 'left';
  }

  set(key, { animate = true } = {}) {
    if (key === this.#key) return;

    const fromW = parseFloat(getComputedStyle(this.#win).width) || 0;
    this.#finish();

    const prev = this.#current;
    const next = this.#createWord(key);
    this.#win.append(next);
    this.#current = next;
    this.#key = key;

    if (!prev || !animate) {
      prev?.remove();
      return;
    }

    const [vx, vy] = VECTORS[this.direction];
    const opts = { duration: this.duration, easing: 'cubic-bezier(0.22, 1, 0.64, 1)', fill: 'forwards' };

    prev.animate([
      { transform: 'translate(0,0)' },
      { transform: `translate(${vx * 125}%, ${vy * 100}%)` }
    ], opts);

    next.animate([
      { transform: `translate(${-vx * 125}%, ${-vy * 100}%)` },
      { transform: 'translate(0,0)' }
    ], opts).onfinish = () => this.#finish();

    const toW = this.#measureFinalWidth(next);
    if (fromW > 0 && toW > 0 && fromW !== toW) {
      this.#widthAnim = this.#win.animate(
        [{ width: `${fromW}px` }, { width: `${toW}px` }],
        opts
      );
    }
  }

  refresh() {
    this.#win.querySelectorAll('.swap-text__word').forEach(w => {
      w.textContent = this.label(w.dataset.key);
    });
  }

  #frameExtra() {
    const s = getComputedStyle(this.#win);
    return ['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth']
      .reduce((sum, p) => sum + (parseFloat(s[p]) || 0), 0);
  }

  #createWord(key) {
    const s = document.createElement('span');
    s.className = 'swap-text__word';
    s.dataset.key = key;
    if (this.localized) s.dataset.i18n = key;
    s.textContent = this.label(key);
    return s;
  }

  #finish() {
    this.#win.querySelectorAll('.swap-text__word').forEach(w => {
      if (w !== this.#current) w.remove();
    });
    this.#current?.getAnimations().forEach(a => a.cancel());
    this.#widthAnim?.cancel();
    this.#widthAnim = null;
  }

  #measureFinalWidth(word) {
    const probe = this.#win.cloneNode(false);
    probe.style.cssText += ';position:absolute;visibility:hidden;pointer-events:none;width:auto;';

    const clone = word.cloneNode(true);
    clone.style.willChange = 'auto';
    probe.append(clone);

    this.el.append(probe);
    const width = parseFloat(getComputedStyle(probe).width) || 0;
    probe.remove();
    return width;
  }
}
