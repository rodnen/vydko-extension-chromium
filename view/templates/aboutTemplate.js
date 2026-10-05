export const renderAbout = (info, i18n) => {
  return `<div class="modal-wrapper p-10 g-10 flex-col">
        <div class="section-content flex-between glass-panel">
          <div class="flex-center g-10">
            <a href="${info.repoPage}" target="_blank" class="app-btn btn brand-icon large flex-center glass-panel r14_px">
              <div class="app-icon"></div>
            </a>
            <div class="brand-name large flex-col g-3">
              <div class="flex-align-center g-5">
                <span class="main-text">${i18n.get('extName')}</span>
                <span class="version custom-text t9_px">v${info.version}</span>
              </div>
              <div class="flex g-5">
                <span class="custom-text t11_px">${i18n.get('dialogAboutBrowser')}</span>
              </div>
            </div>
          </div>
          <button class="btn app-btn g-6 flex-center glass-panel hover-event" data-action="clearCache" title="${i18n.get('dialogAboutClearCache')}">
            <div class="icon ic_clear"></div>
            <span class="cache-info custom-text t11_px">${i18n.formatBytes(info.cache.bytes)}</span>
          </button>
        </div>

        <div class="section-content flex-col flex-between-only g-10 glass-panel">
          <div class="flex-between flex">
            <div class="flex-center g-075">
              <div class="icon ic_calendar"></div>
              <span class="custom-text t11_px">${i18n.get('dialogAboutInstallDate')}</span>
            </div>
            <span class="t11_px">${info.installDate}</span>
          </div>

          <div class="divider"></div>

          <div class="flex-between flex">
            <div class="flex-center g-075">
              <div class="icon ic_puzzle_piece"></div>
              <span class="custom-text t11_px">${i18n.get('dialogAboutExtensionId')}</span>
            </div>
            <span class="t11_px">${info.shortId}</span>
          </div>

          <div class="divider"></div>

          <div class="flex-between flex">
            <div class="flex-center g-075">
              <div class="icon ic_shield"></div>
              <span class="custom-text t11_px">${i18n.get('dialogAboutPermissions')}</span>
            </div>
            <button class="dialog-btn small flex-center g-5" data-action="showPermissions">
              <span class="custom-text t11_px">${i18n.get('dialogAboutView')}</span>
              <div class="arrow-icon _6px right"></div>
            </button>
          </div>
        </div>

        <button class="btn dialog-btn g-8 flex-center flex-row glass-panel default accent" data-action="checkUpdate" title="${i18n.get('dialogAboutCheckUpdate')}">${i18n.get('dialogAboutCheckUpdate')}<div class="icon ic_refresh"></div></button>
        <div id="versionState" class="t11_px g-5 flex-center flex version-state ${info.versionMeta.css}">
          <span class="icon small ${info.versionMeta.icon}"></span>
          <span class="version-state-text">${info.versionMeta.text}</span>
        </div>
      </div>`;
};
