// gsap-debugger-webflow-v4.3.2.js
// Version: 4.3.2 — Skip zero-duration & infinite-loop tweens; expire pre-finished animations

(function () {
  "use strict";

  function initDebugger() {
    console.log("🐛 GSAP Debugger v4.3.2 Loaded");

    // --- CONFIGURATION ---
    const VERSION = "4.3.2";
    const PARAM = "debug";
    const LS_KEY = "gsapDebuggerEnabled";
    const FADE_OUT_MS = 3000;
    const LOG_FLUSH_INTERVAL = 200; // ms

    // --- DEBUG FLAG ---
    let enabled = localStorage.getItem(LS_KEY) === "true";
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.has(PARAM)) {
        enabled = params.get(PARAM) === "true";
        localStorage.setItem(LS_KEY, enabled);
      }
    } catch (e) {
      console.warn("GSAP Debugger param error", e);
    }
    if (!enabled) return;

    // --- UTIL: Element Identifier ---
    function getElementIdentifier(el) {
      if (!el) return "N/A";
      if (el === window) return "Window";
      if (el === document.body) return "Body";
      if (el.id) return `#${el.id}`;
      if (typeof el.className === "string" && el.className) {
        const cls = el.className.split(" ").filter((c) => c)[0];
        if (cls) return `.${cls}`;
      }
      return el.tagName ? `<${el.tagName.toLowerCase()}>` : "Unknown";
    }

    // --- INJECT STYLES ---
    const css = `
      #gsap-debugger { position: fixed; bottom:10px; left:10px; width:auto; max-width:80%;
        background:rgba(0,0,0,0.85); color:#fff; font:12px monospace; padding:10px;
        max-height:90vh; display:flex; flex-direction:column; z-index:2147483647;
        box-shadow:0 2px 10px rgba(0,0,0,0.5);
      }
      #gsap-debugger h4 { margin:0; font-size:16px; color:#0ff; }
      #dbg-menu { display:flex; flex-wrap:wrap; gap:8px; margin:6px 0; }
      .dbg-toggle-btn { padding:4px 8px; background:rgba(255,255,255,0.1);
        border:1px solid #777; border-radius:4px; color:#fff; font-size:12px;
        cursor:pointer; user-select:none;
      }
      .dbg-toggle-btn.active { background:rgba(0,150,0,0.6); border-color:#0a0; }
      #dbg-content { flex:1 1 auto; display:flex; gap:8px; overflow:hidden; }
      .dbg-section { flex:1 1 0; background:rgba(255,255,255,0.05);
        border:1px solid rgba(255,255,255,0.1); border-radius:4px; padding:6px;
        overflow-y:auto;
      }
      .dbg-item { margin:4px 0; padding:4px; border-left:3px solid #0f0;
        background:rgba(255,255,255,0.05);
      }
      .dbg-item.completed { border-color:#f90; opacity:0.6; transition:opacity 1s; }
      .dbg-target { color:#ff0; margin:0 4px; font-style:italic; }
      #dbg-vars { font-size:10px; color:#ccc; white-space:pre-wrap; margin-top:2px; }
      #dbg-callback-log { font-size:10px; color:#0ff; }
      #dbg-scroll-pos { margin-top:6px; text-align:right; font-size:12px; color:#fff; }
    `;
    document.head.insertAdjacentHTML("beforeend", `<style>${css}</style>`);

    // --- BUILD UI ---
    const container = document.createElement("div");
    container.id = "gsap-debugger";
    container.innerHTML = `
      <h4>GSAP Debugger v${VERSION}</h4>
      <div id="dbg-menu"></div>
      <div id="dbg-content">
        <div id="dbg-list" class="dbg-section"></div>
        <div id="dbg-callback-log" class="dbg-section"></div>
      </div>
      <div id="dbg-scroll-pos"></div>
    `;
    document.body.appendChild(container);

    // --- REFERENCES & STATE ---
    const menuEl = container.querySelector("#dbg-menu");
    const listEl = container.querySelector("#dbg-list");
    const logEl = container.querySelector("#dbg-callback-log");
    const posEl = container.querySelector("#dbg-scroll-pos");
    const features = [
      "callbacks",
      "vars",
      "hold",
      "stEvents",
      "stMarkers",
      "dom",
    ];
    const labels = {
      callbacks: "Trace Callbacks",
      vars: "Inspect Vars",
      hold: "Hold",
      stEvents: "ST Events",
      stMarkers: "ST Markers",
      dom: "DOM Observe",
    };
    const state = {};
    const logQueue = [];
    const tracked = new Map();
    const stWrapped = new WeakSet();
    let domObserver = null;

    // --- TOGGLE BUTTONS ---
    features.forEach((key) => {
      state[key] = JSON.parse(
        localStorage.getItem(`gsapDebugger_${key}`) || "false"
      );
      const btn = document.createElement("button");
      btn.className = "dbg-toggle-btn";
      btn.textContent = `${labels[key]}: ${state[key] ? "ON" : "OFF"}`;
      if (state[key]) btn.classList.add("active");
      btn.addEventListener("click", () => {
        state[key] = !state[key];
        localStorage.setItem(`gsapDebugger_${key}`, JSON.stringify(state[key]));
        btn.classList.toggle("active", state[key]);
        btn.textContent = `${labels[key]}: ${state[key] ? "ON" : "OFF"}`;
        handleToggle(key, state[key]);
      });
      menuEl.appendChild(btn);
    });

    function handleToggle(key, on) {
      if (key === "callbacks" && !on) logEl.innerHTML = "";
      if (key === "stMarkers" && window.ScrollTrigger)
        ScrollTrigger.defaults({ markers: on });
      if (key === "stEvents" && on && window.ScrollTrigger)
        attachSTEventWrappers();
      if (key === "dom") on ? startDOMObserver() : stopDOMObserver();
    }

    // --- LOGGING QUEUE ---
    function enqueueLog(msg) {
      logQueue.push(msg);
    }
    setInterval(() => {
      if (!logQueue.length) return;
      const batch = logQueue.splice(0, 50);
      batch.forEach((m) => {
        const d = document.createElement("div");
        d.textContent = m;
        logEl.appendChild(d);
      });
      while (logEl.childElementCount > 200) logEl.removeChild(logEl.firstChild);
    }, LOG_FLUSH_INTERVAL);

    // --- TRACKING HELPERS ---
    function markDone(inst) {
      const info = tracked.get(inst);
      if (info) {
        info.status = "completed";
        if (!state.hold) setTimeout(() => tracked.delete(inst), FADE_OUT_MS);
      }
    }
    function wrapEvents(inst, info, evts) {
      evts.forEach((evt) => {
        const prev = inst.eventCallback(evt);
        inst.eventCallback(evt, function (...args) {
          const shouldLog =
            (info.type === "scrollTrigger"
              ? state.stEvents
              : state.callbacks) ||
            (state.dom && evt.startsWith("[DOM]"));
          if (shouldLog)
            enqueueLog(`[${info.id}] ${evt} (${info.type}) on ${info.target}`);
          if (evt === "onComplete" || evt === "onReverseComplete")
            markDone(inst);
          if (prev) prev.apply(this, args);
        });
      });
    }

    function track(inst, type) {
      if (!inst) return;
      // 1) Has targets?
      const targets = typeof inst.targets === "function" ? inst.targets() : [];
      if (!targets.length) return;
      // 2) Skip zero-duration tweens
      if (
        type === "tween" &&
        typeof inst.duration === "function" &&
        inst.duration() === 0
      )
        return;
      // 3) Skip infinite-loop tweens
      if (type === "tween") {
        const repeatVal =
          typeof inst.repeat === "function"
            ? inst.repeat()
            : inst.vars && inst.vars.repeat;
        if (repeatVal === -1) return;
      }
      // 4) Identifier must be valid
      const ident = getElementIdentifier(targets[0]);
      if (ident === "Unknown" || ident === "N/A") return;
      // 5) Prevent duplicate
      if (tracked.has(inst)) return;

      // 6) Register
      const id = `dbg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const vars = {};
      if (inst.vars)
        Object.keys(inst.vars).forEach((k) => {
          const v = inst.vars[k];
          if (typeof v !== "function" && k !== "onComplete" && k !== "onStart")
            vars[k] = v;
        });
      tracked.set(inst, {
        id,
        type,
        inst,
        status: "playing",
        progress: 0,
        vars,
        target: ident,
      });
      const evts =
        type === "scrollTrigger"
          ? ["onEnter", "onLeave", "onEnterBack", "onLeaveBack", "onUpdate"]
          : [
              "onStart",
              "onUpdate",
              "onRepeat",
              "onComplete",
              "onReverseComplete",
            ];
      wrapEvents(inst, tracked.get(inst), evts);
    }

    function attachSTEventWrappers() {
      if (!window.ScrollTrigger) return;
      ScrollTrigger.getAll().forEach((s) => {
        if (!stWrapped.has(s)) {
          track(s, "scrollTrigger");
          stWrapped.add(s);
        }
      });
    }

    // --- INITIAL SCAN & EXPIRE ---
    if (window.gsap) {
      gsap.globalTimeline.getChildren(true, true, false).forEach((inst) => {
        const type = inst instanceof gsap.core.Timeline ? "timeline" : "tween";
        track(inst, type);
      });
      if (window.ScrollTrigger) {
        try {
          gsap.registerPlugin(ScrollTrigger);
        } catch {}
        attachSTEventWrappers();
      }
      // Expire pre-finished tweens immediately
      tracked.forEach((info, inst) => {
        try {
          if (typeof inst.progress === "function" && inst.progress() === 1) {
            info.status = "completed";
            setTimeout(() => tracked.delete(inst), FADE_OUT_MS);
          }
        } catch {}
      });
    }

    // --- DOM OBSERVER ---
    function startDOMObserver() {
      if (domObserver) return;
      const ui = container;
      domObserver = new MutationObserver((records) => {
        records.forEach((m) => {
          const t = m.target;
          if (ui.contains(t)) return;
          for (const n of m.addedNodes || [])
            if (n.nodeType === 1 && ui.contains(n)) return;
          for (const n of m.removedNodes || [])
            if (n.nodeType === 1 && ui.contains(n)) return;
          enqueueLog(
            `[DOM] ${getElementIdentifier(t)} ${m.type}` +
              (m.attributeName ? ` ${m.attributeName}` : "")
          );
        });
      });
      domObserver.observe(document.body, {
        attributes: true,
        childList: true,
        subtree: true,
      });
    }
    function stopDOMObserver() {
      if (!domObserver) return;
      domObserver.disconnect();
      domObserver = null;
    }

    // --- RENDER LOOP ---
    function renderLoop() {
      listEl.innerHTML = "";
      tracked.forEach((info) => {
        try {
          info.progress = info.inst.progress();
        } catch {}
        const d = document.createElement("div");
        d.id = info.id;
        d.className = "dbg-item " + info.status;
        let html = `<strong>${info.type}</strong><span class="dbg-target">(${info.target})</span>`;
        html += ` [${info.status}] | prog: ${info.progress.toFixed(2)}`;
        if (state.vars)
          html += `<div id="dbg-vars">${JSON.stringify(
            info.vars,
            null,
            2
          )}</div>`;
        d.innerHTML = html;
        listEl.appendChild(d);
      });
      posEl.textContent = `ScrollY: ${window.scrollY}px`;
    }
    if (window.gsap && gsap.ticker && typeof gsap.ticker.add === "function")
      gsap.ticker.add(renderLoop);
    else setInterval(renderLoop, 100);

    // --- PROXY SETUP ---
    if (window.gsap) {
      const orig = window.gsap;
      window.gsap = new Proxy(orig, {
        get(t, p) {
          const v = t[p];
          if (
            typeof v === "function" &&
            ["to", "from", "fromTo", "set", "timeline"].includes(p)
          ) {
            return function (...args) {
              const inst = v.apply(t, args);
              track(inst, p === "timeline" ? "timeline" : "tween");
              return inst;
            };
          }
          return v;
        },
      });
      if (window.ScrollTrigger) {
        try {
          orig.registerPlugin(ScrollTrigger);
        } catch {}
        ScrollTrigger.addEventListener("refresh", attachSTEventWrappers);
      }
    }
  }

  if (
    document.readyState === "interactive" ||
    document.readyState === "complete"
  )
    initDebugger();
  else window.addEventListener("DOMContentLoaded", initDebugger);
})();
