// gsap-debugger-webflow.js

/**
 * GSAP Live Animation Debugger/Monitor for Webflow Projects
 * Version: 1.0.14 (Semantic Versioning: MAJOR.MINOR.PATCH)
 * - Incremented patch for:
 * - FIX: Resolved `TypeError: timeline.getChildren is not a function` by adding robust `instanceof gsap.core.Timeline`
 * and `instanceof gsap.core.Tween` checks in the `tickerUpdate` function. This ensures `getChildren` is only
 * called on valid Timeline instances and data is processed correctly for tweens vs. timelines.
 *
 * This script provides an on-screen overlay debugger to help Webflow developers
 * monitor and troubleshoot GSAP animations and ScrollTrigger states in real-time.
 *
 * Installation:
 * 1. Save this code as a .js file (e.g., 'webflow-debug.js').
 * 2. Upload it to a CDN or your own server to get a public URL.
 * 3. In your Webflow project settings, go to 'Custom Code' -> 'Footer Code'.
 * 4. Add the following script tag, replacing YOUR_SCRIPT_URL with the actual URL:
 * <script src="YOUR_SCRIPT_URL/webflow-debug.js"></script>
 * 5. Publish your Webflow project.
 *
 * Usage:
 * - To activate the debugger: Append '?debug=true' to your site's URL.
 * (e.g., yoursite.webflow.io/?debug=true)
 * - To deactivate: Append '?debug=false' to your site's URL, or click 'OFF' button in debugger.
 * The state persists in local storage.
 * - Toggle visibility: Click the 'ON/OFF' button in the debugger or use Ctrl+D (Cmd+D on Mac).
 * - Filter information: Use the checkboxes in the debugger menu.
 * - ScrollTrigger Markers: Toggle GSAP's built-in markers via the checkbox.
 */
(function() {
    // --- Configuration and Persistence ---
    const DEBUGGER_VERSION = "1.0.14"; // Updated debugger version constant
    const DEBUGGER_PARAM = 'debug';
    const LOCAL_STORAGE_KEY = 'gsapDebuggerEnabled';

    let debuggerEnabled = localStorage.getItem(LOCAL_STORAGE_KEY) === 'true';

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has(DEBUGGER_PARAM)) {
        debuggerEnabled = urlParams.get(DEBUGGER_PARAM) === 'true';
        localStorage.setItem(LOCAL_STORAGE_KEY, debuggerEnabled);
    }

    if (!debuggerEnabled) {
        console.log('Webflow Debug: Not enabled. Add ?debug=true to the URL to activate it.');
        return;
    }

    // --- Inject CSS Styles ---
    const injectDebuggerStyles = () => {
        const styleId = 'gsap-debugger-styles';
        if (document.getElementById(styleId)) return;

        const styleTag = document.createElement('style');
        styleTag.id = styleId;
        styleTag.textContent = `
            #gsap-debugger-overlay {
                position: fixed !important;
                bottom: 10px !important;
                left: 10px !important;
                background: rgba(0, 0, 0, 0.7) !important;
                color: #ffffff !important;
                font-family: monospace !important;
                font-size: 12px !important;
                padding: 10px !important;
                border-radius: 8px !important;
                z-index: 999999 !important;
                width: 340px !important;
                max-height: 90vh !important;
                overflow-y: auto !important;
                box-shadow: none !important;
                display: flex !important;
                flex-direction: column !important;
                line-height: 1.5 !important;
                pointer-events: none !important; /* Makes the debugger transparent to mouse events by default */
            }
            #gsap-debugger-overlay * {
                color: #ffffff !important;
                box-sizing: border-box !important;
            }
            #gsap-debugger-overlay h4 {
                margin: 0 !important;
                font-size: 16px !important;
            }
            #gsap-debugger-overlay p {
                margin: 0 !important;
            }
            #gsap-debugger-overlay hr {
                border: none !important;
                border-top: 1px dashed #555 !important;
                margin: 10px 0 !important;
            }
            /* Styling for interactive elements within the debugger */
            #gsap-debugger-overlay button,
            #gsap-debugger-overlay label {
                pointer-events: auto !important; /* Enable pointer events for buttons and labels */
            }
            #gsap-debugger-overlay button {
                background: rgba(255, 255, 255, 0.1) !important;
                border: 1px solid #777 !important;
                color: #ffffff !important;
                padding: 4px 10px !important;
                cursor: pointer !important;
                border-radius: 4px !important;
                font-size: 12px !important;
                transition: background 0.2s, color 0.2s, border-color 0.2s !important;
            }
            #gsap-debugger-overlay button#gsap-debugger-toggle.on {
                background: rgba(0, 150, 0, 0.4) !important;
                border-color: #00a000 !important;
            }
            #gsap-debugger-overlay button#gsap-debugger-toggle.off {
                background: rgba(150, 0, 0, 0.2) !important;
                border-color: #a00000 !important;
            }
            #gsap-debugger-overlay .debugger-section {
                margin-bottom: 15px !important;
            }
            #gsap-debugger-overlay .debugger-section div {
                margin-bottom: 8px !important;
                padding: 5px !important;
                border: 1px solid #444 !important;
                border-radius: 4px !important;
            }
            #gsap-debugger-overlay label {
                display: flex !important;
                align-items: center !important;
                margin-bottom: 8px !important;
                cursor: pointer !important;
                color: #bbb !important; /* Default greyed out color for labels */
                transition: color 0.2s !important;
            }
            #gsap-debugger-overlay label.active-menu-item {
                color: #00ff00 !important; /* Bright green for active labels */
            }
            #gsap-debugger-overlay label .status-text {
                font-size: 10px !important;
                margin-left: 5px !important;
                color: #777 !important; /* Default for status text */
            }
            #gsap-debugger-overlay label.active-menu-item .status-text {
                color: #00ff00 !important; /* Bright green for active status text */
            }
            #gsap-debugger-overlay input[type="checkbox"] {
                margin-right: 8px !important;
                transform: scale(1.2) !important;
                accent-color: #00a000 !important; /* Green checkbox checkmark */
            }

            /* --- Styles for GSAP ScrollTrigger Markers --- */
            /* These classes are generated by GSAP when markers:true is enabled */
            .gsap-marker-start,
            .gsap-marker-end,
            .gsap-marker-scroller-start,
            .gsap-marker-scroller-end {
                display: block !important; /* Force display */
                z-index: 999998 !important; /* Ensure they are below debugger but above content */
                opacity: 0.8 !important; /* Slightly transparent */
                font-family: monospace !important;
                font-size: 10px !important;
                pointer-events: none !important; /* Ensure they don't block clicks */
            }
            /* You might want to adjust colors for better visibility on your specific site */
            .gsap-marker-start { color: #00ff00 !important; } /* Green */
            .gsap-marker-end { color: #ff0000 !important; } /* Red */
            .gsap-marker-scroller-start { color: #00ffff !important; } /* Cyan */
            .gsap-marker-scroller-end { color: #ff00ff !important; } /* Magenta */

            /* Ensure lines are visible too */
            .gsap-marker-start div,
            .gsap-marker-end div,
            .gsap-marker-scroller-start div,
            .gsap-marker-scroller-end div {
                border-color: inherit !important; /* Use parent's color */
                background-color: inherit !important; /* Use parent's color */
                opacity: 0.8 !important; /* Match text opacity */
            }
        `;
        document.head.appendChild(styleTag);
    };

    // --- Webflow Environment & GSAP/ScrollTrigger Detection ---
    const initializeDebugger = () => {
        injectDebuggerStyles();

        const gsapAvailable = typeof window.gsap === 'object';
        const scrollTriggerAvailable = gsapAvailable && typeof window.ScrollTrigger === 'function';

        if (!gsapAvailable) {
            console.warn('Webflow Debug: GSAP not detected yet. Retrying...');
            setTimeout(initializeDebugger, 200);
            return;
        }

        console.log(`Webflow Debug: GSAP Detected (v${gsap.version || 'Unknown'})`);
        console.log(`Webflow Debug: ScrollTrigger Detected: ${scrollTriggerAvailable}`);

        // --- UI Elements and Layout ---
        const createDebuggerUI = () => {
            const debuggerContainer = document.createElement('div');
            debuggerContainer.id = 'gsap-debugger-overlay';

            debuggerContainer.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px dashed #555;">
                    <h4>Webflow Debug <span style="font-size: 10px; color: #aaa;">v${DEBUGGER_VERSION}</span></h4>
                    <button id="gsap-debugger-toggle">ON</button>
                </div>
                <div id="gsap-debugger-content" style="flex-grow: 1; overflow-y: auto;">
                    <p>GSAP: ${gsapAvailable ? 'Detected (v' + (gsap.version || 'Unknown') + ')' : 'Not Found'}</p>
                    <p>ScrollTrigger: ${scrollTriggerAvailable ? 'Detected' : 'Not Found'}</p>
                    <hr>

                    <div id="gsap-debugger-menu">
                        <label id="label-core-animations">
                            <input type="checkbox" id="menu-core-animations" checked> Core Animations <span class="status-text"></span>
                        </label>
                        <label id="label-timelines">
                            <input type="checkbox" id="menu-timelines" checked> Timelines <span class="status-text"></span>
                        </label>
                        <label id="label-scrolltrigger">
                            <input type="checkbox" id="menu-scrolltrigger" checked> ScrollTrigger <span class="status-text"></span>
                        </label>
                        <label id="label-events">
                            <input type="checkbox" id="menu-events"> Events <span class="status-text"></span>
                        </label>
                        <label id="label-marker-overlay">
                            <input type="checkbox" id="menu-marker-overlay"> ST Markers (Built-in) <span class="status-text"></span>
                        </label>
                    </div>

                    <div id="gsap-debugger-animations" class="debugger-section"></div>
                    <div id="gsap-debugger-timelines" class="debugger-section"></div>
                    <div id="gsap-debugger-scrolltriggers" class="debugger-section"></div>
                    <div id="gsap-debugger-events" class="debugger-section"></div>
                </div>
            `;
            document.body.appendChild(debuggerContainer);

            const toggleButton = debuggerContainer.querySelector('#gsap-debugger-toggle');

            // --- References to Menu Checkboxes for Conditional Data Collection ---
            const menuCoreAnimationsCheckbox = debuggerContainer.querySelector('#menu-core-animations');
            const menuTimelinesCheckbox = debuggerContainer.querySelector('#menu-timelines');
            const menuScrollTriggerCheckbox = debuggerContainer.querySelector('#menu-scrolltrigger');
            const menuEventsCheckbox = debuggerContainer.querySelector('#menu-events');


            // Function to update the visual state of the toggle button and debugger visibility
            const updateToggleButton = () => {
                if (debuggerEnabled) {
                    toggleButton.textContent = 'ON';
                    toggleButton.classList.remove('off');
                    toggleButton.classList.add('on');
                    debuggerContainer.style.display = 'flex';
                } else {
                    toggleButton.textContent = 'OFF';
                    toggleButton.classList.remove('on');
                    toggleButton.classList.add('off');
                    const currentUrl = new URL(window.location.href);
                    currentUrl.searchParams.delete(DEBUGGER_PARAM);
                    window.location.replace(currentUrl.toString());
                }
            };

            toggleButton.addEventListener('click', () => {
                debuggerEnabled = !debuggerEnabled;
                localStorage.setItem(LOCAL_STORAGE_KEY, debuggerEnabled);
                updateToggleButton();
            });

            updateToggleButton();

            const animationDiv = debuggerContainer.querySelector('#gsap-debugger-animations');
            const timelineDiv = debuggerContainer.querySelector('#gsap-debugger-timelines');
            const scrollTriggerDiv = debuggerContainer.querySelector('#gsap-debugger-scrolltriggers');
            const eventsDiv = debuggerContainer.querySelector('#gsap-debugger-events');

            // Function to update menu item visual state
            const updateMenuItem = (checkboxId, sectionDiv, labelId) => {
                const checkbox = debuggerContainer.querySelector(`#${checkboxId}`);
                const label = debuggerContainer.querySelector(`#${labelId}`);
                const statusText = label.querySelector('.status-text');

                const applyState = (checked) => {
                    if (checked) {
                        label.classList.add('active-menu-item');
                        statusText.textContent = '(ON)';
                        sectionDiv.style.display = 'block';
                    } else {
                        label.classList.remove('active-menu-item');
                        statusText.textContent = '(OFF)';
                        sectionDiv.style.display = 'none';
                    }
                };

                applyState(checkbox.checked);

                checkbox.addEventListener('change', (e) => {
                    applyState(e.target.checked);
                    // Clear data when a section is toggled OFF
                    if (!e.target.checked) {
                        if (checkboxId === 'menu-core-animations') activeAnimations.clear();
                        else if (checkboxId === 'menu-timelines') activeTimelines.clear();
                        else if (checkboxId === 'menu-scrolltrigger') activeScrollTriggers.clear();
                        else if (checkboxId === 'menu-events') Object.keys(eventData).forEach(key => delete eventData[key]);
                    }
                });
            };

            updateMenuItem('menu-core-animations', animationDiv, 'label-core-animations');
            updateMenuItem('menu-timelines', timelineDiv, 'label-timelines');
            updateMenuItem('menu-scrolltrigger', scrollTriggerDiv, 'label-scrolltrigger');
            updateMenuItem('menu-events', eventsDiv, 'label-events');

            const stMarkerCheckbox = debuggerContainer.querySelector('#menu-marker-overlay');
            const stMarkerLabel = debuggerContainer.querySelector('#label-marker-overlay');
            const stMarkerStatusText = stMarkerLabel.querySelector('.status-text');

            if (scrollTriggerAvailable) {
                const applySTMarkerState = (checked) => {
                    if (checked) {
                        stMarkerLabel.classList.add('active-menu-item');
                        stMarkerStatusText.textContent = '(ON)';
                        ScrollTrigger.defaults({markers: true});
                        ScrollTrigger.refresh();
                        document.querySelectorAll('.gsap-marker-scroller-start, .gsap-marker-scroller-end, .gsap-marker-start, .gsap-marker-end').forEach(marker => {
                            marker.style.display = 'block';
                        });
                    } else {
                        stMarkerLabel.classList.remove('active-menu-item');
                        stMarkerStatusText.textContent = '(OFF)';
                        ScrollTrigger.defaults({markers: false});
                        document.querySelectorAll('.gsap-marker-scroller-start, .gsap-marker-scroller-end, .gsap-marker-start, .gsap-marker-end').forEach(marker => {
                            marker.style.display = 'none';
                        });
                    }
                };

                applySTMarkerState(stMarkerCheckbox.checked);

                stMarkerCheckbox.addEventListener('change', (e) => {
                    applySTMarkerState(e.target.checked);
                });
            } else {
                stMarkerCheckbox.disabled = true;
                stMarkerLabel.parentElement.title = 'ScrollTrigger not available';
                stMarkerStatusText.textContent = '(N/A)';
            }


            return {
                debuggerContainer,
                animationDiv,
                timelineDiv,
                scrollTriggerDiv,
                eventsDiv,
                menuCoreAnimationsCheckbox,
                menuTimelinesCheckbox,
                menuScrollTriggerCheckbox,
                menuEventsCheckbox
            };
        };

        const ui = createDebuggerUI();

        // --- Data Storage ---
        // Using Maps to store active animations/timelines/scrollTriggers. Keys are the GSAP instances.
        const activeAnimations = new Map();
        const activeTimelines = new Map();
        const activeScrollTriggers = new Map();
        const eventData = {}; // For mouse/keyboard events

        // Helper function to format property values for display
        const formatProperty = (key, value) => {
            if (typeof value === 'number') {
                return `${key}: ${value.toFixed(2)}`;
            }
            if (typeof value === 'boolean') {
                return `${key}: ${value ? 'true' : 'false'}`;
            }
            if (typeof value === 'string' && value.length > 50) {
                 return `${key}: ${value.substring(0, 47)}...`; // Truncate long strings
            }
            return `${key}: ${value}`;
        };

        // Helper function to get a readable identifier for a DOM element
        const getElementIdentifier = (el) => {
            if (!el) return 'N/A';
            if (el === window) return 'Window';
            if (el === document.body) return 'Body';
            if (el.id) return `#${el.id}`;
            if (el.className) {
                const classNames = el.className.split(' ').filter(c => c.length > 0);
                if (classNames.length > 0) {
                    return `.${classNames[0]}${classNames.length > 1 ? ' (+)' : ''}`;
                }
            }
            if (el.tagName) return `<${el.tagName.toLowerCase()}>`;
            return 'Unknown Element';
        };

        // --- Update Display Function ---
        const updateDisplay = () => {
            if (!debuggerEnabled) return;

            // Update Core Animations section if visible
            if (ui.menuCoreAnimationsCheckbox.checked) {
                let animHTML = '<h5>Animations:</h5>';
                if (activeAnimations.size === 0) {
                    animHTML += '<p>No active animations.</p>';
                } else {
                    activeAnimations.forEach((props, tween) => {
                        const target = tween.targets()[0];
                        animHTML += `<div><strong>Target: ${getElementIdentifier(target)}</strong>`;
                        ['duration', 'delay', 'ease', 'repeat', 'yoyo', 'stagger'].forEach(prop => {
                            if (props[prop] !== undefined) {
                                animHTML += `<p style="margin-left: 10px;">${formatProperty(prop, props[prop])}</p>`;
                            }
                        });
                        for (const key in props.current) { // Live current values (x, y, rotation, etc.)
                            animHTML += `<p style="margin-left: 10px;">${formatProperty(key, props.current[key])}</p>`;
                        }
                        for (const key in props) { // Target values for other CSS properties
                            if (!['duration', 'delay', 'ease', 'repeat', 'yoyo', 'stagger', 'current'].includes(key)) {
                                animHTML += `<p style="margin-left: 10px;">${formatProperty(key, props[key])} (target)</p>`;
                            }
                        }
                        animHTML += `</div>`;
                    });
                }
                ui.animationDiv.innerHTML = animHTML;
            } else {
                ui.animationDiv.innerHTML = '';
            }

            // Update Timelines section if visible
            if (ui.menuTimelinesCheckbox.checked) {
                let timelineHTML = '<h5>Timelines:</h5>';
                if (activeTimelines.size === 0) {
                    timelineHTML += '<p>No active timelines.</p>';
                } else {
                    activeTimelines.forEach((props, timeline) => {
                        timelineHTML += `<div><strong>Timeline: ${timeline.vars.id || 'Unnamed'}</strong>`;
                        for (const key in props) {
                            if (key === 'callbacks') {
                                timelineHTML += `<p style="margin-left: 10px;">Callbacks:</p>`;
                                for (const cbKey in props.callbacks) {
                                    timelineHTML += `<p style="margin-left: 20px;">- ${formatProperty(cbKey, props.callbacks[cbKey])}</p>`;
                                }
                            } else {
                                timelineHTML += `<p style="margin-left: 10px;">${formatProperty(key, props[key])}</p>`;
                            }
                        }
                        timelineHTML += `</div>`;
                    });
                }
                ui.timelineDiv.innerHTML = timelineHTML;
            } else {
                ui.timelineDiv.innerHTML = '';
            }

            // Update ScrollTriggers section if visible
            if (ui.menuScrollTriggerCheckbox.checked) {
                let stHTML = '<h5>ScrollTriggers:</h5>';
                if (activeScrollTriggers.size === 0) {
                    stHTML += '<p>No active ScrollTriggers.</p>';
                } else {
                    activeScrollTriggers.forEach((props, st) => {
                        stHTML += `<div>
                                    <strong>Trigger: ${getElementIdentifier(st.trigger)}</strong><br>
                                    Scroller: ${getElementIdentifier(st.scroller)}
                                    <p style="margin-left: 10px;">Progress: ${props.currentProgress}</p>
                                    <p style="margin-left: 10px;">Start: ${props.start}</p>
                                    <p style="margin-left: 10px;">End: ${props.end}</p>
                                    <p style="margin-left: 10px;">Scrub: ${props.scrubValue}</p>
                                    <p style="margin-left: 10px;">Pin: ${props.pinState}</p>
                                    <p style="margin-left: 10px;">Actions: ${props.toggleActions}</p>
                                    <p style="margin-left: 10px;">Is Active: ${props.isActive}</p>
                                  </div>`;
                    });
                }
                ui.scrollTriggerDiv.innerHTML = stHTML;
            } else {
                ui.scrollTriggerDiv.innerHTML = '';
            }

            // Update Events section if visible
            if (ui.menuEventsCheckbox.checked) {
                let eventHTML = '<h5>Events:</h5>';
                if (Object.keys(eventData).length === 0) {
                    eventHTML += '<p>No active events to track.</p>';
                } else {
                    for (const key in eventData) {
                        eventHTML += `<p>${formatProperty(key, eventData[key])}</p>`;
                    }
                }
                ui.eventsDiv.innerHTML = eventHTML;
            } else {
                ui.eventsDiv.innerHTML = '';
            }
        };


        // --- GSAP Ticker for Data Polling (Non-interfering observation) ---
        // This function runs on every GSAP animation frame.
        const tickerUpdate = () => {
            if (!debuggerEnabled) {
                // If debugger is disabled, clear all data maps to reduce memory footprint
                activeAnimations.clear();
                activeTimelines.clear();
                activeScrollTriggers.clear();
                Object.keys(eventData).forEach(key => delete eventData[key]);
                return;
            }

            // --- Collect Core Animations Data ---
            if (ui.menuCoreAnimationsCheckbox.checked) {
                // Get all active tweens (not timelines) directly attached to the global timeline
                const allRootTweens = gsap.globalTimeline.getChildren(true, false, false); // includeTweens=true, includeTimelines=false

                // Maintain a list of currently polled tweens to detect completed ones
                const currentlyPolledTweens = new Set();

                allRootTweens.forEach(tween => { // Now `tween` is guaranteed to be a Tween instance
                    // Check if it's currently active (not completed, paused, or reversed)
                    if (tween.progress() < 1 && !tween.paused() && !tween.reversed() && tween.duration() > 0) {
                        currentlyPolledTweens.add(tween);

                        let props = activeAnimations.get(tween);
                        if (!props) {
                            // If not already tracked, initialize it with static and target CSS properties
                            const staticProps = {};
                            ['duration', 'delay', 'ease', 'repeat', 'yoyo', 'stagger'].forEach(prop => {
                                if (tween.vars[prop] !== undefined) {
                                    staticProps[prop] = tween.vars[prop];
                                }
                            });
                            const cssPropsToMonitor = {};
                            Object.keys(tween.vars).forEach(key => {
                                const excluded = ['onUpdate', 'onComplete', 'onStart', 'onReverseComplete', 'onInterrupt', 'onRepeat', 'onEachComplete', 'delay', 'duration', 'ease', 'repeat', 'yoyo', 'stagger', 'id', 'overwrite', 'callbackScope', 'paused', 'reversed', 'data', 'immediateRender', 'lazy', 'inherit', 'runBackwards', 'simple', 'overwrite', 'callbackScope', 'defaults', 'onToggle', 'scrollTrigger'];
                                if (!excluded.includes(key) && typeof tween.vars[key] !== 'function') {
                                    cssPropsToMonitor[key] = tween.vars[key];
                                }
                            });
                            props = {...staticProps, ...cssPropsToMonitor, current: {}};
                            activeAnimations.set(tween, props);
                        }

                        // Update live properties
                        const target = tween.targets()[0];
                        if (target) {
                            const liveUpdates = {};
                            const coreTransformProps = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity'];
                            coreTransformProps.forEach(prop => {
                                if (tween.vars[prop] !== undefined) {
                                    liveUpdates[`current_${prop}`] = gsap.getProperty(target, prop);
                                }
                            });
                            Object.assign(props.current, liveUpdates);
                            activeAnimations.set(tween, props); // Re-set to ensure map is updated
                        }
                    }
                });

                // Remove tweens from activeAnimations that are no longer active or tracked by GSAP
                activeAnimations.forEach((props, tween) => {
                    // Remove if no longer polled or if it completed/paused/reversed outside of our polling's detection
                    if (!currentlyPolledTweens.has(tween) && (tween.progress() === 1 || tween.paused() || tween.reversed())) {
                        activeAnimations.delete(tween);
                    }
                });
            } else {
                activeAnimations.clear(); // Clear all data if section is off
            }

            // --- Collect Timelines Data ---
            if (ui.menuTimelinesCheckbox.checked) {
                // Get all active timelines (not tweens) directly attached to the global timeline
                const allRootTimelines = gsap.globalTimeline.getChildren(false, true, false); // includeTweens=false, includeTimelines=true

                const currentlyPolledTimelines = new Set();
                allRootTimelines.forEach(timeline => { // `timeline` is now guaranteed to be a Timeline instance
                    // Check if it's currently active (not completed, paused, or reversed)
                    if (timeline.progress() < 1 && !timeline.paused() && !timeline.reversed() && timeline.duration() > 0) {
                        currentlyPolledTimelines.add(timeline);
                        let props = activeTimelines.get(timeline);
                        if (!props) {
                            props = {}; // Initialize if not tracked
                            activeTimelines.set(timeline, props);
                        }
                        Object.assign(props, {
                            status: timeline.paused() ? 'paused' : (timeline.reversed() ? 'reversed' : 'playing'),
                            currentTime: timeline.time().toFixed(2) + 's',
                            timeScale: timeline.timeScale().toFixed(2),
                            totalDuration: timeline.totalDuration().toFixed(2) + 's',
                            positionParametersUsed: timeline.getChildren().some(t => typeof t.position === 'string' && (t.position.includes('<') || t.position.includes('>') || t.position.includes('+='))),
                            callbacks: {
                                onComplete: !!timeline.vars.onComplete,
                                onStart: !!timeline.vars.onStart,
                                onReverseComplete: !!timeline.vars.onReverseComplete
                            }
                        });
                        activeTimelines.set(timeline, props);
                    }
                });
                activeTimelines.forEach((props, timeline) => {
                    // Remove timelines that are no longer active or tracked by GSAP
                    if (!currentlyPolledTimelines.has(timeline) && (timeline.progress() === 1 || timeline.paused() || timeline.reversed())) {
                        activeTimelines.delete(timeline);
                    }
                });
            } else {
                activeTimelines.clear();
            }

            // --- Collect ScrollTriggers Data ---
            if (ui.menuScrollTriggerCheckbox.checked && scrollTriggerAvailable) {
                const allScrollTriggers = ScrollTrigger.getAll();
                const currentlyPolledSTs = new Set();

                allScrollTriggers.forEach(st => {
                    currentlyPolledSTs.add(st);
                    let props = activeScrollTriggers.get(st);
                    if (!props) {
                        props = {}; // Initialize if not tracked
                        activeScrollTriggers.set(st, props);
                    }
                    Object.assign(props, {
                        triggerElement: getElementIdentifier(st.trigger),
                        scroller: getElementIdentifier(st.scroller),
                        start: typeof st.start === 'number' ? st.start.toFixed(0) : st.start,
                        end: typeof st.end === 'number' ? st.end.toFixed(0) : st.end,
                        currentProgress: st.progress.toFixed(3),
                        scrubValue: st.vars.scrub === true ? 'true' : (typeof st.vars.scrub === 'number' ? st.vars.scrub.toFixed(1) : 'none'),
                        pinState: st.pin ? 'true' : 'false',
                        isActive: st.isActive ? 'true' : 'false',
                        toggleActions: st.vars.toggleActions ? st.vars.toggleActions.split(' ').join(', ') : 'play, none, none, none'
                    });
                    activeScrollTriggers.set(st, props);
                });
                activeScrollTriggers.forEach((props, st) => {
                    // Remove STs if no longer polled or its associated animation completed (if it has one)
                    if (!currentlyPolledSTs.has(st) && (!st.animation || st.animation.progress() === 1)) {
                        activeScrollTriggers.delete(st);
                    }
                });
            } else {
                activeScrollTriggers.clear();
            }

            // Events data is handled by direct event listeners, no need to poll here.
            // Clear if disabled.
            if (!ui.menuEventsCheckbox.checked) {
                 Object.keys(eventData).forEach(key => delete eventData[key]);
            }
        };

        // Add the primary data collection function to GSAP's ticker
        gsap.ticker.add(tickerUpdate);

        // --- Mouse/Event-Related Data ---
        const updateEventData = (type, e) => {
            if (!debuggerEnabled || !ui.menuEventsCheckbox.checked) {
                Object.keys(eventData).forEach(key => delete eventData[key]);
                return;
            }
            eventData.eventType = type;
            if (e.clientX !== undefined) eventData.mouseX = e.clientX.toFixed(0);
            if (e.clientY !== undefined) eventData.mouseY = e.clientY.toFixed(0);
            if (e.deltaY !== undefined) eventData.deltaY = e.deltaY.toFixed(0);
            if (e.key !== undefined) eventData.lastKey = e.key;
            if (e.target) eventData.eventTarget = getElementIdentifier(e.target);
        };

        window.addEventListener('mousemove', (e) => updateEventData('mousemove', e));
        window.addEventListener('click', (e) => updateEventData('click', e));
        window.addEventListener('wheel', (e) => updateEventData('wheel', e));
        window.addEventListener('keypress', (e) => updateEventData('keypress', e));
        window.addEventListener('mousedown', (e) => updateEventData('mousedown', e));
        window.addEventListener('mouseup', (e) => updateEventData('mouseup', e));
        window.addEventListener('resize', () => {
             updateEventData('resize', { target: window });
        });

        // --- Update UI Loop and Keyboard Shortcut ---
        setInterval(updateDisplay, 100); // UI update frequency

        window.addEventListener('keydown', (e) => {
            if (e.key === 'D' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                const toggleButton = ui.debuggerContainer.querySelector('#gsap-debugger-toggle');
                if (toggleButton) {
                    toggleButton.click();
                }
            }
        });
    };

    // --- Initial Entry Point ---
    window.addEventListener('DOMContentLoaded', () => {
        setTimeout(initializeDebugger, 500); // Give Webflow & GSAP a moment to load
    });

})();
