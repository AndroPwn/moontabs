function formatMs(ms) {
  if (ms === null) return "—";
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

function getBadge(tab, inactivityLimit) {
  if (tab.active)  return { text: "active",  cls: "badge-active" };
  if (tab.audible) return { text: "playing", cls: "badge-audible" };
  if (tab.pinned)  return { text: "pinned",  cls: "badge-protected" };
  if (tab.protected) return { text: "learned", cls: "badge-protected" };
  if (tab.inactiveMs !== null && tab.inactiveMs > inactivityLimit * 0.7)
    return { text: "at risk", cls: "badge-at-risk" };
  return null;
}

browser.runtime.sendMessage({ type: "GET_STATE" }).then(({ tabs, inactivityLimit }) => {
  const list   = document.getElementById("tab-list");
  const footer = document.getElementById("footer");

  if (!tabs.length) {
    list.innerHTML = `<div class="empty">No tabs open</div>`;
    return;
  }

  list.innerHTML = "";

  tabs.forEach(tab => {
    const row = document.createElement("div");
    row.className = "tab-row" +
      (tab.protected || tab.pinned ? " protected" : "") +
      (tab.active ? " active-tab" : "");

    const favicon    = `https://www.google.com/s2/favicons?domain=${tab.domain}&sz=32`;
    const badge      = getBadge(tab, inactivityLimit);
    const badgeHtml  = badge ? `<span class="badge ${badge.cls}">${badge.text}</span>` : "";
    const inactiveTxt = tab.inactiveMs !== null ? `inactive ${formatMs(tab.inactiveMs)}` : "just opened";
    const returnTxt   = tab.avgReturnMs !== null ? ` · avg return ${formatMs(tab.avgReturnMs)}` : "";
    const forgetBtn   = tab.domain && !tab.active
      ? `<button class="forget-btn" data-domain="${tab.domain}">forget</button>` : "";

    row.innerHTML = `
      <img class="favicon" src="${favicon}" onerror="this.style.display='none'" />
      <div class="tab-info">
        <div class="tab-domain">${tab.domain ?? tab.title ?? "Unknown"}</div>
        <div class="tab-meta">${inactiveTxt}${returnTxt}</div>
      </div>
      ${badgeHtml}
      ${forgetBtn}
    `;
    list.appendChild(row);
  });

  list.querySelectorAll(".forget-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      browser.runtime.sendMessage({ type: "FORGET_DOMAIN", domain: btn.dataset.domain })
        .then(() => { btn.textContent = "forgotten"; btn.disabled = true; });
    });
  });

  const protected_ = tabs.filter(t => t.protected).length;
  const atRisk     = tabs.filter(t => !t.protected && !t.active && t.inactiveMs > inactivityLimit * 0.7).length;
  footer.textContent = `${protected_} protected · ${atRisk} at risk · closes after ${Math.round(inactivityLimit / 60000)}m`;
});
