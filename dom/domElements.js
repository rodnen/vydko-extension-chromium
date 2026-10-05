// ============================================================================
// DOM ЕЛЕМЕНТИ
// ============================================================================
export class DOMElements {
  constructor() {
    this.header = document.querySelector('header');
    this.box = document.getElementById('content-box');
    this.footer = document.querySelector('footer');

    this.controls = document.getElementById('controls');
    this.contentWrapper = document.getElementById('content-wrapper');
    this.queueSelect = document.querySelector('.queue-select');
    this.dsoSelect = document.querySelector('.dso-select');
    this.versionContainer = document.getElementById('version');

    this.dateGroup = document.getElementById('date-group');

    this.dotsBtn = document.querySelector('[data-action="openMenu"]');
    this.mainPopupMenu = document.querySelector('#main-popup-menu');

    this.refreshBtn = document.querySelector('button[data-action="refresh"]');
    this.providerBtn = this.mainPopupMenu?.querySelector('[data-action="provider"]');
    this.themeBtn = this.mainPopupMenu?.querySelector('[data-action="theme"]');
    this.notificationBtn = this.mainPopupMenu?.querySelector('[data-action="notification"]');
    this.aboutBtn = this.mainPopupMenu?.querySelector('[data-action="about"]');

    this.languageBtn = document.querySelector('[data-action="openLanguage"]');
    this.languagePopupMenu = document.querySelector('#language-popup-menu');

    this.dialogWrapper = document.getElementById('dialogWrapper');
    this.dialog = document.getElementById("dialog");
    this.dialogHeader = this.dialog?.querySelector(".dialog-header");
    this.dialogTitle = this.dialog?.querySelector('.dialog-title');
    this.dialogContent = this.dialog?.querySelector('.dialog-content');

    this.currentProvider = document.getElementById('current-provider');
  }

  get dateIndicator() {
    return this.dateGroup?.querySelector('.date-indicator');
  }

  get activeDateBtn() {
    return this.dateGroup?.querySelector('.date-btn.active');
  }
}
