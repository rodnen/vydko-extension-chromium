// ============================================================================
// КОНСТАНТИ
// ============================================================================
const DTEK_DNEM_ORIGIN_URL = 'https://www.dtek-dnem.com.ua/ua';
const DTEK_KEM_ORIGIN_URL = 'https://www.dtek-kem.com.ua/ua';

const PROVIDER = Object.freeze({ YASNO: 'yasno', DTEK: 'dtek' });
const PROVIDERS = Object.freeze(Object.values(PROVIDER));
const PROVIDER_LABELS = Object.freeze({
  [PROVIDER.YASNO]: 'Yasno',
  [PROVIDER.DTEK]: 'DTEK'
});
const DSOID_OPTIONS = Object.freeze({
  [PROVIDER.YASNO]: [
    { region: 'none', value: 'none', label: 'notSelected' },
    { region: 3, value: 301, label: 'DnEM' },
    { region: 3, value: 303, label: 'CEK' },
    { region: 25, value: 902, label: 'KEM' }
  ],
  [PROVIDER.DTEK]: [
    { region: 'none', value: 'none', label: 'notSelected' },
    { region: 3, value: 301, label: 'DnEM' },
    { region: 25, value: 902, label: 'KEM' }
  ]
});

export const CONSTANTS = {
  APP_VERSION: chrome.runtime.getManifest().version,
  APP_NAME: 'Видко',

  //GIT HUB
  RATE_LIMIT_UNTIL_KEY: 'rateLimitUntil',
  RATE_LIMIT_COOLDOWN: 15 * 60 * 1000,
  OWNER: 'rodnen',
  REPO: 'vydko-extension-chromium',

  //APP CONSTANST
  INDICATOR_PADDING: 5,
  DEFAULT_QUEUE: 'all',
  DEFAULT_DSO_ID: 'none',
  REFRESH_ANIMATION_DURATION: 300,
  REFRESH_MIN_DURATION: 1500,
  EASTER_EGG_DATES: Object.freeze({ today: 6, tomorrow: 7 }),
  EASTER_EGG_GIF: 'https://cdn.7tv.app/emote/01K91ZKMKBW0EA884967R3MHCM/1x.gif',
  CHECK_INTERVAL: 6 * 60 * 60 * 1000,

  PROVIDER,
  PROVIDERS,
  PROVIDER_LABELS,
  DSOID_OPTIONS,
  //DSOI IDS
  DNEM_DSO_ID: { [PROVIDER.YASNO]: '301', [PROVIDER.DTEK]: 'dnem' },
  CEK_DSO_ID: { [PROVIDER.YASNO]: '303', [PROVIDER.DTEK]: 'cek' },
  KEM_DSO_ID: { [PROVIDER.YASNO]: '902', [PROVIDER.DTEK]: 'kem' },

  DTEK_DNEM_ORIGIN_URL,
  DTEK_KEM_ORIGIN_URL,

  DTEK_DNEM_AJAX_URL: `${DTEK_DNEM_ORIGIN_URL}/ajax`,
  DTEK_KEM_AJAX_URL: `${DTEK_KEM_ORIGIN_URL}/ajax`,

  DTEK_DNEM_SHUTDOWN_URL: `${DTEK_DNEM_ORIGIN_URL}/shutdowns`,
  DTEK_KEM_SHUTDOWN_URL: `${DTEK_KEM_ORIGIN_URL}/shutdowns`,

  //CACHE KEYS
  UPDATE_STATE_KEY: "lastUpdateKey",
  LAST_CHECK_KEY: "lastUpdateCheck",
  LATEST_VER_KEY: "lastVerKey",
  PENDING_UPDATE_URL_KEY: "pendingUpdateUrl",
  ZIP_URL_KEY: "zipUrl",

  NOTIFICATION_ENABLED_KEY: "notificationEnabled",
  NOTIFICATION_DELAY_KEY: "notitficationDelay",
  NOTIFICATION_FREQUENCY_KEY: "notificationFrequency",
  NOTIFICATION_DATES_KEY: "notificationDates",
  NOTIFICATION_STATE_KEY: "notificationState",

  CACHE_KEY_PREFIX: 'cache:vydko:table',
  CACHE_TTL_MIN: 20,

  CACHE_TTL: Object.freeze({
    HOUSES: 24 * 60 * 60 * 1000,  // 24 год — список будинків по вулиці
    HOUSE_DATA: 30 * 60 * 1000,   // 30 хв  — дані про відключення
  }),

  CRYPTO_OPTIONS: {
    btc: { adress: "159QjydMa73R9qqceoN8hmHWjYNAKjeZ6y", qrcode: "ic_btc_qrcode", title: "Bitcoin" },
    eth: { adress: "0xdc6d0754de7d3a02a14ab3ca7f7b5a85db45dbec", qrcode: "ic_eth_qrcode", title: "Ethereum" },
    usdt: { adress: "TK59BTuZUJQiNJ4iQDPFSEx4na3vYqnxE2", qrcode: "ic_usdt_qrcode", title: "USDT" },
  },
}
