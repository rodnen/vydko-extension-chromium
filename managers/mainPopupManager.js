import { CONSTANTS } from '../config/constants.js';
import { Utils } from '../utils/utils.js';
import { ErrorReporter } from '../utils/reporter.js';
import { ThemeView } from '../view/themeView.js';
import { ProviderView } from '../view/providerView.js';
import { getUpdateStateMeta } from '../utils/updateState.js';
// ============================================================================
// МЕНЕДЖЕР POPUP-МЕНЮ
// ============================================================================
export class MainPopupManager {
  #themeView = null;
  #providerView = null;

  constructor(dom, dialogManager, i18n, cacheManager, onProviderChange) {
    this.dom = dom;
    this.i18n = i18n;

    this.dialogManager = dialogManager;
    this.cacheManager = cacheManager;
    this.onProviderChange = onProviderChange;

    this.#themeView = new ThemeView(dom, this.i18n);
    this.#providerView = new ProviderView(dom);

    this.errorReporter = this.#createReporter();

    this.#themeView.init();
    this.#providerView.init();
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
    const { dotsBtn, mainPopupMenu } = this.dom;
    if (!dotsBtn || !mainPopupMenu) return;

    const provider = this.cacheManager.getActiveProvider();
    const checkbox = mainPopupMenu.querySelector('#checkbox-mode');
    if (checkbox) checkbox.checked = provider === CONSTANTS.PROVIDER.DTEK;

    dotsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#closePopups(mainPopupMenu);
      mainPopupMenu.classList.toggle('active');
    });

    document.addEventListener('click', () => mainPopupMenu.classList.remove('active'));

    mainPopupMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      const item = e.target.closest('[data-action]');
      if (!item) return;

      this.handleMenuAction(item);
      if (item.classList.contains('close-at-click')) mainPopupMenu.classList.remove('active');
    });
  }

  #createReporter() {
    return new ErrorReporter({
      endpoint: "https://docs.google.com/forms/d/e/1FAIpQLScSGSLvZoB6t3RG17AS2ueH0vgCaVl5T813QQElPqkIEMXJKQ/formResponse",
      fieldsMap: {
        error: "entry.581983976",
        stack: "entry.1526738214",
        mode: "entry.1382745580",
        userAgent: "entry.1303966238",
        platform: "entry.1541979604",
        language: "entry.804086390",
        screen: "entry.698707174",
        version: "entry.1787521461"
      }
    });
  }

  async handleMenuAction(item) {
    switch (item.dataset.action) {
      case 'provider': {
        try {
          const provider = await this.#providerView.toggleProvider();
          await this.onProviderChange?.(provider);
        } catch (error) {
          console.error('Provider switch failed:', error);
        }
        break;
      }

      case 'theme':
        try {
          await this.#themeView.toggleTheme();
        } catch (error) {
          console.error('Theme switch failed:', error);
        }
        break;

      case 'notification': {
        try {
          const stored = await Utils.getStorageData([
            CONSTANTS.NOTIFICATION_ENABLED_KEY,
            CONSTANTS.NOTIFICATION_DELAY_KEY,
            CONSTANTS.NOTIFICATION_FREQUENCY_KEY
          ]);

          await this.dialogManager.showTimerSettings(
            {
              enabled: !!stored[CONSTANTS.NOTIFICATION_ENABLED_KEY],
              delay: stored[CONSTANTS.NOTIFICATION_DELAY_KEY],
              frequency: stored[CONSTANTS.NOTIFICATION_FREQUENCY_KEY]
            },
            async (data) => {
              await Utils.setStorageData({
                [CONSTANTS.NOTIFICATION_ENABLED_KEY]: data.enabled ? 1 : 0,
                [CONSTANTS.NOTIFICATION_DELAY_KEY]: data.delay,
                [CONSTANTS.NOTIFICATION_FREQUENCY_KEY]: data.frequency,
                [CONSTANTS.NOTIFICATION_STATE_KEY]: null
              });
            }
          );
        } catch (error) {
          console.error('Failed to load notification settings:', error);
        }
        break;
      }

      case 'bug-report':
        this.dialogManager.showBugReport((data) => {
          this.errorReporter.capture(data);
          this.errorReporter.flush();
        });
        break;

      case 'about':
        const [cache, info, storage, installDate] = await Promise.all([
          Utils.getStorageSize(),
          chrome.management.getSelf(),
          Utils.getStorageData([
            CONSTANTS.UPDATE_STATE_KEY,
            CONSTANTS.LATEST_VER_KEY,
          ]),
          Utils.getInstallDate(),
        ]);

        const updateState = storage[CONSTANTS.UPDATE_STATE_KEY];
        const latestVer = storage[CONSTANTS.LATEST_VER_KEY];

        const installDateMsg = installDate === undefined
          ? this.i18n.get('installDateUnknown')
          : this.i18n.formatDateOnly(installDate);

        const versionMeta = updateState !== undefined
          ? getUpdateStateMeta(updateState, latestVer, this.i18n)
          : getUpdateStateMeta(0, latestVer, this.i18n);

        const repoPage = `https://github.com/${CONSTANTS.OWNER}/${CONSTANTS.REPO}`;

        this.dialogManager.showAbout({
          version: chrome.runtime.getManifest().version,
          cache,
          shortId: Utils.shortenId(info.id),
          installDate: installDateMsg,
          versionMeta,
          repoPage: repoPage,
          ...info,
        });
        break;

      case 'support':
        this.dialogManager.showSupport();
        break;

      default:
        console.warn(`Unknown menu action: ${item.dataset.action}`);
    }
  }
}
