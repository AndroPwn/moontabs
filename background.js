const INACTIVITY_LIMIT    = 5 * 60 * 1000;
const MAX_VISITS_STORED   = 20;
const MIN_VISITS_TO_LEARN = 2;

let tabData = {};
let domainHistory = {};

browser.storage.local.get(["domainHistory"]).then(({ domainHistory: saved }) => {
  if (saved) domainHistory = saved;
});

browser.tabs.onActivated.addListener(({ tabId }) => {
  browser.tabs.get(tabId).then(tab => {
    recordVisit(tab);
  }).catch(() => {});
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;
  if (!tab.active) return;
  recordVisit(tab);
});

browser.tabs.onRemoved.addListener(tabId => {
  delete tabData[tabId];
});

function recordVisit(tab) {
  if (!tab || !tab.url) return;
  if (tab.url.startsWith("about:") || tab.url.startsWith("moz-extension:")) return;

  let domain;
  try {
    domain = new URL(tab.url).hostname;
  } catch {
    return;
  }

  const now = Date.now();

  tabData[tab.id] = {
    domain,
    lastActive: now,
    visits: tabData[tab.id]?.visits ?? []
  };

  if (!domainHistory[domain]) {
    domainHistory[domain] = { visits: [] };
  }
  domainHistory[domain].visits.push(now);

  if (domainHistory[domain].visits.length > MAX_VISITS_STORED) {
    domainHistory[domain].visits.shift();
  }

  persistDomainHistory();
}

browser.alarms.create("checkInactivity", { periodInMinutes: 1 });

browser.alarms.onAlarm.addListener(alarm => {
  if (alarm.name !== "checkInactivity") return;

  browser.tabs.query({}).then(tabs => {
    const now = Date.now();

    tabs.forEach(tab => {
      if (tab.active)  return;
      if (tab.pinned)  return;
      if (tab.audible) return;

      const data = tabData[tab.id];
      if (!data) return;

      const inactiveFor = now - data.lastActive;
      if (inactiveFor < INACTIVITY_LIMIT) return;

      if (isProtectedDomain(data.domain)) return;

      browser.tabs.discard(tab.id);
    });
  });
});

function isProtectedDomain(domain) {
  const history = domainHistory[domain];
  if (!history || history.visits.length < MIN_VISITS_TO_LEARN) return false;

  const visits = history.visits;
  let totalGap = 0;
  for (let i = 1; i < visits.length; i++) {
    totalGap += visits[i] - visits[i - 1];
  }
  const avgReturnGap = totalGap / (visits.length - 1);

  return avgReturnGap > INACTIVITY_LIMIT;
}

function getAvgGap(history) {
  if (!history || history.visits.length < 2) return null;
  const v = history.visits;
  let total = 0;
  for (let i = 1; i < v.length; i++) total += v[i] - v[i - 1];
  return total / (v.length - 1);
}

browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "GET_STATE") {
    browser.tabs.query({}).then(tabs => {
      const now = Date.now();
      const result = tabs.map(tab => {
        const data = tabData[tab.id];
        const domain = data?.domain ?? null;
        const history = domain ? domainHistory[domain] : null;

        return {
          id:          tab.id,
          title:       tab.title,
          domain,
          active:      tab.active,
          pinned:      tab.pinned,
          audible:     tab.audible,
          inactiveMs:  data ? now - data.lastActive : null,
          avgReturnMs: getAvgGap(history),
          protected:   tab.pinned || tab.audible || (domain ? isProtectedDomain(domain) : false)
        };
      });
      sendResponse({ tabs: result, inactivityLimit: INACTIVITY_LIMIT });
    });
    return true;
  }

  if (msg.type === "FORGET_DOMAIN") {
    delete domainHistory[msg.domain];
    persistDomainHistory();
    sendResponse({ ok: true });
    return true;
  }
});

function persistDomainHistory() {
  browser.storage.local.set({ domainHistory });
}
