const UPDATE_STATE_META = {
  1: { css: 'state-neutral', icon: 'ic_check', key: 'versionStateNewer' },
  0: { css: 'state-success', icon: 'ic_check', key: 'versionStateCurrent' },
  '-1': { css: 'state-update', icon: 'ic_info', key: 'versionStateAvailable' }
};

export function getUpdateStateMeta(cmp, latestVer, i18n) {
  const meta = UPDATE_STATE_META[String(cmp)];

  if (!meta) {
    return {
      css: 'state-error',
      icon: 'ic_error',
      text: i18n.get('versionStateUnknown')
    };
  }

  const text = i18n.get(meta.key).replace('{version}', latestVer ?? '');
  return { css: meta.css, icon: meta.icon, text };
}
