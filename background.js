let INACTIVITY_LIMIT = 5 * 60 * 1000;
let MAX_GAP = 8 * 60 * 60 * 1000;
let EXCEPTIONS = [];
let ENABLED = true;

const MAX_VISITS_STORED = 20;
const MIN_VISITS_TO_LEARN = 2;

let tabData = {};
let domainHistory = {};

// load saved settings
browser.storage.local.get(["inactivityLimit","maxGap","exceptions","enabled","domainHistory"])
  .then(({ inactivityLimit, maxGap, exceptions, enabled, domainHistory: saved }) => {
    if (inactivityLimit) INACTIVITY_LIMIT = inactivityLimit;
    if (maxGap)          MAX_GAP          = maxGap;
    if (exceptions)      EXCEPTIONS       = exceptions;
    if (enabled !== undefined) ENABLED    = enabled;
    if (saved)           domainHistory    = saved;
  });

browser.tabs.onActivated.addListener(({ tabId }) => {
  browser.tabs.get(tabId).then(tab => recordVisit(tab)).catch(() => {});
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.active) return;
  recordVisit(tab);
});

browser.tabs.onRemoved.addListener(tabId => {
  delete tabData[tabId];
});

function recordVisit(tab) {
  if (!tab?.url) return;
  if (tab.url.startsWith("about:") || tab.url.startsWith("moz-extension:")) return;

  let domain;
  try { domain = new URL(tab.url).hostname; }
  catch { return; }

  const now = Date.now();
  tabData[tab.id] = { domain, lastActive: now };

  if (!domainHistory[domain]) domainHistory[domain] = { visits: [] };
  domainHistory[domain].visits.push(now);
  if (domainHistory[domain].visits.length > MAX_VISITS_STORED)
    domainHistory[domain].visits.shift();

  persistAll();
}

browser.alarms.create("checkInactivity", { periodInMinutes: 1 });

browser.alarms.onAlarm.addListener(alarm => {
  if (alarm.name !== "checkInactivity" || !ENABLED) return;

  browser.tabs.query({}).then(tabs => {
    const now = Date.now();
    tabs.forEach(tab => {
      if (tab.active || tab.pinned || tab.audible) return;

      const data = tabData[tab.id];
      if (!data) return;

      if (now - data.lastActive < INACTIVITY_LIMIT) return;
      if (EXCEPTIONS.includes(data.domain)) return;
      if (isProtectedDomain(data.domain)) return;

      browser.tabs.discard(tab.id);
    });
  });
});

function isProtectedDomain(domain) {
  const history = domainHistory[domain];
  if (!history || history.visits.length < MIN_VISITS_TO_LEARN) return false;

  const visits = history.visits;
  const gaps = [];
  for (let i = 1; i < visits.length; i++) {
    const gap = visits[i] - visits[i - 1];
    if (gap < MAX_GAP) gaps.push(gap);
  }
  if (!gaps.length) return false;

  const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  return avg > INACTIVITY_LIMIT;
}

function getAvgGap(history) {
  if (!history || history.visits.length < 2) return null;
  const v = history.visits;
  const gaps = [];
  for (let i = 1; i < v.length; i++) {
    const gap = v[i] - v[i - 1];
    if (gap < MAX_GAP) gaps.push(gap);
  }
  if (!gaps.length) return null;
  return gaps.reduce((a, b) => a + b, 0) / gaps.length;
}

browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "SET_SETTINGS") {
    INACTIVITY_LIMIT = msg.inactivityLimit;
    MAX_GAP          = msg.maxGap;
    EXCEPTIONS       = msg.exceptions;
    persistAll();
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === "SET_ENABLED") {
    ENABLED = msg.enabled;
    browser.storage.local.set({ enabled: ENABLED });
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === "GET_STATE") {
    browser.tabs.query({}).then(tabs => {
      const now = Date.now();
      const result = tabs.map(tab => {
        const data    = tabData[tab.id];
        const domain  = data?.domain ?? null;
        const history = domain ? domainHistory[domain] : null;
        const isException = domain && EXCEPTIONS.includes(domain);
        return {
          id:          tab.id,
          title:       tab.title,
          domain,
          active:      tab.active,
          pinned:      tab.pinned,
          audible:     tab.audible,
          discarded:   tab.discarded,
          inactiveMs:  data ? now - data.lastActive : null,
          avgReturnMs: getAvgGap(history),
          protected:   tab.pinned || tab.audible || isException || (domain ? isProtectedDomain(domain) : false),
          exception:   isException
        };
      });
      sendResponse({ tabs: result, inactivityLimit: INACTIVITY_LIMIT, maxGap: MAX_GAP, exceptions: EXCEPTIONS, enabled: ENABLED });
    });
    return true;
  }

  if (msg.type === "FORGET_DOMAIN") {
    delete domainHistory[msg.domain];
    persistAll();
    sendResponse({ ok: true });
    return true;
  }
});

function persistAll() {
  browser.storage.local.set({ domainHistory, inactivityLimit: INACTIVITY_LIMIT, maxGap: MAX_GAP, exceptions: EXCEPTIONS });
}
