// gsap-debugger-webflow-v3.10.1.js
// Version: 3.10.1 — Restored UI creation block and full initialization

(function () {
  "use strict";

  function initDebugger() {
    console.log("🐛 GSAP Debugger v3.10.1 Loaded");

    // --- CONFIGURATION ---
    const VERSION = "3.10.1";
    const PARAM = "debug";
    const LS_KEY = "gsapDebuggerEnabled";
    const FADE_OUT_MS = 3000;
    const RENDER_INTERVAL = 100;
    const LOG_FLUSH_INTERVAL = 200;

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
      if (el.id) return `#${el.id}`;
      if (el.className && typeof el.className === "string") {
        const cls = el.className.split(" ").filter((c) => c)[0];
        if (cls) return `.${cls}`;
      }
      return el.tagName ? `<${el.tagName.toLowerCase()}>` : "Unknown";
    }

    // --- STYLES ---
    const css = `
          #gsap-debugger { position: fixed; bottom: 10px; left: 10px;
              background: rgba(0,0,0,0.85); color: #fff; font: 12px monospace;
              padding: 10px; border-radius: 6px; max-height: 90vh; overflow-y: auto;
              z-index: 2147483647; box-shadow: 0 2px 10px rgba(0,0,0,0.5);
          }
          #gsap-debugger h4 { margin: 0 0 6px; font-size: 16px; color: #0ff; }
          #dbg-menu { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
          .dbg-toggle-btn { padding: 4px 8px; background: rgba(255,255,255,0.1);
              border: 1px solid #777; border-radius: 4px; color: #fff; font-size: 12px;
              cursor: pointer; user-select: none;
          }
          .dbg-toggle-btn.active { background: rgba(0,150,0,0.6); border-color: #0a0; }
          .dbg-item { margin: 4px 0; padding: 4px; border-left: 3px solid #0f0;
              background: rgba(255,255,255,0.05);
          }
          .dbg-item.completed { border-color: #f90; opacity: 0.6; transition: opacity 1s; }
          .dbg-target { color: #ff0; margin: 0 4px; font-style: italic; }
          #dbg-vars { font-size: 10px; color: #ccc; white-space: pre-wrap; margin-top: 2px; }
          #dbg-callback-log { font-size: 10px; color: #0ff; margin-top: 6px; max-height: 100px;
              overflow-y: auto;
          }
          #dbg-callback-log div { margin-bottom: 2px; }
          #dbg-scroll-pos { font-size: 12px; color: #fff; margin-top: 6px; }
      `;
    document.head.insertAdjacentHTML("beforeend", `<style>${css}</style>`);

    // --- UI CREATION ---
    const container = document.createElement("div");
    container.id = "gsap-debugger";
    container.innerHTML = `
          <h4>GSAP Debugger v${VERSION}</h4>
          <div id="dbg-menu"></div>
          <div id="dbg-list"></div>
          <div id="dbg-callback-log"></div>
          <div id="dbg-scroll-pos"></div>
      `;
    document.body.appendChild(container);

    // --- TOGGLE BUTTONS ---
    const menuEl = container.querySelector("#dbg-menu");
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
    features.forEach((key) => {
      state[key] = false;
      const btn = document.createElement("button");
      btn.className = "dbg-toggle-btn";
      btn.textContent = `${labels[key]}: OFF`;
      btn.addEventListener("click", () => {
        state[key] = !state[key];
        btn.classList.toggle("active", state[key]);
        btn.textContent = `${labels[key]}: ${state[key] ? "ON" : "OFF"}`;
        handleToggle(key, state[key]);
      });
      menuEl.appendChild(btn);
    });

    // --- REFS & STATE ---
    const listEl = container.querySelector("#dbg-list");
    const callbackLogEl = container.querySelector("#dbg-callback-log");
    const scrollPosEl = container.querySelector("#dbg-scroll-pos");
    const logQueue = [];
    const tracked = new Map();
    const stWrapped = new WeakSet();
    let domObserver = null;

    // --- HANDLE TOGGLE ---
    function handleToggle(key, on) {
      if (key === "callbacks" && !on) callbackLogEl.innerHTML = "";
      if (key === "stMarkers" && window.ScrollTrigger)
        ScrollTrigger.defaults({ markers: on });
      if (key === "stEvents" && on && window.ScrollTrigger)
        attachSTEventWrappers();
      if (key === "dom") on ? startDOMObserver() : stopDOMObserver();
    }

    // --- LOGGING ---
    function enqueueLog(msg) {
      logQueue.push(msg);
    }
    setInterval(() => {
      if (logQueue.length) {
        const batch = logQueue.splice(0, 50);
        batch.forEach((msg) => {
          const d = document.createElement("div");
          d.textContent = msg;
          callbackLogEl.appendChild(d);
        });
        while (callbackLogEl.childElementCount > 200)
          callbackLogEl.removeChild(callbackLogEl.firstChild);
      }
    }, LOG_FLUSH_INTERVAL);

    // --- TRACKING HELPERS ---
    function markDone(i) {
      const info = tracked.get(i);
      if (info) {
        info.status = "completed";
        if (!state.hold) setTimeout(() => tracked.delete(i), FADE_OUT_MS);
      }
    }
    function wrapEvents(i, info, evts) {
      evts.forEach((e) => {
        const prev = i.eventCallback(e);
        i.eventCallback(e, function (...a) {
          const shouldLog =
            (info.type === "scrollTrigger"
              ? state.stEvents
              : state.callbacks) ||
            (state.dom && e.startsWith("[DOM]"));
          if (shouldLog)
            enqueueLog(`[${info.id}] ${e} (${info.type}) on ${info.target}`);
          if (e === "onComplete" || e === "onReverseComplete") markDone(i);
          if (prev) prev.apply(this, a);
        });
      });
    }
    function track(i, t) {
      if (!i || tracked.has(i)) return;
      const tgt = i.targets ? i.targets()[0] : i.trigger || null;
      const target = getElementIdentifier(tgt);
      const id = `dbg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const vars = {};
      if (i.vars)
        Object.keys(i.vars).forEach((k) => {
          const v = i.vars[k];
          if (typeof v !== "function" && k !== "onComplete" && k !== "onStart")
            vars[k] = v;
        });
      const info = {
        id,
        type: t,
        inst: i,
        status: "playing",
        progress: 0,
        vars,
        target,
      };
      tracked.set(i, info);
      const evts =
        t === "scrollTrigger"
          ? ["onEnter", "onLeave", "onEnterBack", "onLeaveBack", "onUpdate"]
          : [
              "onStart",
              "onUpdate",
              "onRepeat",
              "onComplete",
              "onReverseComplete",
            ];
      wrapEvents(i, info, evts);
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

    // --- DOM Observer ---
    function startDOMObserver() {
      if (domObserver) return;
      const containerEl = document.getElementById("gsap-debugger");
      domObserver = new MutationObserver((records) => {
        records.forEach((m) => {
          // Skip any mutation where target or added/removed nodes are inside the debugger UI
          const t = m.target;
          if (containerEl.contains(t)) return;
          for (const n of Array.from(m.addedNodes || [])) {
            if (n.nodeType === 1 && containerEl.contains(n)) return;
          }
          for (const n of Array.from(m.removedNodes || [])) {
            if (n.nodeType === 1 && containerEl.contains(n)) return;
          }
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
      if (domObserver) {
        domObserver.disconnect();
        domObserver = null;
      }
    }

    // --- RENDER LOOP ---
    setInterval(() => {
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
      scrollPosEl.textContent = `ScrollY: ${window.scrollY}px`;
    }, RENDER_INTERVAL);

    // --- GSAP PROXY SETUP ---
    if (window.gsap) {
      const original = window.gsap;
      window.gsap = new Proxy(original, {
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
          original.registerPlugin(ScrollTrigger);
        } catch {}
        ScrollTrigger.addEventListener("refresh", attachSTEventWrappers);
      }
    }
  }

  if (
    document.readyState === "interactive" ||
    document.readyState === "complete"
  ) {
    initDebugger();
  } else {
    window.addEventListener("DOMContentLoaded", initDebugger);
  }
})();
