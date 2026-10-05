import { CONSTANTS } from '../config/constants.js';
import { Utils } from '../utils/utils.js';
import { DialogView } from '../view/dialogView.js';
import { renderAbout } from '../view/templates/aboutTemplate.js';
import { renderPermissions } from '../view/templates/permissionsTemplate.js';
import { renderSupport } from '../view/templates/supportTemplate.js';
import { renderBugReportStep } from '../view/templates/bugReportTemplate.js';
import { renderTimerSettings, renderTimerSummary } from '../view/templates/timerSettingsTemplate.js';
import { renderCrypto } from '../view/templates/cryptoTemplate.js';

// ============================================================================
// МЕНЕДЖЕР ДІАЛОГІВ
// Відповідає ВИКЛЮЧНО за логіку: які кроки показувати, як валідувати поля,
// що робити при сабміті. Весь рендеринг і робота з DOM делеговані у DialogView.
// ============================================================================
export class DialogManager {
  #view;

  constructor(dom, cacheManager, messageManager, i18n) {
    this.cacheManager = cacheManager;
    this.messageManager = messageManager;
    this.i18n = i18n;

    this.onCheckUpdate = null;

    this.#view = new DialogView(dom);
    this.#view.setBaseActionHandler((action) => {
      if (action === 'checkUpdate') this.onCheckUpdate?.();
    });
  }

  updateVersionState({ css, icon, text }) {
    const el = this.#view.query('#versionState');
    if (!el) return;

    const iconEl = el.querySelector('.icon');
    const textEl = el.querySelector('.version-state-text');
    if (!iconEl || !textEl) return;

    el.className = `t11_px flex-center g-5 flex version-state ${css}`;
    iconEl.className = `icon small ${icon}`;
    textEl.textContent = text;
  }
  // ---------------------------------------------------------------------
  // Проксі до візуального шару (щоб не ламати зовнішній API класу)
  // ---------------------------------------------------------------------

  showDialog() {
    this.#view.showDialog();
  }

  closeDialog() {
    this.#view.closeDialog();
  }

  updateTitle(title) {
    this.#view.updateTitle(title);
  }

  updateContent(content, isHTML = false) {
    this.#view.updateContent(content, isHTML);
  }

  updateDialog(title, content, isHTML = false) {
    this.#view.updateDialog(title, content, isHTML);
  }

  appendFooter(content = null) {
    this.#view.appendFooter(content);
  }

  removeFooter() {
    this.#view.removeFooter();
  }

  replaceFooter(content) {
    this.#view.replaceFooter(content);
  }

  #handleAboutClick(e, info) {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;

    switch (actionEl.dataset.action) {
      case 'clearCache':
        this.#handleClearCache(actionEl);
        break;
      case 'showPermissions':
        this.showPermissions({
          hostPermissions: info.hostPermissions,
          permissions: info.permissions
        });
        break;
    }
  }

  async #handleSupportClick(e) {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;

    switch (actionEl.dataset.action) {
      case 'showCrypto':
        this.showCrypto(actionEl.dataset.type);
        break;

      case 'copyAddress': {
        const success = await Utils.copyStaticText(actionEl.dataset.address);

        if (success) {
          this.#toast(this.i18n.get('dialogCopySuccess'), 'success', 'ic_check', 3000);
        } else {
          this.#toast(this.i18n.get('dialogCopyFailure'), 'error', 'ic_error', 3000);
        }

        break;
      }
    }
  }

  async #handleClearCache(cacheBtn) {
    const { success, removed } = await Utils.sendMessage({ action: 'clearAllCache' });
    if (!success) return;

    const cache = await Utils.getStorageSize();
    cacheBtn.querySelector('.cache-info').innerText = this.i18n.formatBytes(cache.bytes);

    this.#toast(`${this.i18n.get('dialogCacheCleared')} (${removed})`, 'success', 'ic_check', 2000);
  }

  // ---------------------------------------------------------------------
  // Спільні хелпери логіки
  // ---------------------------------------------------------------------

  #toast(text, type, icon, duration = 3000, emotional = false) {
    return this.messageManager?.showToast({ text, type, icon, duration, emotional });
  }

  #hideToast(toastId) {
    if (toastId) this.messageManager?.hideToast(toastId);
  }

  /**
   * Виконує асинхронну дію кнопки з блокуванням на час запиту.
   * Сама відновлює кнопку і показує тост у разі помилки.
   * Повертає true при успіху, false при помилці (щоб викликач міг скинути свій прапор isSubmitting).
   */
  async #runButtonAction(btn, { loadingText, idleText, action, errorPrefix }) {
    btn.disabled = true;
    btn.innerHTML = loadingText;

    try {
      await action();
      return true;
    } catch (error) {
      this.#toast(`${errorPrefix}: ${error.message || this.i18n.get('dialogTryAgain')}`, 'error', 'ic_error', 5000, true);
      console.error(errorPrefix, error);

      btn.disabled = false;
      btn.innerHTML = idleText;
      return false;
    }
  }

  // ---------------------------------------------------------------------
  // About dialog
  // ---------------------------------------------------------------------

  showAbout(info) {
    this.#view.updateDialog(this.i18n.get('dialogAboutTitle'), renderAbout(info, this.i18n), true);
    this.#view.attachStepHandler((e) => this.#handleAboutClick(e, info));
    this.#view.showDialog();
  }

  // ---------------------------------------------------------------------
  // Permission dialog
  // ---------------------------------------------------------------------

  showPermissions({ hostPermissions, permissions }) {
    this.#view.updateDialog(
      this.i18n.get('dialogPermissionsTitle'),
      renderPermissions({ hostPermissions, permissions }, this.i18n),
      true,
      false,
      true
    );
    this.#view.showDialog();
  }

  // ---------------------------------------------------------------------
  // Support dialog
  // ---------------------------------------------------------------------

  showSupport() {
    this.#view.updateDialog(
      this.i18n.get('dialogSupportTitle'),
      renderSupport(CONSTANTS.OWNER, this.i18n),
      true
    );
    this.#view.attachStepHandler((e) => this.#handleSupportClick(e));
    this.#view.showDialog();
  }

  // ---------------------------------------------------------------------
  // Crypto dialog
  // ---------------------------------------------------------------------
  showCrypto(type) {
    const option = CONSTANTS.CRYPTO_OPTIONS[type];

    if (!option) {
      console.warn(`unknown crypto type: ${type}`);
      return;
    }

    this.#view.updateDialog(
      this.i18n.get(`dialogCryptoTitle${type.toUpperCase()}`),
      renderCrypto(option.adress, option.qrcode, this.i18n),
      true,
      false,
      true
    );
    this.#view.showDialog();
  }


  // ---------------------------------------------------------------------
  // Bug report dialog (2-step wizard)
  // ---------------------------------------------------------------------

  showBugReport(onSubmit) {
    const saved = ['', ''];
    let isSubmitting = false;

    const mkValidation = ({ requiredMsg, min, minMsg, max, maxMsg }) => ({
      required: true,
      minLength: min,
      maxLength: max,
      messages: { required: requiredMsg, minLength: minMsg, maxLength: maxMsg }
    });

    const steps = [
      {
        fieldId: 'bug-message',
        title: 'dialogBugProblemTitle',
        hint: 'dialogBugProblemHint',
        placeholder: 'dialogBugProblemPlaceholder',
        validation: mkValidation({
          requiredMsg: this.i18n.get('dialogBugProblemRequired'),
          min: 10,
          minMsg: this.i18n.get('dialogBugMin10'),
          max: 500,
          maxMsg: this.i18n.get('dialogBugProblemTooLong')
        }),

        footer: {
          left: {
            action: 'cancel-bug',
            text: this.i18n.get('dialogCancel'),
            variant: 'cancel-btn',
            title: this.i18n.get('dialogCancel')
          },

          right: {
            action: 'forward-bug',
            text: this.i18n.get('dialogNext'),
            variant: 'forward-btn',
            icon: 'right',
            title: this.i18n.get('dialogNext')
          }
        }
      },

      {
        fieldId: 'bug-stack',
        title: 'dialogBugStepsTitle',
        hint: 'dialogBugStepsHint',
        placeholder: 'dialogBugStepsPlaceholder',

        validation: mkValidation({
          requiredMsg: this.i18n.get('dialogBugStepsRequired'),
          min: 30,
          minMsg: this.i18n.get('dialogBugMin30'),
          max: 1000,
          maxMsg: this.i18n.get('dialogBugStepsTooLong')
        }),

        footer: {
          left: {
            action: 'back-bug',
            text: this.i18n.get('dialogBack'),
            variant: 'back-btn',
            icon: 'left',
            title: this.i18n.get('dialogBack')
          },

          right: {
            action: 'send-bug',
            text: this.i18n.get('dialogSend'),
            title: this.i18n.get('dialogSend')
          }
        }
      }
    ];

    const validateField = (field, validation) => {
      const value = field.value.trim();
      if (!value && validation.required) return validation.messages.required;
      if (validation.minLength && value.length < validation.minLength) return validation.messages.minLength;
      if (validation.maxLength && value.length > validation.maxLength) return validation.messages.maxLength;
      return null;
    };

    const renderStep = (index) => {
      const step = steps[index];
      const { fieldId, footer, validation } = step
      this.#view.updateDialog(
        this.i18n.get('dialogBugReportTitle'),
        renderBugReportStep(step, this.i18n),
        true,
        true
      );


      this.#view.replaceFooter(this.#view.buildFooterButtons(footer));
      this.#view.showDialog();

      const field = this.#view.query(`#${fieldId}`);
      const counter = this.#view.query(`[data-field="${fieldId}"].char-counter`);

      if (saved[index]) field.value = saved[index];

      const updateCounter = () => {
        const len = field.value.length;
        if (counter) {
          counter.textContent = `${len}/${validation.maxLength}`;
          counter.classList.toggle('warning', len > validation.maxLength * 0.9);
          counter.classList.toggle('error', len > validation.maxLength);
        }
        Utils.clearErrorTextarea(field);
      };

      field.addEventListener('input', updateCounter);
      updateCounter();

      const handler = async (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        const action = btn.dataset.action;

        if (action === 'cancel-bug') {
          this.#view.closeDialog();
          this.#toast(this.i18n.get('dialogBugCancelled'), 'info', 'ic_info', 2000);
          return;
        }

        if (action === 'back-bug') {
          saved[index] = field.value.trim();
          renderStep(0);
          return;
        }

        const validationError = validateField(field, validation);
        if (validationError) {
          this.#toast(validationError, 'error', 'ic_error', 2500, true);
          Utils.setErrorTextarea(field);
          field.focus();
          return;
        }

        if (action === 'forward-bug') {
          saved[index] = field.value.trim();
          renderStep(1);
          return;
        }

        if (action === 'send-bug') {
          if (isSubmitting) return;
          isSubmitting = true;
          const provider = this.cacheManager.getActiveProvider();

          const reportData = {
            error: saved[0],
            stack: field.value.trim(),
            provider: provider,
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            screen: `${screen.width}x${screen.height}`,
            version: chrome.runtime.getManifest().version,
            timestamp: new Date().toISOString()
          };

          const sendingToastId = this.#toast(this.i18n.get('dialogBugSending'), 'info', null, 10000);

          const ok = await this.#runButtonAction(btn, {
            loadingText: this.i18n.get('dialogBugSending'),
            idleText: this.i18n.get('dialogSend'),
            errorPrefix: this.i18n.get('dialogBugSendError'),
            action: () => onSubmit?.(reportData)
          });

          this.#hideToast(sendingToastId);

          if (ok) {
            this.#toast(this.i18n.get('dialogBugSent'), 'success', 'ic_check', 4000);
            this.#view.closeDialog();
          } else {
            isSubmitting = false;
          }
        }
      };

      this.#view.attachStepHandler(handler);
    };

    renderStep(0);
  }

  // ---------------------------------------------------------------------
  // Timer settings dialog
  // ---------------------------------------------------------------------

  /**
 * Показує діалог налаштування таймера сповіщень.
 *
 * @param {{delay:number, frequency:number, enabled:boolean}} currentSettings
 *   Поточні значення у хвилинах.
 * @param {(settings:{enabled:boolean, delay:number, frequency:number}) => Promise<void>|void} onSave
 *   Викликається з новими налаштуваннями після підтвердження.
 */
  showTimerSettings(currentSettings = {}, onSave) {
    let isSubmitting = false;
    const enabled = currentSettings.enabled ?? false;

    const numberFields = [
      { id: 'timer-delay', label: 'dialogTimerRemindBefore', span: 'dialogTimerUntilStart', min: 1, max: 180, value: currentSettings.delay ?? 30 },
      { id: 'timer-frequency', label: 'dialogTimerInterval', span: 'dialogTimerBetweenNotifications', min: 1, max: 180, value: currentSettings.frequency ?? 15 }
    ];

    const initialDelay = currentSettings.delay ?? 30;
    const initialFrequency = currentSettings.frequency ?? 15;
    const initialCount = Math.max(1, Math.ceil(initialDelay / initialFrequency)) + 1;

    // ---- Рендер тіла та футера через темплейти ----

    this.#view.updateDialog(
      this.i18n.get('dialogTimerTitle'),
      renderTimerSettings({ enabled, numberFields }, this.i18n),
      true,
      true
    );

    const footer = {
      info: {
        action: 'showInfo',
        content: renderTimerSummary({ count: initialCount, delay: initialDelay, frequency: initialFrequency }, this.i18n)
      },
      left: {
        action: 'cancel-timer',
        text: this.i18n.get('dialogCancel'),
        variant: 'cancel-btn',
        title: this.i18n.get('dialogCancel')
      },
      right: {
        action: 'save-timer',
        text: this.i18n.get('dialogSave'),
        title: this.i18n.get('dialogSave')
      }
    };
    this.#view.replaceFooter(this.#view.buildFooterButtons(footer));
    this.#view.showDialog();

    // ---- DOM-посилання ----

    const enabledCheckbox = this.#view.query('#notification-enabled');
    const enabledLabel = this.#view.query('.custom-checkbox');
    const inputs = numberFields.map(f => this.#view.query(`#${f.id}`));

    // ---- Логіка стану (без змін) ----

    const updateSummary = () => {
      const summaryEl = this.#view.query('#notification-summary');
      if (!summaryEl) return;

      const delay = parseInt(inputs[0].value, 10) || 0;
      const freq = parseInt(inputs[1].value, 10) || 1;
      const count = Math.max(1, Math.ceil(delay / freq)) + 1;

      summaryEl.querySelector('#summary-count').textContent = count;
      summaryEl.querySelector('#summary-delay').textContent = `${delay} ${this.i18n.get('dialogTimerMinutes')}`;
      summaryEl.querySelector('#summary-frequency').textContent = `${freq} ${this.i18n.get('dialogTimerMinutes')}`;
    };

    const applyEnabledState = () => {
      const isEnabled = enabledCheckbox.checked;
      inputs.forEach((input) => {
        input.disabled = !isEnabled;
        input.closest('.settings-item').classList.toggle('disabled', !isEnabled);
        input.closest('.settings-section').classList.toggle('disabled', !isEnabled);
        if (!isEnabled) input.classList.remove('error');
      });
      updateSummary();
    };

    enabledLabel.addEventListener('click', (e) => {
      e.preventDefault();
      enabledCheckbox.checked = !enabledCheckbox.checked;
      applyEnabledState();
    });

    inputs.forEach((input) => {
      input.addEventListener('input', () => {
        input.classList.remove('error');
        updateSummary();
      });
    });

    const validateInputs = () => {
      if (!enabledCheckbox.checked) {
        return { enabled: false, delay: Number(inputs[0].value), frequency: Number(inputs[1].value) };
      }

      for (let i = 0; i < numberFields.length; i++) {
        const { label, min, max } = numberFields[i];
        const input = inputs[i];
        const raw = input.value.trim();
        const num = Number(raw);

        input.classList.remove('error');

        if (raw === '' || Number.isNaN(num) || !Number.isInteger(num)) {
          const message = this.i18n.get('dialogTimerIntegerRequired').replace('{label}', this.i18n.get(label));
          this.#toast(message, 'error', 'ic_error', 2500);
          input.classList.add('error');
          input.focus();
          return null;
        }
        if (num < min || num > max) {
          const message = this.i18n.get('dialogTimerValueRange')
            .replace('{label}', this.i18n.get(label))
            .replace('{min}', min)
            .replace('{max}', max);
          this.#toast(message, 'error', 'ic_error', 2500);
          input.classList.add('error');
          input.focus();
          return null;
        }
      }

      return {
        enabled: true,
        delay: Number(inputs[0].value),
        frequency: Number(inputs[1].value)
      };
    };

    const handler = async (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;

      if (action === 'cancel-timer') {
        this.#view.closeDialog();
        this.#toast(this.i18n.get('dialogTimerCancelled'), 'info', 'ic_info', 2000);
        return;
      }

      if (action === 'save-timer') {
        if (isSubmitting) return;

        const settings = validateInputs();
        if (!settings) return;

        isSubmitting = true;

        const ok = await this.#runButtonAction(btn, {
          loadingText: this.i18n.get('dialogTimerSaving'),
          idleText: this.i18n.get('dialogSave'),
          errorPrefix: this.i18n.get('dialogTimerSaveError'),
          action: () => onSave?.(settings)
        });

        if (ok) {
          this.#toast(this.i18n.get('dialogTimerSaved'), 'success', 'ic_check', 3000);
          this.#view.closeDialog();
        } else {
          isSubmitting = false;
        }
      }
    };

    this.#view.attachStepHandler(handler);
  }
}
