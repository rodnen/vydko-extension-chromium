import { CONSTANTS } from '../config/constants.js';
import { Utils } from '../utils/utils.js';

export class UpdateService {
  constructor({ i18n, currentVersion = chrome.runtime.getManifest().version } = {}) {
    this.i18n = i18n;
    this.currentVersion = currentVersion;
  }

  async check(owner, repo) {
    let response;

    try {
      response = await Utils.fetchWithTimeout(
        `https://api.github.com/repos/${owner}/${repo}/releases/latest`,
        { headers: { Accept: 'application/vnd.github+json' } }
      );
    } catch (error) {
      console.warn('[Update check] network error', error.message);
      return {
        success: false,
        error: Utils.isTimeoutError(error)
          ? this.i18n.get('apiRequestTimeout', String(CONSTANTS.FETCH_TIMEOUT_MS / 1000))
          : error.message
      };
    }

    if (response.status === 403 || response.status === 429) {
      const remaining = response.headers.get('x-ratelimit-remaining');

      if (response.status === 429 || remaining === '0') {
        const resetHeader = response.headers.get('x-ratelimit-reset');
        const resetAt = resetHeader
          ? Number(resetHeader) * 1000
          : Date.now() + 15 * 60 * 1000;

        console.warn('[Update check] rate limited until', new Date(resetAt).toISOString());
        return { success: false, rateLimited: true, resetAt };
      }
    }

    if (!response.ok) {
      return {
        success: false,
        error: this.i18n.get('updateGitHubUnavailable', String(response.status))
      };
    }

    let latest;
    let bodyTimerId;
    try {
      // Заголовки вже отримані, але тіло теж не має права висіти вічно.
      const bodyTimeout = new Promise((_, reject) => {
        bodyTimerId = setTimeout(
          () => reject(new Error('timeout')),
          CONSTANTS.FETCH_TIMEOUT_MS
        );
      });
      latest = await Promise.race([response.json(), bodyTimeout]);
    } catch {
      return {
        success: false,
        error: this.i18n.get('updateGitHubInvalidResponse')
      };
    } finally {
      clearTimeout(bodyTimerId);
    }

    if (!latest?.tag_name) {
      return {
        success: false,
        error: this.i18n.get('updateGitHubNoReleases')
      };
    }

    const {
      tag_name: latestVer,
      html_url: url,
      published_at: published,
      name: description,
      zipball_url: zipUrl,
    } = latest;

    const cmp = Utils.semverCompare(this.currentVersion, latestVer);

    if (cmp === -1) {
      await chrome.storage.local.set({ pendingUpdateUrl: url });
      await chrome.storage.local.set({ zipUrl: zipUrl });

      await chrome.notifications.create('update-available', {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: this.i18n.get('updateNotificationTitle'),
        message: this.i18n.get('updateNotificationMessage', latestVer)
      });
    }

    return { success: true, cmp, latestVer, published, description, zipUrl };
  }

  registerNotificationHandler() {
    chrome.notifications.onClicked.addListener(id => {
      if (id !== 'update-available') return;

      chrome.storage.local.get('pendingUpdateUrl', ({ pendingUpdateUrl }) => {
        const safeUrl = Utils.sanitizeUrl(pendingUpdateUrl);
        if (safeUrl) chrome.tabs.create({ url: safeUrl });
      });

      chrome.notifications.clear(id);
    });
  }
}

export { CONSTANTS };
