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
      '<span class="aegis-logo">AEGIS Invites for Facebook</span>' +
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
      '<a id="aegis-github" href="https://github.com/GambitMutant" target="_blank" rel="noopener noreferrer" aria-label="GitHub">' +
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

  function isInviteControl(el) {
    if (!el || el.closest("#aegis-panel") || el.dataset.aegisDone) return false;
    if (el.getAttribute("aria-disabled") === "true") return false;
    const low = buttonLabel(el).toLowerCase();
    if (!low || low.length > 28) return false;
    if (low.includes("invited") || low.includes("cancel") || low.includes("undo")) return false;
    return low === "invite" || low.startsWith("invite ");
  }

  function findInviteButtons(root) {
    const scope = root && root.querySelectorAll ? root : document;
    const nodes = scope.querySelectorAll('[role="button"]');
    const hits = [];
    const viewBot = window.innerHeight + 900;
    for (const el of nodes) {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      if (r.bottom < -240 || r.top > viewBot) continue;
      if (!isInviteControl(el)) continue;
      hits.push(el);
    }
    return hits.filter((el) => !hits.some((other) => other !== el && el.contains(other)));
  }

  function findReactionTriggers(scope) {
    const root = scope && scope.querySelectorAll ? scope : document;
    const out = [];
    root.querySelectorAll('[aria-label*="reaction" i], [aria-label*="reacted" i], a[href*="/reactions"]').forEach((el) => {
      if (el.closest("#aegis-panel")) return;
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) return;
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      out.push(el);
    });
    out.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return ra.width * ra.height - rb.width * rb.height;
    });
    return out;
  }

  function findReactionScroller(dialog) {
    const root = dialog && dialog.querySelectorAll ? dialog : document.querySelector('div[role="dialog"]');
    if (!root) return null;
    const list = root.querySelector('[role="list"]');
    let el = list ? list.parentElement : null;
    for (let i = 0; i < 6 && el; i++) {
      if (el.scrollHeight > el.clientHeight + 24 && el.clientHeight > 80) return el;
      el = el.parentElement;
    }
    const kids = root.querySelectorAll("div");
    let best = null;
    let score = 0;
    const cap = Math.min(kids.length, 60);
    for (let i = 0; i < cap; i++) {
      const d = kids[i];
      if (d.scrollHeight > d.clientHeight + 40 && d.clientHeight > 80 && d.scrollHeight > score) {
        score = d.scrollHeight;
        best = d;
      }
    }
    return best;
  }

  function isInView(el, scroller) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const bounds = scroller ? scroller.getBoundingClientRect() : { top: 0, bottom: window.innerHeight, left: 0, right: window.innerWidth };
    const top = Math.max(bounds.top, 0) + 2;
    const bottom = Math.min(bounds.bottom, window.innerHeight) - 2;
    const left = Math.max(bounds.left, 0);
    const right = Math.min(bounds.right, window.innerWidth);
    return r.top >= top && r.bottom <= bottom && r.left >= left && r.right <= right;
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
    if (!scroller) {
      const before = window.scrollY;
      window.scrollBy(0, 480);
      return window.scrollY > before + 2;
    }
    const before = scroller.scrollTop;
    const step = Math.max(160, Math.round(scroller.clientHeight * 0.6));
    scroller.scrollTop = before + step;
    scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
    if (scroller.scrollTop > before + 2) return true;
    scroller.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: step }));
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
    let n = 0;
    node.querySelectorAll("img, video, source").forEach((m) => {
      if (m.getAttribute("src") || m.getAttribute("srcset")) n += 1;
      m.removeAttribute("src");
      m.removeAttribute("srcset");
      if ("src" in m) m.src = "";
    });
    return n;
  }

  function dropNode(node) {
    if (!node || node === document.body || node.id === "aegis-panel") return;
    if (node.closest && node.closest("#aegis-panel")) return;
    if (node.getAttribute && node.getAttribute("role") === "dialog") return;
    stripMedia(node);
    node.replaceChildren();
    node.remove();
  }

  function unloadRam(scope) {
    const root = scope && scope.querySelectorAll ? scope : document.querySelector('div[role="dialog"]');
    if (!root) return 0;
    const top = root.getBoundingClientRect().top;
    let freed = 0;
    root.querySelectorAll('[role="listitem"], [role="row"]').forEach((item) => {
      if (item.closest("#aegis-panel")) return;
      const b = item.getBoundingClientRect();
      if (b.height > 0 && b.bottom < top - 48) {
        dropNode(item);
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

  async function drainDialog() {
    let idle = 0;
    while (isRunning) {
      const why = limitReason();
      if (why) {
        log(why, "warn");
        return;
      }
      const dialog = document.querySelector('div[role="dialog"]') || document.body;
      const scroller = findReactionScroller(dialog);
      const target = pickNext(findInviteButtons(dialog), scroller);
      if (!target) {
        const freed = unloadRam(scroller || dialog);
        if (freed) log("RAM unload freed " + freed + " rows", "info");
        if (!scrollStep(scroller)) {
          idle += 1;
          if (idle >= 3) {
            log("No more invites in view", "info");
            return;
          }
          await sleepWhileRunning(450);
        } else {
          idle = 0;
          await sleepWhileRunning(320);
        }
        continue;
      }
      if (!isInView(target, scroller)) {
        reveal(target, scroller);
        await sleepWhileRunning(160);
        if (!isRunning) return;
        if (!isInView(target, scroller)) {
          scrollStep(scroller);
          await sleepWhileRunning(180);
          continue;
        }
      }
      idle = 0;
      const row = reactionRow(target);
      const key = personKey(row);
      if (key && recentSet.has(key)) {
        dropNode(row);
        continue;
      }
      try {
        target.dataset.aegisDone = "1";
        target.click();
      } catch (err) {
        log("Click failed", "error");
        dropNode(row);
        continue;
      }
      remember(key);
      invitesSent += 1;
      updateCount();
      const statsMsg = (globalThis.chrome || globalThis.browser)?.runtime?.sendMessage?.({ action: "updateStats", count: 1 });
      if (statsMsg && typeof statsMsg.catch === "function") statsMsg.catch(() => {});
      log("Invite sent (" + invitesSent + ")", "success");
      await sleepWhileRunning(200);
      dropNode(row);
      if (!isRunning || limitReason()) return;
      if (invitesSent % 8 === 0) {
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

  async function ensureDialog(scope) {
    let dialog = document.querySelector('div[role="dialog"]');
    if (dialog) return dialog;
    const triggers = findReactionTriggers(scope || document);
    if (!triggers.length) {
      log("No reactions control found", "warn");
      return null;
    }
    triggers[0].click();
    for (let i = 0; i < 12 && isRunning; i++) {
      await sleep(200);
      dialog = document.querySelector('div[role="dialog"]');
      if (dialog) return dialog;
    }
    return null;
  }

  async function runCurrentPost() {
    updateStatus("Scanning reactions…");
    const dialog = await ensureDialog(document);
    if (!dialog || !isRunning) return;
    await sleepWhileRunning(400);
    await drainDialog();
  }

  async function runFeed() {
    updateStatus("Scanning posts…");
    const posts = Array.from(document.querySelectorAll('[role="article"], div[data-pagelet*="FeedUnit"]')).slice(0, currentSettings.maxPostsPerPage || 20);
    log("Posts found: " + posts.length, "info");
    if (!posts.length) {
      await runCurrentPost();
      return;
    }
    for (const post of posts) {
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
      if (!dialog || !isRunning) continue;
      await sleepWhileRunning(400);
      await drainDialog();
      closeDialog();
      await sleepWhileRunning(200);
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
