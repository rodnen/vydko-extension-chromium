const UPDATE_STATE_META = {
  1: { css: 'state-neutral', type: 'info', icon: 'ic_check', key: 'versionStateNewer' },
  0: { css: 'state-success', type: 'success', icon: 'ic_check', key: 'versionStateCurrent' },
  '-1': { css: 'state-update', type: 'success', icon: 'ic_info', key: 'versionStateAvailable' }
};

export function getUpdateStateMeta(cmp, latestVer, i18n) {
  const meta = UPDATE_STATE_META[String(cmp)];

  if (!meta) {
    return {
      css: 'state-error',
      type: 'error',
      icon: 'ic_error',
      text: i18n.get('versionStateUnknown')
    };
  }

  const text = i18n.get(meta.key).replace('{version}', latestVer ?? '');
  return { css: meta.css, type: meta.type, icon: meta.icon, text };
}
