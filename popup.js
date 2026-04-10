let currentExceptions = [];
let currentEnabled    = true;
let inactivityLimitMs = 5 * 60 * 1000;

function sanitize(id, fallback, multiplier) {
  const n = parseInt(document.getElementById(id).value);
  return (isNaN(n) || n < 1 ? fallback : n) * multiplier;
}

function persist() {
  browser.runtime.sendMessage({
    type:            "SET_SETTINGS",
    inactivityLimit: sanitize("limitInput",  5,  60000),
    maxGap:          sanitize("maxGapInput", 8,  3600000),
    exceptions:      currentExceptions
  });
}

function renderTags() {
  const container = document.getElementById("tags");
  container.innerHTML = "";
  currentExceptions.forEach(domain => {
    const tag = document.createElement("div");
    tag.className = "tag";
    const label = document.createElement("span");
    label.textContent = domain;
    const btn = document.createElement("button");
    btn.className = "tx";
    btn.textContent = "×";
    btn.addEventListener("click", () => {
      currentExceptions = currentExceptions.filter(d => d !== domain);
      renderTags();
      persist();
    });
    tag.appendChild(label);
    tag.appendChild(btn);
    container.appendChild(tag);
  });
}

function addDomain() {
  const inp = document.getElementById("domainInput");
  let val = inp.value.trim().toLowerCase();
  if (!val) return;
  val = val.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
  if (val && !currentExceptions.includes(val)) {
    currentExceptions.push(val);
    renderTags();
    persist();
  }
  inp.value = "";
}

function applyEnabledUI() {
  document.getElementById("popup").classList.toggle("off", !currentEnabled);
  document.getElementById("statusHint").textContent = currentEnabled ? "active" : "paused";
}

function toggleEnabled() {
  currentEnabled = !currentEnabled;
  applyEnabledUI();
  browser.runtime.sendMessage({ type: "SET_ENABLED", enabled: currentEnabled });
}

function formatMs(ms) {
  if (ms == null || ms < 0) return "—";
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60), rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

function makeCountdownBadge(inactiveMs) {
  const remaining = inactivityLimitMs - (inactiveMs ?? 0);
  const b = document.createElement("span");
  if (remaining <= 0) {
    b.className = "badge b-risk";
    b.textContent = "closing…";
  } else if ((inactiveMs ?? 0) > inactivityLimitMs * 0.5) {
    b.className = "badge b-risk";
    b.textContent = formatMs(remaining);
    b.title = `Closes in ~${formatMs(remaining)}`;
  } else {
    b.className = "badge b-idle";
    b.textContent = formatMs(remaining);
    b.title = `Closes in ~${formatMs(remaining)}`;
  }
  return b;
}

function renderState(state) {
  const { tabs, inactivityLimit, maxGap, minGap, exceptions, enabled } = state;

  currentExceptions = exceptions || [];
  currentEnabled    = enabled !== false;
  inactivityLimitMs = inactivityLimit;

  document.getElementById("limitInput").value  = Math.round(inactivityLimit / 60000);
  document.getElementById("maxGapInput").value = Math.round(maxGap / 3600000);

  applyEnabledUI();
  renderTags();

  const list = document.getElementById("tabList");
  list.innerHTML = "";

  if (!tabs || tabs.length === 0) {
    const empty = document.createElement("div");
    empty.style.cssText = "font-size:11px;color:var(--muted);text-align:center;padding:16px 0";
    empty.textContent = "No tabs";
    list.appendChild(empty);
    return;
  }

  tabs.forEach(tab => {
    const row = document.createElement("div");
    row.className = "ti" + (tab.discarded ? " sleeping" : "");

    const fav = document.createElement("img");
    fav.className = "tfav";
    fav.src = tab.domain ? `https://www.google.com/s2/favicons?domain=${tab.domain}&sz=32` : "";
    fav.addEventListener("error", () => { fav.style.visibility = "hidden"; });

    const title = document.createElement("span");
    title.className = "ttitle";
    title.textContent = tab.domain ?? tab.title ?? "unknown";

    row.appendChild(fav);
    row.appendChild(title);

    if (tab.active) {
      const b = document.createElement("span");
      b.className = "badge b-active";
      b.textContent = "active";
      row.appendChild(b);

    } else if (tab.exception) {
      const b = document.createElement("span");
      b.className = "badge b-prot";
      b.textContent = "protected";
      row.appendChild(b);

    } else if (tab.pinned) {
      const bp = document.createElement("span");
      bp.className = "badge b-prot";
      bp.textContent = "pinned";
      row.appendChild(bp);
      row.appendChild(makeCountdownBadge(tab.inactiveMs));

    } else if (tab.audible) {
      const b = document.createElement("span");
      b.className = "badge b-prot";
      b.textContent = "playing";
      row.appendChild(b);

    } else if (tab.discarded) {
      const b = document.createElement("span");
      b.className = "badge b-sleep";
      b.textContent = "☽ sleep";
      row.appendChild(b);

    } else if (tab.learned) {
      const b = document.createElement("span");
      b.className = "badge b-learned";
      const avgText = tab.avgReturnMs ? formatMs(tab.avgReturnMs) : null;
      b.textContent = avgText ? `learned · ${avgText}` : "learned";
      b.title = "Extension learned your return pattern";
      row.appendChild(b);

      // countdown based on grace period (1.5x avg gap)
      const gracePeriod = tab.avgReturnMs ? tab.avgReturnMs * 1.5 : inactivityLimitMs * 3;
      const remaining = gracePeriod - (tab.inactiveMs ?? 0);
      const cd = document.createElement("span");
      if (remaining <= 0) {
        cd.className = "badge b-risk";
        cd.textContent = "closing…";
      } else {
        cd.className = remaining < gracePeriod * 0.25 ? "badge b-risk" : "badge b-idle";
        cd.textContent = formatMs(remaining);
        cd.title = `Closes in ~${formatMs(remaining)}`;
      }
      row.appendChild(cd);

      const forget = document.createElement("button");
      forget.className = "tx";
      forget.textContent = "×";
      forget.title = "Forget learned pattern";
      forget.addEventListener("click", () => {
        browser.runtime.sendMessage({ type: "FORGET_DOMAIN", domain: tab.domain });
      });
      row.appendChild(forget);

    } else {
      row.appendChild(makeCountdownBadge(tab.inactiveMs));
    }

    list.appendChild(row);
  });

  const sleeping   = tabs.filter(t => t.discarded).length;
  const protected_ = tabs.filter(t => t.exception || t.audible).length;
  const learned_   = tabs.filter(t => t.learned && !t.discarded).length;
  const atRisk     = tabs.filter(t =>
    !t.exception && !t.audible && !t.discarded && !t.active &&
    (t.inactiveMs ?? 0) > inactivityLimitMs * 0.5
  ).length;

  const parts = [];
  if (sleeping)   parts.push(`${sleeping} sleeping`);
  if (protected_) parts.push(`${protected_} protected`);
  if (learned_)   parts.push(`${learned_} learned`);
  if (atRisk)     parts.push(`${atRisk} at risk`);

  document.getElementById("footerStat").textContent = parts.join(" · ") || "all good";
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("hdrBtn").addEventListener("click", toggleEnabled);
  document.getElementById("addBtn").addEventListener("click", addDomain);
  document.getElementById("domainInput").addEventListener("keydown", e => {
    if (e.key === "Enter") addDomain();
  });

  ["limitInput", "maxGapInput"].forEach(id => {
    document.getElementById(id).addEventListener("change", persist);
  });

  document.getElementById("saveBtn").addEventListener("click", () => {
    persist();
    const btn = document.getElementById("saveBtn");
    btn.textContent = "Saved ✓";
    btn.classList.add("saved");
    setTimeout(() => { btn.textContent = "Save"; btn.classList.remove("saved"); }, 2000);
  });

  browser.runtime.sendMessage({ type: "GET_STATE" }).then(renderState);

  setInterval(() => {
    browser.runtime.sendMessage({ type: "GET_STATE" }).then(renderState);
  }, 3000);
});
