const PERMISSIONS = {
  cookies: ['ic_cookie', 'permissionCookies'],
  storage: ['ic_database', 'permissionStorage'],
  unlimitedStorage: ['ic_database', 'permissionUnlimitedStorage'],
  tabs: ['ic_tabs', 'permissionTabs'],
  activeTab: ['ic_tab', 'permissionActiveTab'],
  scripting: ['ic_code', 'permissionScripting'],
  notifications: ['ic_bell', 'permissionNotifications'],
  webRequest: ['ic_globe', 'permissionWebRequest'],
  webRequestBlocking: ['ic_shield', 'permissionWebRequestBlocking'],
  contextMenus: ['ic_menu', 'permissionContextMenus'],
  alarms: ['ic_alarm', 'permissionAlarms'],
  downloads: ['ic_download', 'permissionDownloads'],
  clipboardRead: ['ic_clipboard_read', 'permissionClipboardRead'],
  clipboardWrite: ['ic_clipboard_write', 'permissionClipboardWrite'],
  identity: ['ic_user', 'permissionIdentity']
};

const formatHost = host => host
  .replace(/^https?:\/\//, '')
  .replace(/\/\*$/, '');

function getHostIcon(host) {
  const lowerHost = host.toLowerCase();
  if (lowerHost.includes('dtek')) return 'ic_dtek no-mask';
  if (lowerHost.includes('yasno')) return 'ic_yasno no-mask';
  return 'ic_globe';
}

export const renderPermissions = ({ hostPermissions, permissions }, i18n) => {
  const hostRows = hostPermissions.length
    ? hostPermissions.map((host, index) => `
        ${index > 0 ? '<div class="divider"></div>' : ''}
        <div class="flex-between flex">
          <div class="flex-center g-10">
            <div class="icon ${getHostIcon(host)}"></div>
            <span class="custom-text t11_px">${formatHost(host)}</span>
          </div>
          <div class="flex-center g-5 access-allowed">
            <div class="icon ic_check"></div>
            <span class="custom-text t11_px">${i18n.get('dialogPermissionsAllowed')}</span>
          </div>
        </div>
      `).join('')
    : `<div class="flex-center"><span class="custom-text t11_px">${i18n.get('dialogPermissionsNoHosts')}</span></div>`;

  const permissionRows = permissions.length
    ? permissions.map((permission, index) => {
      const [icon, key] = PERMISSIONS[permission] || ['ic_shield', null];
      const label = key ? i18n.get(key) : permission;

      return `
        ${index > 0 ? '<div class="divider"></div>' : ''}
        <div class="flex-between flex">
          <div class="flex-center g-10">
            <div class="icon ${icon}"></div>
            <span class="custom-text t11_px">${label}</span>
          </div>
          <div class="flex-center access-allowed g-5">
            <div class="icon ic_check"></div>
            <span class="custom-text t11_px">${i18n.get('dialogPermissionsAllowed')}</span>
          </div>
        </div>
      `;
    }).join('')
    : `<div class="flex-center"><span class="custom-text t11_px">${i18n.get('dialogPermissionsNoSpecial')}</span></div>`;

  return `<div class="modal-wrapper p-10 g-10 flex-col">
      <div class="section-content flex-col flex-between-only g-10 glass-panel">
        <div class="flex-center g-10">
          <div class="section-icon glass-panel p-3"><div class="icon ic_globe p-3"></div></div>
          <div class="flex-col flex g-3">
            <span class="main-text">${i18n.get('dialogPermissionsHostTitle')}</span>
            <span class="custom-text t11_px">${i18n.get('dialogPermissionsHostDescription')}</span>
          </div>
        </div>
        <div class="divider"></div>
        ${hostRows}
      </div>

      <div class="section-content flex-col flex-between-only g-10 glass-panel">
        <div class="flex-center g-10">
          <div class="section-icon glass-panel p-3"><div class="icon ic_lock p-3"></div></div>
          <div class="flex-col flex g-3">
            <span class="main-text">${i18n.get('dialogPermissionsExtensionTitle')}</span>
            <span class="custom-text t11_px">${i18n.get('dialogPermissionsExtensionDescription')}</span>
          </div>
        </div>
        <div class="divider"></div>
        ${permissionRows}
      </div>

      <div class="section-content flex-center g-10 glass-panel">
        <div class="icon ic_info"></div>
        <span class="custom-text t11_px">${i18n.get('dialogPermissionsDisclaimer')}</span>
      </div>
    </div>`;
};
