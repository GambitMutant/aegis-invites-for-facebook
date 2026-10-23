const api = globalThis.chrome || globalThis.browser;

const DEFAULT_SETTINGS = {
  delayMin: 1500,
  delayMax: 4500,
  dailyLimit: 2000,
  runLimit: 1000,
  maxPostsPerPage: 20,
  scanComments: true,
  followButtons: "skip",
  waitBetweenPosts: true,
  randomizeOrder: true,
  multiPageUrls: [],
  realTimeInterval: 5,
  enableNotifications: true
};

const EMPTY_STATS = { invitesToday: 0, totalInvites: 0, lastReset: Date.now() };

api.runtime.onInstalled.addListener((details) => {
  api.storage.local.get(["settings", "stats"], (result) => {
    const settings = Object.assign({}, DEFAULT_SETTINGS, result.settings || {});
    if (settings.runLimit == null) settings.runLimit = 1000;
    if (details.reason === "update" && result.settings && result.settings.runLimit == null && result.settings.dailyLimit === 500) {
      settings.dailyLimit = 2000;
    }
    api.storage.local.set({ settings, stats: result.stats || EMPTY_STATS });
  });
});

if (api.alarms) {
  try {
    const pending = api.alarms.create("dailyReset", { periodInMinutes: 60 });
    if (pending && typeof pending.catch === "function") pending.catch(() => {});
  } catch (e) {
    /* Safari drops the background if a missing API throws here */
  }
  if (api.alarms.onAlarm) {
    api.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name !== "dailyReset") return;
      api.storage.local.get(["stats"], (res) => {
        const stats = res.stats || { ...EMPTY_STATS };
        const now = Date.now();
        if (!stats.lastReset || now - stats.lastReset > 24 * 60 * 60 * 1000) {
          stats.invitesToday = 0;
          stats.lastReset = now;
          api.storage.local.set({ stats });
        }
      });
    });
  }
}

function openSettings() {
  try {
    const pending = api.runtime.openOptionsPage();
    if (pending && typeof pending.catch === "function") {
      pending.catch(() => {
        api.tabs.create({ url: api.runtime.getURL("options.html") });
      });
      return;
    }
  } catch (e) {
    /* fall through */
  }
  api.tabs.create({ url: api.runtime.getURL("options.html") });
}

api.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "getSettings") {
    api.storage.local.get(["settings", "stats"], (res) => {
      sendResponse({
        settings: Object.assign({}, DEFAULT_SETTINGS, res.settings || {}),
        stats: res.stats || {}
      });
    });
    return true;
  }
  if (message.action === "updateStats") {
    api.storage.local.get(["stats"], (res) => {
      const stats = res.stats || { invitesToday: 0, totalInvites: 0 };
      const n = message.count || 1;
      stats.invitesToday = (stats.invitesToday || 0) + n;
      stats.totalInvites = (stats.totalInvites || 0) + n;
      api.storage.local.set({ stats }, () => sendResponse({ success: true }));
    });
    return true;
  }
  if (message.action === "saveSettings") {
    api.storage.local.set({ settings: message.settings }, () => sendResponse({ success: true }));
    return true;
  }
  if (message.action === "patchSettings") {
    api.storage.local.get(["settings"], (res) => {
      const settings = Object.assign({}, DEFAULT_SETTINGS, res.settings || {}, message.patch || {});
      api.storage.local.set({ settings }, () => sendResponse({ success: true, settings }));
    });
    return true;
  }
  if (message.action === "openOptions") {
    openSettings();
    sendResponse({ ok: true });
    return false;
  }
});
