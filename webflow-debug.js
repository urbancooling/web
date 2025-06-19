// gsap-debugger-webflow-v1.7.0.js
// Version: 1.7.0 — Display target identifier inline with each animation entry

(function () {
  "use strict";

  // --- CONFIGURATION ---
  const VERSION = "1.7.0";
  const PARAM = "debug";
  const LS_KEY = "gsapDebuggerEnabled";
  const FADE_OUT_MS = 3000;

  // --- DEBUG FLAG ---
  let enabled = localStorage.getItem(LS_KEY) === "true";
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has(PARAM)) {
      enabled = params.get(PARAM) === "true";
      localStorage.setItem(LS_KEY, enabled);
    }
  } catch (e) {}
  if (!enabled) return;

  // --- UTILITY: Element Identifier ---
  function getElementIdentifier(el) {
    if (!el) return "N/A";
    if (el.id) return `#${el.id}`;
    if (el.className && typeof el.className === "string") {
      const cls = el.className.split(" ").filter((c) => c)[0];
      if (cls) return `.${cls}`;
    }
    return el.tagName ? `<${el.tagName.toLowerCase()}>` : "Unknown";
  }

  // --- STYLE INJECTION ---
  const css = `
      #gsap-debugger { all: initial; position: fixed; bottom: 10px; left: 10px;
          background: rgba(0,0,0,0.8); color: #fff; font: 12px monospace;
          padding: 10px; border-radius: 6px; max-height: 80vh; overflow-y: auto;
          z-index: 2147483647; box-shadow: 0 2px 10px rgba(0,0,0,0.5);
      }
      #gsap-debugger h4 { margin: 0 0 6px; font-size: 16px; color: #0ff; }
      #dbg-menu { margin-bottom: 8px; }
      #dbg-menu label { display: inline-block; margin-right: 10px; cursor: pointer; color: #fff; }
      #gsap-debugger input[type="checkbox"] { margin-right: 4px; appearance: auto; -webkit-appearance: checkbox; accent-color: #0f0; vertical-align: middle; }
      .dbg-item { margin: 4px 0; padding: 4px; border-left: 3px solid #0f0; background: rgba(255,255,255,0.05); }
      .dbg-item.completed { border-color: #f90; opacity: 0.6; transition: opacity 1s; }
      .dbg-target { color: #ff0; margin: 0 4px; font-style: italic; }
      #dbg-vars { font-size: 10px; color: #ccc; white-space: pre-wrap; margin-top: 2px; }
      #dbg-callback-log { font-size: 10px; color: #0ff; margin-top: 6px; max-height: 100px; overflow-y: auto; }
      #dbg-callback-log div { margin-bottom: 2px; }
  `;
  const styleEl = document.createElement("style");
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // --- UI CREATION ---
  const container = document.createElement("div");
  container.id = "gsap-debugger";
  container.innerHTML = `
      <h4>GSAP Debugger v${VERSION}</h4>
      <div id="dbg-menu">
          <label><input type="checkbox" id="dbg-toggle-callbacks"> Trace Callbacks</label>
          <label><input type="checkbox" id="dbg-toggle-vars"> Inspect Vars</label>
          <label><input type="checkbox" id="dbg-toggle-hold"> Hold</label>
      </div>
      <div id="dbg-list"></div>
      <div id="dbg-callback-log"></div>
  `;
  document.body.appendChild(container);
  const listEl = container.querySelector("#dbg-list");
  const callbackLogEl = container.querySelector("#dbg-callback-log");
  const cbToggle = container.querySelector("#dbg-toggle-callbacks");
  const varToggle = container.querySelector("#dbg-toggle-vars");
  const holdToggle = container.querySelector("#dbg-toggle-hold");

  // --- STATE ---
  let traceCallbacks = false;
  let inspectVars = false;
  let holdDetails = false;
  cbToggle.addEventListener("change", (e) => {
    traceCallbacks = e.target.checked;
    if (!traceCallbacks) callbackLogEl.innerHTML = "";
  });
  varToggle.addEventListener("change", (e) => (inspectVars = e.target.checked));
  holdToggle.addEventListener("change", (e) => {
    holdDetails = e.target.checked;
    if (!holdDetails) {
      tracked.forEach((info, inst) => {
        if (info.status === "completed")
          setTimeout(() => tracked.delete(inst), FADE_OUT_MS);
      });
    }
  });

  // --- DATA STORE ---
  const tracked = new Map();

  function logCallback(msg) {
    if (!traceCallbacks) return;
    const entry = document.createElement("div");
    entry.textContent = msg;
    callbackLogEl.appendChild(entry);
    if (callbackLogEl.children.length > 50)
      callbackLogEl.removeChild(callbackLogEl.firstChild);
  }

  function markDone(inst) {
    const info = tracked.get(inst);
    if (!info) return;
    info.status = "completed";
    if (!holdDetails) setTimeout(() => tracked.delete(inst), FADE_OUT_MS);
  }

  function track(inst, type) {
    if (!inst || tracked.has(inst)) return;
    const targetEl = inst.targets ? inst.targets()[0] : null;
    const targetId = getElementIdentifier(targetEl);
    const id = `dbg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const varsSnapshot = {};
    if (inst.vars)
      Object.keys(inst.vars).forEach((k) => {
        const v = inst.vars[k];
        if (typeof v !== "function" && k !== "onComplete" && k !== "onStart")
          varsSnapshot[k] = v;
      });
    const info = {
      id,
      type,
      inst,
      status: "playing",
      progress: 0,
      vars: varsSnapshot,
      target: targetId,
    };
    tracked.set(inst, info);

    // wrap callbacks
    const wrap = (event, prev) =>
      inst.eventCallback(event, function (...args) {
        if (traceCallbacks)
          logCallback(`[${info.id}] ${event} (${info.type}) on ${info.target}`);
        if (prev) prev.apply(this, args);
        if (event === "onComplete" || event === "onReverseComplete")
          markDone(inst);
      });
    wrap("onStart", inst.eventCallback("onStart"));
    wrap("onUpdate", inst.eventCallback("onUpdate"));
    wrap("onRepeat", inst.eventCallback("onRepeat"));
    wrap("onComplete", inst.eventCallback("onComplete"));
    wrap("onReverseComplete", inst.eventCallback("onReverseComplete"));
  }

  function render() {
    listEl.innerHTML = "";
    tracked.forEach((info) => {
      try {
        info.progress = info.inst.progress();
      } catch {}
      const div = document.createElement("div");
      div.id = info.id;
      div.className = "dbg-item " + info.status;
      let html =
        `<strong>${info.type}</strong><span class="dbg-target">(${info.target})</span>` +
        ` [${info.status}] | prog: ${info.progress.toFixed(2)}`;
      if (inspectVars && info.vars)
        html += `<div id="dbg-vars">${JSON.stringify(
          info.vars,
          null,
          2
        )}</div>`;
      div.innerHTML = html;
      listEl.appendChild(div);
    });
  }

  // --- GSAP PROXY SETUP ---
  if (!window.gsap) return;
  const original = window.gsap;
  const methods = ["to", "from", "fromTo", "set", "timeline"];
  window.gsap = new Proxy(original, {
    get(target, prop) {
      const val = target[prop];
      if (typeof val === "function" && methods.includes(prop)) {
        return function (...args) {
          const inst = val.apply(target, args);
          track(inst, prop === "timeline" ? "timeline" : "tween");
          return inst;
        };
      }
      return val;
    },
  });

  // --- ScrollTrigger SUPPORT ---
  if (window.ScrollTrigger) {
    try {
      original.registerPlugin(ScrollTrigger);
    } catch {}
    ScrollTrigger.addEventListener("refresh", () =>
      ScrollTrigger.getAll().forEach((st) => track(st, "scrollTrigger"))
    );
  }

  // --- RENDER LOOP ---
  const ticker = original.ticker || (original.core && original.core.ticker);
  if (ticker && typeof ticker.add === "function") ticker.add(render);
  else setInterval(render, 100);
})();
