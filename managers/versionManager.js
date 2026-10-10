import { CONSTANTS } from '../config/constants.js';
import { Utils } from '../utils/utils.js';
import { getUpdateStateMeta } from '../utils/updateState.js';
import { MessageManager } from './messageManager.js';

export class VersionManager {
  constructor(dialogManager, i18n) {
    this.dialogManager = dialogManager;
    this.i18n = i18n;

    this.init();
  }

  init() {
    this.dialogManager.onCheckUpdate = () => this.manualCheck();
    this.autoCheck();
  }

  async #getRateLimitCooldownLeft() {
    const until =
      (await Utils.getStorageValue(CONSTANTS.RATE_LIMIT_UNTIL_KEY)) || 0;

    return Math.max(0, until - Date.now());
  }

  async #syncStateWithCurrentVersion() {
    const { [CONSTANTS.LATEST_VER_KEY]: latestVer,
      [CONSTANTS.UPDATE_STATE_KEY]: updateState } =
      await Utils.getStorageData([CONSTANTS.LATEST_VER_KEY, CONSTANTS.UPDATE_STATE_KEY]);

    const actualState = Utils.semverCompare(CONSTANTS.APP_VERSION, latestVer)

    if (actualState !== undefined && actualState !== updateState) {
      await Utils.setStorageData({ [CONSTANTS.UPDATE_STATE_KEY]: actualState });
    }

    return actualState ?? updateState;
  }

  #t(key, values = {}) {
    return Object.entries(values).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
      this.i18n.get(key)
    );
  }

  #showUpdateMessage(latestVer, pendingUpdateUrl) {
    if (!latestVer || !pendingUpdateUrl) return;

    MessageManager.showUpdateStatus({
      id: 'update',
      type: 'update',
      icon: 'ic_arrows_reload',
      url: pendingUpdateUrl,
      textParts: [
        {
          text: this.i18n.get('versionAvailableMessage'),
          i18nKey: 'versionAvailableMessage'
        },
        { text: String(latestVer) }
      ]
    });
  }

  async autoCheck() {
    const updateState = await this.#syncStateWithCurrentVersion();
    const cooldownLeft = await this.#getRateLimitCooldownLeft();

    if (cooldownLeft > 0) return;
    const now = Date.now();

    const lastCheck = (await Utils.getStorageValue(CONSTANTS.LAST_CHECK_KEY)) || 0;
    const latestVer = await Utils.getStorageValue(CONSTANTS.LATEST_VER_KEY);
    const zipUrl = await Utils.getStorageValue(CONSTANTS.ZIP_URL_KEY);

    if (!lastCheck || updateState === undefined) {
      await this.performCheck(false);
      return;
    }

    if (now - lastCheck < CONSTANTS.CHECK_INTERVAL) {
      if (updateState === -1) {
        this.#showUpdateMessage(latestVer, zipUrl);
      }
      return;
    }

    await this.performCheck(false);
  }

  async manualCheck() {
    await this.performCheck(true);
  }

  async performCheck(showResult = false) {
    const cooldownLeft = await this.#getRateLimitCooldownLeft();

    if (cooldownLeft > 0) {
      if (showResult) {
        const mins = Math.ceil(cooldownLeft / 60000);
        const text = this.#t('versionRateLimit', { minutes: mins });

        this.dialogManager.updateVersionState({
          css: 'state-warning',
          icon: 'ic_warning',
          text
        });
        MessageManager.toast({ text, type: 'warning', icon: 'ic_warning' });
      }

      return;
    }

    let response;

    try {
      response = await Utils.sendMessage({
        action: 'checkUpdate',
        owner: CONSTANTS.OWNER,
        repo: CONSTANTS.REPO
      });
    } catch (error) {
      console.error('Update check request failed:', error);

      if (showResult) {
        const text = this.#t('versionCheckErrorReason', {
          reason: error.message || this.i18n.get('dialogTryAgain')
        });

        this.dialogManager.updateVersionState({
          css: 'state-error',
          icon: 'ic_error',
          text
        });
        MessageManager.toast({
          text,
          type: 'error',
          icon: 'ic_error',
          duration: 5000,
          emotional: true
        });
      }

      return;
    }

    const result = response?.result;

    if (!result) {
      console.error('Update check error: empty response');

      if (showResult) {
        const text = this.i18n.get('versionCheckError');

        this.dialogManager.updateVersionState({
          css: 'state-error',
          icon: 'ic_error',
          text
        });
        MessageManager.toast({
          text,
          type: 'error',
          icon: 'ic_error',
          duration: 5000,
          emotional: true
        });
      }

      return;
    }

    if (result.rateLimited) {
      const resetAt =
        result.resetAt ??
        (Date.now() + CONSTANTS.RATE_LIMIT_COOLDOWN);

      await Utils.setStorageData({
        [CONSTANTS.RATE_LIMIT_UNTIL_KEY]: resetAt
      });

      if (showResult) {
        const mins = Math.ceil(
          Math.max(0, resetAt - Date.now()) / 60000
        );
        const text = this.#t('versionRateLimit', { minutes: mins });

        this.dialogManager.updateVersionState({
          css: 'state-warning',
          icon: 'ic_warning',
          text
        });
        MessageManager.toast({ text, type: 'warning', icon: 'ic_warning' });
      }

      return;
    }

    if (!result.success) {
      console.error('Update check error:', result);

      if (showResult) {
        const text = this.#t('versionCheckErrorReason', {
          reason: result.error || this.i18n.get('dialogTryAgain')
        });

        this.dialogManager.updateVersionState({
          css: 'state-error',
          icon: 'ic_error',
          text
        });
        MessageManager.toast({
          text,
          type: 'error',
          icon: 'ic_error',
          duration: 5000,
          emotional: true
        });
      }

      return;
    }

    const cmp = Number(result.cmp);
    const latestVer = result.latestVer;
    const zipUrl = result.zipUrl;

    await Utils.setStorageData({
      [CONSTANTS.LAST_CHECK_KEY]: Date.now(),
      [CONSTANTS.UPDATE_STATE_KEY]: cmp,
      [CONSTANTS.LATEST_VER_KEY]: latestVer,
      [CONSTANTS.RATE_LIMIT_UNTIL_KEY]: 0
    });

    if (cmp === -1) {
      this.#showUpdateMessage(latestVer, zipUrl);
    }

    if (showResult) {
      const meta = getUpdateStateMeta(cmp, latestVer, this.i18n);
      this.dialogManager.updateVersionState(meta);

      MessageManager.toast({
        text: meta.text,
        icon: meta.icon,
        type: 'info'
      });
    }
  }
}
