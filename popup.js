let currentExceptions = [];
let currentEnabled = true;

function formatMs(ms) {
  if (ms === null) return "—";
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

function renderTags() {
  const container = document.getElementById("tags");
  container.innerHTML = "";
  currentExceptions.forEach(domain => {
    const tag = document.createElement("div");
    tag.className = "tag";
    tag.innerHTML = `<span>${domain}</span><button onclick="removeDomain('${domain}')">×</button>`;
    container.appendChild(tag);
  });
}

function addDomain() {
  const input = document.getElementById("domainInput");
  let val = input.value.trim().toLowerCase();
  if (!val) return;
  // strip protocol if pasted
  val = val.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!currentExceptions.includes(val)) {
    currentExceptions.push(val);
    renderTags();
  }
  input.value = "";
}

function removeDomain(domain) {
  currentExceptions = currentExceptions.filter(d => d !== domain);
  renderTags();
}

document.getElementById("domainInput").addEventListener("keydown", e => {
  if (e.key === "Enter") addDomain();
});

function toggleEnabled() {
  currentEnabled = !currentEnabled;
  const btn = document.getElementById("toggleBtn");
  btn.className = "toggle-btn " + (currentEnabled ? "on" : "off");
  browser.runtime.sendMessage({ type: "SET_ENABLED", enabled: currentEnabled });
}

function saveSettings() {
  const limitMin = parseInt(document.getElementById("limitInput").value);
  const gapHrs   = parseInt(document.getElementById("gapInput").value);
  if (isNaN(limitMin) || limitMin < 1) return;
  if (isNaN(gapHrs)   || gapHrs   < 1) return;

  browser.runtime.sendMessage({
    type: "SET_SETTINGS",
    inactivityLimit: limitMin * 60000,
    maxGap:          gapHrs * 3600000,
    exceptions:      currentExceptions
  }).then(() => {
    const btn = document.getElementById("saveBtn");
    btn.textContent = "Saved ✓";
    btn.classList.add("saved");
    setTimeout(() => {
      btn.textContent = "Save";
      btn.classList.remove("saved");
    }, 2000);
  });
}

browser.runtime.sendMessage({ type: "GET_STATE" }).then(({ tabs, inactivityLimit, maxGap, exceptions, enabled }) => {
  currentExceptions = exceptions || [];
  currentEnabled    = enabled !== false;

  document.getElementById("limitInput").value = Math.round(inactivityLimit / 60000);
  document.getElementById("gapInput").value   = Math.round(maxGap / 3600000);
  document.getElementById("toggleBtn").className = "toggle-btn " + (currentEnabled ? "on" : "off");

  renderTags();

  const list   = document.getElementById("tabList");
  const footer = document.getElementById("footerStat");
  list.innerHTML = "";

  tabs.forEach(tab => {
    const row = document.createElement("div");
    row.className = "tab-row" + (tab.discarded ? " sleeping" : "");

    const favicon = tab.domain
      ? `https://www.google.com/s2/favicons?domain=${tab.domain}&sz=32`
      : "";

    let badge = "";
    if (tab.active) {
      badge = `<span class="badge b-active">active</span>`;
    } else if (tab.discarded) {
      badge = `<span class="badge b-sleep"><span class="moon-glyph">☽</span> sleeping</span>`;
    } else if (tab.protected) {
      badge = `<span class="badge b-protected">protected</span>`;
    } else if (tab.inactiveMs !== null && tab.inactiveMs > inactivityLimit * 0.7) {
      badge = `<span class="badge b-risk">${formatMs(tab.inactiveMs)}</span>`;
    }

    row.innerHTML = `
      <img class="fav" src="${favicon}" onerror="this.style.visibility='hidden'" />
      <span class="tab-domain">${tab.domain ?? tab.title ?? "unknown"}</span>
      ${badge}
    `;
    list.appendChild(row);
  });

  const sleeping   = tabs.filter(t => t.discarded).length;
  const protected_ = tabs.filter(t => t.protected && !t.discarded).length;
  const atRisk     = tabs.filter(t => !t.protected && !
