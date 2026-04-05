let INACTIVITY_LIMIT = 5 * 60 * 1000;
let MAX_GAP  = 8 * 60 * 60 * 1000;
let MIN_GAP  = 30 * 1000;
let EXCEPTIONS = [];
let ENABLED = true;

const MAX_VISITS_STORED = 20;
const MIN_VISITS_TO_LEARN = 2;

let tabData = {};
let domainHistory = {};

function normalizeDomain(hostname) {
  return hostname.replace(/^www\./, "");
}

function isException(domain) {
  return EXCEPTIONS.some(e => domain.includes(e));
}

// load saved settings, then seed all open tabs
browser.storage.local.get(["inactivityLimit","maxGap","minGap","exceptions","enabled","domainHistory"])
  .then(({ inactivityLimit, maxGap, minGap, exceptions, enabled, domainHistory: saved }) => {
    if (inactivityLimit)       INACTIVITY_LIMIT = inactivityLimit;
    if (maxGap)                MAX_GAP          = maxGap;
    if (minGap !== undefined)  MIN_GAP          = minGap;
    if (exceptions)            EXCEPTIONS       = exceptions;
    if (enabled !== undefined) ENABLED          = enabled;
    if (saved)                 domainHistory    = saved;

    // seed every already-open tab so they get a countdown immediately
    browser.tabs.query({}).then(tabs => {
      tabs.forEach(tab => {
        if (!tab.url) return;
        if (tab.url.startsWith("about:") || tab.url.startsWith("moz-extension:")) return;
        try {
          const domain = normalizeDomain(new URL(tab.url).hostname);
          if (!tabData[tab.id]) {
            tabData[tab.id] = { domain, lastActive: Date.now() };
          }
        } catch {}
      });
    });
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
  try { domain = normalizeDomain(new URL(tab.url).hostname); }
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
    console.log(`[moontabs] alarm fired — checking ${tabs.length} tabs`);

    tabs.forEach(tab => {
      if (tab.active || tab.audible) return;

      const data = tabData[tab.id];
      if (!data) return;

      const inactiveMs   = now - data.lastActive;
      const inactiveMins = (inactiveMs / 60000).toFixed(1);
      const exc          = isException(data.domain);
      const prot         = isProtectedDomain(data.domain);

      console.log(
        `[moontabs] ${data.domain} | inactive: ${inactiveMins}m` +
        ` | protected: ${prot} | exception: ${exc} | discarded: ${tab.discarded}`
      );

      if (inactiveMs < INACTIVITY_LIMIT) return;
      if (exc)  return;
      if (prot) return;

      console.log(`[moontabs] discarding ${data.domain}`);
      browser.tabs.discard(tab.id);
    });
  });
});

function isProtectedDomain(domain) {
  const history = domainHistory[domain];
  if (!history || history.visits.length < MIN_VISITS_TO_LEARN) return false;

  const gaps = getFilteredGaps(history.visits);
  if (!gaps.length) return false;

  const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  return avg > INACTIVITY_LIMIT;
}

function getFilteredGaps(visits) {
  const gaps = [];
  for (let i = 1; i < visits.length; i++) {
    const gap = visits[i] - visits[i - 1];
    if (gap >= MIN_GAP && gap <= MAX_GAP) gaps.push(gap);
  }
  return gaps;
}

function getAvgGap(history) {
  if (!history || history.visits.length < 2) return null;
  const gaps = getFilteredGaps(history.visits);
  if (!gaps.length) return null;
  return gaps.reduce((a, b) => a + b, 0) / gaps.length;
}

browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "SET_SETTINGS") {
    INACTIVITY_LIMIT = msg.inactivityLimit;
    MAX_GAP          = msg.maxGap;
    MIN_GAP          = msg.minGap;
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
        const data        = tabData[tab.id];
        const domain      = data?.domain ?? null;
        const history     = domain ? domainHistory[domain] : null;
        const exc         = domain ? isException(domain) : false;
        const learnedProt = domain ? isProtectedDomain(domain) : false;
        return {
          id:          tab.id,
          title:       tab.title,
          domain,
          active:      tab.active,
          pinned:      tab.pinned,
          audible:     tab.audible,
          discarded:   tab.discarded,
          inactiveMs:  data ? now - data.lastActive : 0,
          avgReturnMs: getAvgGap(history),
          protected:   tab.pinned || tab.audible || exc || learnedProt,
          exception:   exc,
          learned:     learnedProt
        };
      });
      sendResponse({
        tabs:            result,
        inactivityLimit: INACTIVITY_LIMIT,
        maxGap:          MAX_GAP,
        minGap:          MIN_GAP,
        exceptions:      EXCEPTIONS,
        enabled:         ENABLED
      });
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
  browser.storage.local.set({
    domainHistory,
    inactivityLimit: INACTIVITY_LIMIT,
    maxGap:          MAX_GAP,
    minGap:          MIN_GAP,
    exceptions:      EXCEPTIONS
  });
}
