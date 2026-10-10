import { Utils } from './utils/utils.js';

import { DOMElements } from './dom/domElements.js';
import { CacheManager } from './managers/cacheManager.js';
import { NotificationView } from './view/notificationView.js';
import { DialogManager } from './managers/dialogManager.js';
import { VersionManager } from './managers/versionManager.js';
import { DateManager } from './managers/dateManager.js';
import { SelectManager } from './managers/selectManager.js';
import { InputManager } from './managers/inputManager.js';
import { DataManager } from './managers/dataManager.js';
import { RefreshManager } from './managers/refreshManager.js';
import { MainPopupManager } from './managers/mainPopupManager.js';
import { LanguagePopupManager } from './managers/languagePopupManager.js';
import { I18n } from './core/i18n.js';

// ============================================================================
// ГОЛОВНИЙ ДОДАТОК
// ============================================================================
export class App {
  constructor() {
    this.dom = new DOMElements();
    requestAnimationFrame(() => requestAnimationFrame(() => this.init()));
  }

  async init() {
    const { dom } = this;

    this.i18n = new I18n();
    await this.i18n.init();

    this.cacheManager = new CacheManager();
    await this.cacheManager.load();

    this.dialogManager = new DialogManager(
      dom,
      this.cacheManager,
      this.i18n
    );
    this.versionManager = new VersionManager(this.dialogManager, this.i18n);
    this.dateManager = new DateManager(dom, this.i18n, () => this.dataManager.loadData());
    this.notificationView = new NotificationView(dom, this.i18n);

    const onSelectionChange = (type) => {
      if (type === 'dsoId') {
        const { dsoId } = this.selectManager.getValues();

        if (Utils.isInvalidValue(dsoId)) this.inputManager.removeInputs();
        else this.inputManager.renderInputs();
      }

      this.dataManager.loadData();
    };

    this.selectManager = new SelectManager(
      dom,
      this.i18n,
      this.cacheManager,
      onSelectionChange
    );

    this.inputManager = new InputManager(
      dom,
      this.cacheManager,
      this.i18n,
      async (g) => {
        await this.selectManager.setAndSaveValue('queue', g);
        await this.dataManager.loadData();
      }
    );

    this.dataManager = new DataManager(
      dom,
      this.cacheManager,
      this.i18n,
      this.selectManager,
      this.dateManager
    );

    const onProviderChange = async (provider) => {
      await Utils.sendMessage({ action: 'clearTableCache' });
      await this.cacheManager.setActiveProvider(provider);
      this.selectManager.setProvider(provider);
      this.dataManager.loadData();
    }

    this.mainPopupManager = new MainPopupManager(
      dom,
      this.dialogManager,
      this.i18n,
      this.cacheManager,
      onProviderChange
    );

    this.languagePopupManager = new LanguagePopupManager(
      dom,
      this.i18n
    );
    this.refreshManager = new RefreshManager(
      dom,
      this.cacheManager,
      this.i18n,
      async () => {
        await this.dataManager.loadData();
        this.dateManager.updateDateNumbers();
        this.dateManager.updateIndicator();
      }
    );

    this.selectManager.init();
    this.mainPopupManager.init();
    this.languagePopupManager.init();
    this.notificationView.init();

    this.i18n.localize();
  }
}
