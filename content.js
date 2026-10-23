(function () {
  "use strict";

  if (window.aegisInjected) return;
  window.aegisInjected = true;

  const BREAK_EVERY = 40;
  const BREAK_MS = 60000;

  let isRunning = false;
  let invitesSent = 0;
  let todayBase = 0;
  let currentSettings = {};
  const recentKeys = [];
  const recentSet = new Set();

  function createPanel() {
    if (document.getElementById("aegis-panel")) return;
    const gh = (globalThis.chrome || globalThis.browser)?.runtime?.getURL?.("icons/github.svg") || "icons/github.svg";
    const panel = document.createElement("div");
    panel.id = "aegis-panel";
    panel.innerHTML =
      '<div class="aegis-header">' +
      '<span class="aegis-logo">AEGIS Auto Inviter for Facebook</span>' +
      '<button id="aegis-minimize" type="button" aria-label="Minimize">−</button>' +
      "</div>" +
      '<div class="aegis-body">' +
      '<div class="aegis-status" id="aegis-status">Ready</div>' +
      '<div class="aegis-stats">This run: <strong id="aegis-count">0 / 1000</strong></div>' +
      '<label class="aegis-limit">Max reactions this run' +
      '<input id="aegis-run-limit" type="number" min="1" max="100000" step="1" value="1000">' +
      "</label>" +
      '<div class="aegis-controls">' +
      '<button id="aegis-start" class="aegis-btn primary" type="button">Start Invite Scan</button>' +
      '<button id="aegis-stop" class="aegis-btn danger" type="button" disabled>Stop</button>' +
      '<button id="aegis-scan-current" class="aegis-btn" type="button">Scan Current Post</button>' +
      "</div>" +
      '<div class="aegis-log" id="aegis-log"></div>' +
      '<div class="aegis-footer">' +
      '<button id="aegis-options" type="button">Settings</button>' +
      '<a id="aegis-github" href="https://github.com/GambitMutant/aegis-invites-for-facebook" target="_blank" rel="noopener noreferrer" aria-label="GitHub">' +
      '<img alt="" width="16" height="16" src="' + gh + '">' +
      "</a></div></div>";
    document.body.appendChild(panel);

    document.getElementById("aegis-start").onclick = () => beginRun("feed");
    document.getElementById("aegis-stop").onclick = stopScan;
    document.getElementById("aegis-scan-current").onclick = () => beginRun("post");
    document.getElementById("aegis-options").onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const rt = (globalThis.chrome || globalThis.browser)?.runtime;
      try {
        if (rt?.sendMessage) {
          const pending = rt.sendMessage({ action: "openOptions" });
          if (pending && typeof pending.catch === "function") pending.catch(() => {});
          return;
        }
      } catch (err) {
        /* fall through */
      }
      const url = rt?.getURL?.("options.html");
      if (url) window.open(url, "_blank", "noopener");
    };
    document.getElementById("aegis-minimize").onclick = () => panel.classList.toggle("minimized");
    document.getElementById("aegis-run-limit").addEventListener("change", saveRunLimit);
    makeDraggable(panel);
    loadSettings();
  }

  function saveRunLimit() {
    const input = document.getElementById("aegis-run-limit");
    let n = parseInt(input.value, 10);
    if (!n || n < 1) n = 1000;
    input.value = String(n);
    currentSettings.runLimit = n;
    updateCount();
    const pending = (globalThis.chrome || globalThis.browser)?.runtime?.sendMessage?.({ action: "patchSettings", patch: { runLimit: n } });
    if (pending && typeof pending.catch === "function") pending.catch(() => {});
  }

  function makeDraggable(el) {
    const header = el.querySelector(".aegis-header");
    let mouse = { x: 0, y: 0 };
    header.onmousedown = (e) => {
      if (e.target.closest("button, a, input")) return;
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      document.onmousemove = (ev) => {
        const dx = mouse.x - ev.clientX;
        const dy = mouse.y - ev.clientY;
        mouse.x = ev.clientX;
        mouse.y = ev.clientY;
        el.style.right = "auto";
        el.style.top = el.offsetTop - dy + "px";
        el.style.left = el.offsetLeft - dx + "px";
      };
      document.onmouseup = () => {
        document.onmousemove = null;
        document.onmouseup = null;
      };
    };
  }

  function log(msg, type) {
    const logEl = document.getElementById("aegis-log");
    if (!logEl) return;
    const row = document.createElement("div");
    row.className = "log-" + (type || "info");
    row.textContent = new Date().toLocaleTimeString() + "  " + msg;
    logEl.prepend(row);
    while (logEl.childElementCount > 20) logEl.lastChild.remove();
  }

  function updateStatus(text) {
    const el = document.getElementById("aegis-status");
    if (el) el.textContent = text;
  }

  function runCap() {
    const n = parseInt(document.getElementById("aegis-run-limit")?.value, 10);
    if (n > 0) return n;
    return currentSettings.runLimit || 1000;
  }

  function updateCount() {
    const el = document.getElementById("aegis-count");
    if (el) el.textContent = invitesSent + " / " + runCap();
  }

  function setButtons(running) {
    const start = document.getElementById("aegis-start");
    const stop = document.getElementById("aegis-stop");
    const cur = document.getElementById("aegis-scan-current");
    if (start) start.disabled = running;
    if (stop) stop.disabled = !running;
    if (cur) cur.disabled = running;
  }

  function loadSettings() {
    return new Promise((resolve) => {
      const rt = (globalThis.chrome || globalThis.browser)?.runtime;
      if (!rt?.sendMessage) {
        currentSettings = { runLimit: 1000 };
        resolve(currentSettings);
        return;
      }
      rt.sendMessage({ action: "getSettings" }, (res) => {
        currentSettings = res?.settings || {};
        todayBase = res?.stats?.invitesToday || 0;
        const input = document.getElementById("aegis-run-limit");
        if (input && document.activeElement !== input) input.value = currentSettings.runLimit || 1000;
        updateCount();
        resolve(currentSettings);
      });
    });
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function sleepWhileRunning(ms) {
    const end = Date.now() + ms;
    while (isRunning && Date.now() < end) await sleep(Math.min(200, end - Date.now()));
  }

  async function randomDelay() {
    const min = +currentSettings.delayMin || 1500;
    const max = Math.max(min, +currentSettings.delayMax || 4500);
    await sleepWhileRunning(min + Math.random() * (max - min));
  }

  function resumeAfterLimit() {
    return currentSettings.resumeAfterLimit !== false;
  }

  async function waitTwentyMinutes(label) {
    const total = 20 * 60;
    for (let s = total; s > 0 && isRunning; s--) {
      const m = Math.floor(s / 60);
      const r = s % 60;
      updateStatus(label + m + "m " + String(r).padStart(2, "0") + "s");
      await sleep(1000);
    }
  }

  async function continueSamePost(why) {
    if (!why || why.indexOf("Run limit reached") !== 0 || !resumeAfterLimit()) return false;
    log(why + ". Pausing 20 minutes, then continuing this post", "warn");
    await waitTwentyMinutes("Same post resumes in ");
    if (!isRunning) return false;
    todayBase += invitesSent;
    invitesSent = 0;
    updateCount();
    log("Starting invites again on this post", "info");
    updateStatus("Scanning reactions…");
    if (!document.querySelector('div[role="dialog"]')) {
      const again = await ensureDialog(document);
      if (!again) {
        log("Reactions window is closed. Open it again to continue.", "warn");
        return false;
      }
    }
    return true;
  }

  function limitReason() {
    if (invitesSent >= runCap()) return "Run limit reached (" + runCap() + ")";
    const daily = +currentSettings.dailyLimit || 0;
    if (daily && todayBase + invitesSent >= daily) return "Daily limit reached (" + daily + ")";
    return "";
  }

  function buttonLabel(el) {
    const aria = (el.getAttribute("aria-label") || "").trim();
    if (aria) return aria;
    const text = (el.textContent || "").trim().replace(/\s+/g, " ");
    return text;
  }

  function actionText(el) {
    if (!el) return "";
    const copy = el.cloneNode(true);
    copy.querySelectorAll("button, [role='button']").forEach((n) => n.remove());
    return (copy.innerText || copy.textContent || "").trim().replace(/\s+/g, " ").toLowerCase();
  }

  function isFollowControl(el) {
    if (!el || el.closest("#aegis-panel") || el.dataset.aegisDone) return false;
    if (el.getAttribute("aria-disabled") === "true") return false;
    const vis = actionText(el);
    if (!vis || vis.length > 32) return false;
    if (vis === "following" || vis.startsWith("following ") || vis.includes("unfollow")) return false;
    return vis === "follow" || vis.startsWith("follow ");
  }

  function isInviteControl(el) {
    if (!el || el.closest("#aegis-panel") || el.dataset.aegisDone) return false;
    if (el.getAttribute("aria-disabled") === "true") return false;
    if (isFollowControl(el)) return false;
    const vis = actionText(el);
    if (vis.includes("invited") || vis.includes("cancel") || vis.includes("undo") || vis.includes("follow")) return false;
    if (vis === "invite" || vis.startsWith("invite ")) return true;
    const aria = (el.getAttribute("aria-label") || "").trim().toLowerCase();
    if (vis) return false;
    if (!aria || aria.length > 48 || aria.includes("follow") || aria.includes("invited")) return false;
    return aria === "invite" || aria.startsWith("invite ");
  }

  function clickFollowToo() {
    return currentSettings.followButtons === "click";
  }

  function rowHasFollow(row) {
    if (!row) return false;
    const buttons = row.querySelectorAll("button, [role='button']");
    for (const b of buttons) {
      if (isFollowControl(b)) return true;
    }
    return false;
  }

  function findActionButtons(root) {
    const scope = root && root.querySelectorAll ? root : document;
    const nodes = scope.querySelectorAll('[role="button"], button');
    const hits = [];
    const allowFollow = clickFollowToo();
    for (const el of nodes) {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const invite = isInviteControl(el);
      const follow = allowFollow && isFollowControl(el);
      if (!invite && !follow) continue;
      const row = reactionRow(el);
      if (!allowFollow && rowHasFollow(row)) continue;
      hits.push(el);
    }
    return hits.filter((el) => !hits.some((other) => other !== el && el.contains(other)));
  }

  function findWorkRoot() {
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"], [aria-modal="true"]'));
    const reactions = dialogs.filter(isReactionsDialog);
    const pool = reactions.length ? reactions : dialogs;
    if (!pool.length) return document.body;
    pool.sort((a, b) => {
      const score = (el) => el.querySelectorAll('[role="listitem"], [role="row"]').length * 20 + el.querySelectorAll('[role="button"], button').length;
      return score(b) - score(a);
    });
    return pool[0];
  }

  function press(el) {
    if (!el) return;
    const opts = { bubbles: true, cancelable: true, view: window };
    try {
      el.dispatchEvent(new PointerEvent("pointerdown", opts));
      el.dispatchEvent(new MouseEvent("mousedown", opts));
      el.dispatchEvent(new PointerEvent("pointerup", opts));
      el.dispatchEvent(new MouseEvent("mouseup", opts));
    } catch (e) {
      /* a plain click still runs below */
    }
    el.click();
  }

  function layerName(el) {
    const aria = el.getAttribute("aria-label") || "";
    let extra = "";
    (el.getAttribute("aria-labelledby") || "").split(/\s+/).forEach((id) => {
      if (!id) return;
      const node = document.getElementById(id);
      if (node) extra += " " + (node.innerText || node.textContent || "");
    });
    return (aria + " " + extra).trim().replace(/\s+/g, " ");
  }

  function isPlainAction(name) {
    const low = (name || "").trim().toLowerCase();
    return /^(like|love|care|haha|wow|sad|angry|react|reply|comment|share|send|message|follow|hide comment|hide|more|options)$/.test(low);
  }

  function faceCount(el) {
    if (!el || !el.querySelectorAll) return 0;
    let n = 0;
    el.querySelectorAll('img[alt], svg[aria-label], [role="img"][aria-label]').forEach((node) => {
      const alt = (node.getAttribute("alt") || node.getAttribute("aria-label") || "").toLowerCase();
      if (/^(like|love|care|haha|wow|sad|angry)\b/.test(alt)) n += 1;
    });
    return n;
  }

  function isReactionsDialog(dialog) {
    if (!dialog || dialog.closest("#aegis-panel") || dialog.getAttribute("role") === "menu") return false;
    if (findActionButtons(dialog).length) return true;
    const label = (layerName(dialog) + " " + (dialog.innerText || "").slice(0, 280)).toLowerCase();
    const rows = dialog.querySelectorAll('[role="listitem"], [role="row"]').length;
    if (rows >= 2 && /react|invite|\ball\b|like|love/.test(label)) return true;
    const names = ["all", "like", "love", "care", "haha", "wow", "sad", "angry"];
    let tabs = 0;
    dialog.querySelectorAll('[role="tab"]').forEach((tab) => {
      if (names.indexOf(actionText(tab)) !== -1) tabs += 1;
    });
    return tabs >= 2;
  }

  function reactionScore(el) {
    if (!el || el.closest("#aegis-panel")) return 0;
    const name = layerName(el);
    const text = (el.innerText || "").trim().replace(/\s+/g, " ");
    const blob = (name + " " + text).toLowerCase();
    if (isPlainAction(name) || isPlainAction(text)) return 0;
    if (/see who reacted|people who reacted|person reacted|all reactions|\breactions?\b|\breacted\b/.test(blob)) return 9;
    const href = el.getAttribute("href") || "";
    if (/\/reactions|reaction_type/i.test(href)) return 9;
    if (/\b(like|love|care|haha|wow|sad|angry)\b/.test(blob) && /\d/.test(blob) && blob.length < 100) return 8;
    const faces = faceCount(el);
    const icons = el.querySelectorAll ? el.querySelectorAll("img, svg").length : 0;
    const numeric = /^[\d][\d,.\s]*[kmb]?$/i.test(text);
    if (faces >= 1 && (numeric || /\d/.test(name))) return 7;
    if (numeric && icons >= 2) return 7;
    if (numeric && icons === 1 && el.matches('a, button, [role="button"], [role="link"]')) return 4;
    return 0;
  }

  function clickableReaction(el) {
    let best = el;
    let node = el;
    for (let i = 0; i < 6 && node && node !== document.body; i++) {
      const r = node.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) break;
      if (r.height > 88 || r.width > 460) break;
      best = node;
      if (node.matches('a, button, [role="button"], [role="link"]')) return node;
      node = node.parentElement;
    }
    return best;
  }

  function findReactionTriggers(scope) {
    const root = scope && scope.querySelectorAll ? scope : document;
    const nodes = root.querySelectorAll('a, button, [role="button"], [role="link"], [aria-label*="react" i], [aria-label*="Like:" i], [aria-label*="Love:" i], img[alt], svg[aria-label]');
    const hits = [];
    const seen = new Set();
    nodes.forEach((el) => {
      if (el.closest("#aegis-panel")) return;
      const score = reactionScore(el);
      if (!score) return;
      const click = clickableReaction(el);
      if (!click || seen.has(click) || click.closest("#aegis-panel") || click.dataset.aegisOpenTry) return;
      if (isPlainAction(layerName(click)) || isPlainAction((click.innerText || "").trim())) return;
      const r = click.getBoundingClientRect();
      if (r.width < 8 || r.height < 8 || r.height > 88 || r.width > 460) return;
      seen.add(click);
      const visible = r.bottom > 40 && r.top < window.innerHeight - 40 && r.right > 0 && r.left < window.innerWidth;
      hits.push({ el: click, score: score + (visible ? 1 : 0), area: Math.max(1, r.width * r.height) });
    });
    hits.sort((a, b) => b.score - a.score || a.area - b.area);
    return hits.map((hit) => hit.el);
  }

  function scrollables(root) {
    const scope = root && root.querySelectorAll ? root : document.body;
    const out = [];
    scope.querySelectorAll("div, ul, section, main").forEach((el) => {
      if (el.id === "aegis-panel" || el.closest("#aegis-panel")) return;
      const oy = getComputedStyle(el).overflowY;
      const can = oy === "auto" || oy === "scroll" || oy === "overlay";
      const hiddenList = oy === "hidden" && el.querySelector('[role="list"], [role="listitem"], [role="row"]');
      if (!can && !hiddenList) return;
      if (el.clientHeight > 60 && el.scrollHeight > el.clientHeight + 16) out.push(el);
    });
    return out;
  }

  function findReactionScroller(dialog) {
    const list = scrollables(dialog);
    if (!list.length) return null;
    list.sort((a, b) => {
      const items = (el) => el.querySelectorAll('[role="listitem"], [role="row"]').length;
      const diff = items(b) - items(a);
      if (diff) return diff;
      return b.scrollHeight - a.scrollHeight;
    });
    return list[0];
  }

  function scrollReactionList(dialog) {
    const bars = scrollables(dialog);
    const before = bars.map((s) => s.scrollTop);
    const items = dialog.querySelectorAll('[role="listitem"], [role="row"]');
    const last = items[items.length - 1];
    if (last) {
      try {
        last.scrollIntoView({ block: "end", inline: "nearest", behavior: "instant" });
      } catch (e) {
        last.scrollIntoView(false);
      }
    }
    let moved = false;
    bars.forEach((s, i) => {
      const step = Math.max(240, Math.round(s.clientHeight * 0.85));
      const max = Math.max(0, s.scrollHeight - s.clientHeight);
      s.scrollTop = Math.min(max, Math.max(s.scrollTop, before[i]) + step);
      s.dispatchEvent(new Event("scroll", { bubbles: true }));
      if (s.scrollTop > before[i] + 2) moved = true;
    });
    if (!moved) {
      const main = document.querySelector('[role="main"]');
      if (main && main.scrollHeight > main.clientHeight + 16) {
        const top = main.scrollTop;
        main.scrollTop += Math.max(280, Math.round(main.clientHeight * 0.75));
        if (main.scrollTop > top + 2) moved = true;
      }
      const y = window.scrollY;
      window.scrollBy(0, 700);
      if (window.scrollY > y + 2) moved = true;
    }
    return moved;
  }

  function findLoadMore(root) {
    const nodes = root.querySelectorAll('button, [role="button"], a');
    for (const el of nodes) {
      if (el.closest("#aegis-panel")) continue;
      const low = buttonLabel(el).toLowerCase();
      if (!low || low.length > 42) continue;
      if (low === "see more" || low === "see all" || low === "load more" || low === "next" || low === "more" || low.startsWith("see more") || low.startsWith("show more")) {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        return el;
      }
    }
    return null;
  }

  function isInView(el, scroller) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const bounds = scroller ? scroller.getBoundingClientRect() : { top: 0, bottom: window.innerHeight, left: 0, right: window.innerWidth };
    const top = Math.max(bounds.top, 0) + 2;
    const bottom = Math.min(bounds.bottom, window.innerHeight) - 2;
    const left = Math.max(bounds.left, 0);
    const right = Math.min(bounds.right, window.innerWidth);
    const mid = r.top + r.height / 2;
    return mid >= top + 1 && mid <= bottom - 1;
  }

  function reveal(el, scroller) {
    const before = scroller ? scroller.scrollTop : window.scrollY;
    try {
      el.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
    } catch (e) {
      el.scrollIntoView(true);
    }
    if (!scroller) return;
    const c = scroller.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const delta = r.top + r.height / 2 - (c.top + c.height / 2);
    if (Math.abs(delta) > 6) scroller.scrollTop += delta;
    if (Math.abs(scroller.scrollTop - before) < 2) {
      scroller.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: delta > 0 ? 420 : -420 }));
    }
  }

  function scrollStep(scroller) {
    if (!scroller) return false;
    const before = scroller.scrollTop;
    const step = Math.max(240, Math.round(scroller.clientHeight * 0.85));
    const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    scroller.scrollTop = Math.min(max, before + step);
    scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
    return scroller.scrollTop > before + 2;
  }

  function pickNext(buttons, scroller) {
    if (!buttons.length) return null;
    const c = scroller ? scroller.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
    const ranked = buttons
      .map((el) => ({ el, top: el.getBoundingClientRect().top }))
      .sort((a, b) => a.top - b.top);
    const visible = ranked.find((x) => isInView(x.el, scroller));
    if (visible) return visible.el;
    const below = ranked.find((x) => x.top >= c.top);
    return (below || ranked[0]).el;
  }

  function reactionRow(btn) {
    const row = btn.closest('[role="listitem"], [role="row"]');
    if (row && !row.closest("#aegis-panel")) return row;
    let el = btn.parentElement;
    for (let i = 0; i < 5 && el; i++) {
      if (el.getAttribute("role") === "dialog" || el === document.body) break;
      if (el.parentElement?.getAttribute("role") === "list") return el;
      el = el.parentElement;
    }
    return null;
  }

  function stripMedia(node) {
    if (!node || !node.querySelectorAll) return 0;
    let n = 0;
    node.querySelectorAll("img, video, source").forEach((m) => {
      if (m.getAttribute("src") || m.getAttribute("srcset")) n += 1;
      m.removeAttribute("src");
      m.removeAttribute("srcset");
      if ("src" in m) m.src = "";
    });
    return n;
  }

  function freeRow(node) {
    if (!node || node === document.body || node.id === "aegis-panel") return;
    if (node.closest && node.closest("#aegis-panel")) return;
    if (node.dataset && node.dataset.aegisFreed) return;
    if (node.getAttribute && node.getAttribute("role") === "dialog") return;
    const h = node.offsetHeight || node.getBoundingClientRect().height || 0;
    stripMedia(node);
    node.replaceChildren();
    if (node.dataset) node.dataset.aegisFreed = "1";
    node.style.height = Math.max(h, 8) + "px";
    node.style.minHeight = node.style.height;
    node.style.overflow = "hidden";
    node.style.padding = "0";
  }

  function unloadRam(scope) {
    const root = scope && scope.querySelectorAll ? scope : document.querySelector('div[role="dialog"]');
    if (!root) return 0;
    const top = root.getBoundingClientRect().top;
    let freed = 0;
    root.querySelectorAll('[role="listitem"], [role="row"]').forEach((item) => {
      if (item.closest("#aegis-panel")) return;
      const b = item.getBoundingClientRect();
      if (b.height > 0 && b.bottom < top - 80) {
        const pending = Array.from(item.querySelectorAll('[role="button"], button')).some(isInviteControl);
        if (pending) return;
        freeRow(item);
        freed += 1;
      }
    });
    return freed;
  }

  function personKey(row) {
    if (!row) return "";
    const href = row.querySelector("a[href]")?.getAttribute("href") || "";
    return href ? href.split("?")[0] : "";
  }

  function remember(key) {
    if (!key || recentSet.has(key)) return;
    recentKeys.push(key);
    recentSet.add(key);
    if (recentKeys.length > 80) recentSet.delete(recentKeys.shift());
  }

  async function cooldown() {
    log("40 invites sent — pausing 1 minute", "warn");
    for (let s = BREAK_MS / 1000; s > 0 && isRunning; s--) {
      updateStatus("Break " + s + "s · " + invitesSent + " sent");
      await sleep(1000);
    }
    if (isRunning) updateStatus("Scanning reactions…");
  }

  async function selectAllReactions(dialog) {
    if (!dialog || !dialog.querySelectorAll) return;
    const tabs = Array.from(dialog.querySelectorAll('[role="tab"]'));
    const pool = tabs.length ? tabs : Array.from(dialog.querySelectorAll('button, [role="button"], a'));
    const all = pool.find((el) => {
      if (el.closest("#aegis-panel")) return false;
      const name = (actionText(el) || layerName(el) || "").toLowerCase().replace(/\s+/g, " ").trim();
      if (!name || name.length > 28) return false;
      if (name === "all" || name === "all reactions") return true;
      return /^all\b/.test(name) && /\d/.test(name) && !/comment|message|photo|video/.test(name);
    });
    if (!all) return;
    if (all.getAttribute("aria-selected") === "true" || all.getAttribute("aria-pressed") === "true") {
      log("All reactions", "info");
      return;
    }
    press(all);
    log("Switched to All reactions", "info");
    await sleepWhileRunning(600);
  }

  async function drainDialog(root) {
    let stalled = 0;
    let lastSize = 0;
    let notedScroll = false;
    let choseAll = false;
    while (isRunning) {
      const dialog = root && root.isConnected ? root : findWorkRoot();
      if (!choseAll) {
        choseAll = true;
        await selectAllReactions(dialog);
        if (!isRunning) return;
        continue;
      }
      const why = limitReason();
      if (why) {
        if (await continueSamePost(why)) continue;
        log(why, "warn");
        return;
      }
      const scroller = findReactionScroller(dialog);
      const target = pickNext(findActionButtons(dialog), scroller);
      if (!target) {
        const size = dialog.querySelectorAll('[role="listitem"], [role="row"]').length + (scroller ? scroller.scrollHeight : 0);
        if (size > lastSize + 8) stalled = 0;
        lastSize = size;
        const freed = unloadRam(scroller || dialog);
        if (freed) log("RAM unload freed " + freed + " rows", "info");
        const more = findLoadMore(dialog);
        if (more) {
          more.click();
          stalled = 0;
          notedScroll = false;
          log("Loading the next reactions", "info");
          await sleepWhileRunning(900);
          continue;
        }
        const moved = scrollReactionList(dialog);
        if (moved) {
          stalled = 0;
          if (!notedScroll) {
            log("Scrolling for more reactions", "info");
            notedScroll = true;
          }
          await sleepWhileRunning(650);
          continue;
        }
        stalled += 1;
        if (stalled === 1) log("Waiting for more reactions to load", "info");
        if (stalled >= 8) {
          log("No more invites in view", "info");
          return;
        }
        await sleepWhileRunning(700);
        continue;
      }
      if (!isInView(target, scroller)) {
        reveal(target, scroller);
        await sleepWhileRunning(180);
        if (!isRunning) return;
        if (!isInView(target, scroller) && !isInView(target, null)) {
          scrollReactionList(dialog);
          await sleepWhileRunning(220);
          continue;
        }
      }
      stalled = 0;
      notedScroll = false;
      const row = reactionRow(target);
      const key = personKey(row);
      if (key && recentSet.has(key)) {
        freeRow(row);
        continue;
      }
      const followed = isFollowControl(target);
      try {
        target.dataset.aegisDone = "1";
        target.click();
      } catch (err) {
        log("Click failed", "error");
        stripMedia(row || target);
        continue;
      }
      remember(key);
      invitesSent += 1;
      updateCount();
      const statsMsg = (globalThis.chrome || globalThis.browser)?.runtime?.sendMessage?.({ action: "updateStats", count: 1 });
      if (statsMsg && typeof statsMsg.catch === "function") statsMsg.catch(() => {});
      log((followed ? "Follow clicked (" : "Invite sent (") + invitesSent + ")", "success");
      await sleepWhileRunning(200);
      stripMedia(row || target);
      const whyNow = limitReason();
      if (whyNow) {
        if (await continueSamePost(whyNow)) continue;
        return;
      }
      if (invitesSent % 6 === 0) {
        const freed = unloadRam(scroller || dialog);
        if (freed) log("RAM unload freed " + freed + " rows", "info");
      }
      if (invitesSent % BREAK_EVERY === 0) await cooldown();
      await randomDelay();
    }
  }

  function closeDialog() {
    const btn = document.querySelector('div[role="dialog"] [aria-label="Close"], div[role="dialog"] [aria-label*="Close" i]');
    if (btn) btn.click();
  }

  function scrollParent(el) {
    const start = el && el.nodeType === 1 ? el : null;
    let node = start;
    while (node && node !== document.documentElement) {
      const oy = getComputedStyle(node).overflowY;
      if ((oy === "auto" || oy === "scroll" || oy === "overlay") && node.scrollHeight > node.clientHeight + 24) return node;
      node = node.parentElement;
    }
    return document.scrollingElement || document.documentElement;
  }

  function threadPane() {
    const bars = scrollables(document.body).filter((el) => {
      const r = el.getBoundingClientRect();
      const mid = r.left + r.width / 2;
      return r.height > 160 && r.width > 180 && mid > window.innerWidth * 0.25 && mid < window.innerWidth * 0.8;
    });
    bars.sort((a, b) => b.clientHeight - a.clientHeight);
    return bars[0] || null;
  }

  async function waitForReactions() {
    for (let i = 0; i < 16 && isRunning; i++) {
      await sleep(250);
      const layers = document.querySelectorAll('[role="dialog"], [aria-modal="true"]');
      for (const layer of layers) {
        if (isReactionsDialog(layer)) return layer;
      }
    }
    return null;
  }

  function pressReaction(el) {
    const parent = scrollParent(el);
    reveal(el, parent);
    const r = el.getBoundingClientRect();
    press(el);
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return;
    const hit = document.elementFromPoint(x, y);
    if (!hit || hit.closest("#aegis-panel")) return;
    if (hit === el || el.contains(hit) || hit.contains(el)) {
      const inner = hit.closest('[role="button"], a, button') || hit;
      if (inner !== el) press(inner);
    }
  }

  async function openReactions(scope) {
    const already = Array.from(document.querySelectorAll('[role="dialog"], [aria-modal="true"]')).find(isReactionsDialog);
    if (already) {
      log("Reactions already open", "info");
      return already;
    }
    log("Opening post reactions", "info");
    const panes = [];
    const thread = threadPane();
    if (scope && scope.querySelectorAll && scope !== document) panes.push(scope);
    if (thread && panes.indexOf(thread) === -1) panes.push(thread);
    panes.push(document);

    for (const pane of panes) {
      if (!isRunning) return null;
      const bar = pane === document ? scrollParent(document.body) : scrollParent(pane);
      if (bar && bar.scrollTop > 0) bar.scrollTop = 0;
      await sleepWhileRunning(200);
      let viewed = false;
      for (let step = 0; step < 8 && isRunning; step++) {
        const triggers = findReactionTriggers(pane === document ? document : pane);
        if (triggers.length) {
          const trigger = triggers[0];
          trigger.dataset.aegisOpenTry = "1";
          log(trigger.getBoundingClientRect().top > 0 && trigger.getBoundingClientRect().bottom < window.innerHeight ? "Clicking the reaction count" : "Scrolling to the reaction count", "info");
          pressReaction(trigger);
          const opened = await waitForReactions();
          if (opened) {
            log("Reactions opened", "info");
            return opened;
          }
        }
        if (!viewed) {
          viewed = true;
          const view = findViewPost(pane === document ? document : pane);
          if (view) {
            press(view);
            log("Opened the post", "info");
            await sleepWhileRunning(900);
            continue;
          }
        }
        if (!bar) break;
        const before = bar.scrollTop;
        bar.scrollTop = Math.min(bar.scrollHeight, before + Math.max(240, Math.round(bar.clientHeight * 0.75)));
        bar.dispatchEvent(new Event("scroll", { bubbles: true }));
        if (bar.scrollTop <= before + 2) break;
        await sleepWhileRunning(350);
      }
    }
    log("Could not open post reactions", "warn");
    return null;
  }

  async function ensureDialog(scope) {
    return openReactions(scope || document);
  }

  function inBusinessInbox() {
    return /business\.facebook\.com$/i.test(location.hostname) && /\/inbox/i.test(location.pathname);
  }

  function centerPane() {
    return document.querySelector('[role="main"]') || document.body;
  }

  function inboxScroller() {
    const bars = scrollables(document.body).filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 80 && r.width < window.innerWidth * 0.5 && r.left < window.innerWidth * 0.2 && r.height > 140;
    });
    bars.sort((a, b) => b.clientHeight - a.clientHeight);
    return bars[0] || null;
  }

  function threadKey(el) {
    const link = el.matches("a[href]") ? el : el.querySelector("a[href]");
    const href = link?.getAttribute("href") || "";
    if (href && /selected_item_id|thread_id|comment_id|inbox/i.test(href)) return href.split("#")[0];
    return (el.innerText || "").trim().replace(/\s+/g, " ").slice(0, 140);
  }

  function inboxThreads() {
    const nodes = document.querySelectorAll('[role="row"], [role="listitem"], [role="option"], a[href*="selected_item_id"], a[href*="inbox"]');
    const seen = new Set();
    const out = [];
    nodes.forEach((el) => {
      if (el.closest("#aegis-panel")) return;
      if (el.dataset.aegisThread) return;
      const r = el.getBoundingClientRect();
      if (r.width < 48 || r.height < 40 || r.height > 240) return;
      if (r.left > window.innerWidth * 0.48 || r.right < 0) return;
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      const text = (el.innerText || "").trim().replace(/\s+/g, " ");
      if (!text || text.length < 2 || text.length > 500) return;
      if (/^(inbox|facebook comments|instagram comments|messenger|all|done|spam|unread)$/i.test(text)) return;
      const key = threadKey(el);
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push(el);
    });
    return out.filter((el) => !out.some((other) => other !== el && other.contains(el)));
  }

  function scrollInboxList() {
    const bar = inboxScroller();
    if (!bar) return false;
    const before = bar.scrollTop;
    bar.scrollTop = Math.min(bar.scrollHeight - bar.clientHeight, before + Math.max(240, bar.clientHeight * 0.8));
    bar.dispatchEvent(new Event("scroll", { bubbles: true }));
    return bar.scrollTop > before + 2;
  }

  function findViewPost(scope) {
    const root = scope && scope.querySelectorAll ? scope : document;
    const nodes = root.querySelectorAll('a, button, [role="button"], [role="link"]');
    for (const el of nodes) {
      if (el.closest("#aegis-panel")) continue;
      const low = actionText(el) || buttonLabel(el).toLowerCase();
      if (!low || low.length > 40) continue;
      if (low === "view post" || low === "see post" || low === "open post" || low.startsWith("view post") || low.startsWith("see post") || low.startsWith("open post") || low.startsWith("view the post")) return el;
    }
    return null;
  }

  async function openThreadReactions() {
    return openReactions(centerPane());
  }

  async function waitBetweenPosts() {
    if (currentSettings.waitBetweenPosts === false) return;
    log("Waiting 20 minutes before the next post", "warn");
    await waitTwentyMinutes("Next post in ");
    if (isRunning) updateStatus("Scanning posts…");
  }

  async function runInbox() {
    updateStatus("Scanning Facebook comments…");
    log("Inbox scan — Facebook comments", "info");
    const seen = new Set();
    let scanned = 0;
    let idle = 0;
    const cap = currentSettings.maxPostsPerPage || 20;
    while (isRunning && scanned < cap && !limitReason()) {
      const next = inboxThreads().find((el) => !seen.has(threadKey(el)));
      if (!next) {
        if (!scrollInboxList()) {
          idle += 1;
          if (idle >= 4) break;
          await sleepWhileRunning(600);
          continue;
        }
        idle = 0;
        await sleepWhileRunning(500);
        continue;
      }
      idle = 0;
      const key = threadKey(next);
      seen.add(key);
      next.dataset.aegisThread = "1";
      try {
        next.scrollIntoView({ block: "center", behavior: "instant" });
      } catch (e) {
        next.scrollIntoView(true);
      }
      await sleepWhileRunning(250);
      next.click();
      scanned += 1;
      log("Comment thread " + scanned, "info");
      await sleepWhileRunning(900);
      if (!isRunning || limitReason()) return scanned;
      closeDialog();
      const dialog = await openThreadReactions();
      if (dialog && isRunning) {
        await sleepWhileRunning(400);
        await drainDialog(dialog);
        closeDialog();
      } else {
        log("No reactions on this thread", "info");
      }
      const moreLeft = scanned < cap && isRunning && !limitReason();
      if (moreLeft) await waitBetweenPosts();
    }
    if (!scanned) log("No Facebook comment threads found in the inbox list", "warn");
    return scanned;
  }

  async function runCurrentPost() {
    updateStatus("Opening reactions…");
    const dialog = await ensureDialog(document);
    if (!dialog || !isRunning) return;
    updateStatus("Scanning reactions…");
    await sleepWhileRunning(400);
    await drainDialog(dialog);
  }

  async function runFeed() {
    if (inBusinessInbox()) {
      await runInbox();
      return;
    }
    updateStatus("Scanning posts…");
    const posts = Array.from(document.querySelectorAll('[role="article"], div[data-pagelet*="FeedUnit"]')).slice(0, currentSettings.maxPostsPerPage || 20);
    log("Posts found: " + posts.length, "info");
    if (!posts.length) {
      await runCurrentPost();
      return;
    }
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      if (!isRunning || limitReason()) return;
      try {
        post.scrollIntoView({ block: "center", behavior: "instant" });
      } catch (e) {
        post.scrollIntoView(true);
      }
      await sleepWhileRunning(300);
      closeDialog();
      await sleepWhileRunning(200);
      const dialog = await ensureDialog(post);
      if (dialog && isRunning) {
        await sleepWhileRunning(400);
        await drainDialog(dialog);
        closeDialog();
      }
      if (i < posts.length - 1 && isRunning && !limitReason()) await waitBetweenPosts();
    }
  }

  function stopScan() {
    if (!isRunning) return;
    isRunning = false;
    setButtons(false);
    updateStatus("Stopped");
    log("Scan stopped", "info");
  }

  async function beginRun(mode) {
    if (isRunning) return;
    await loadSettings();
    saveRunLimit();
    invitesSent = 0;
    updateCount();
    isRunning = true;
    setButtons(true);
    log(mode === "post" ? "Scanning this post" : "Full scan started", "info");
    log(clickFollowToo() ? "Follow buttons will be clicked" : "Follow buttons will be skipped", "info");
    try {
      if (mode === "post") await runCurrentPost();
      else await runFeed();
    } catch (err) {
      log("Error: " + (err && err.message ? err.message : err), "error");
    }
    if (!isRunning) return;
    isRunning = false;
    setButtons(false);
    const why = limitReason();
    updateStatus(why || "Finished");
    log(why || "Scan finished", why ? "warn" : "success");
  }

  function init() {
    createPanel();
    log("Panel ready", "info");
    updateStatus("Ready");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  setInterval(() => {
    if (!document.getElementById("aegis-panel") && document.body) createPanel();
  }, 2000);
})();
