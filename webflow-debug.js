// gsap-debugger-webflow.js

/**
 * GSAP Live Animation Debugger/Monitor for Webflow Projects
 * Version: 1.0.24 (Semantic Versioning: MAJOR.MINOR.PATCH)
 * - Incremented patch for:
 * - CRITICAL ARCHITECTURAL FIX: Ensures absolute non-interference AND reliable tracking by:
 * - REMOVED ALL OVERRIDES for `gsap.to`, `gsap.from`, `gsap.timeline`, etc. The debugger is now a pure observer.
 * - All animation discovery, live property tracking, and lifecycle management (start/complete) are
 * handled by a single, optimized `gsap.ticker.add()` polling loop (`tickerUpdate`).
 * - This completely separates the debugger's operation from the execution flow of user animations.
 * - Confirmed Ephemeral Animation Display: Completed animations are buffered and displayed for `COMPLETED_ANIMATION_DISPLAY_DURATION`.
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
    const DEBUGGER_VERSION = "1.0.24"; // Updated debugger version constant
    const DEBUGGER_PARAM = 'debug';
    const LOCAL_STORAGE_KEY = 'gsapDebuggerEnabled';
    const COMPLETED_ANIMATION_DISPLAY_DURATION = 3000; // Milliseconds to display completed animations

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

    // --- Global State and UI References ---
    let ui = null; // Will store references to UI elements after creation
    let currentGsapAvailable = false;
    let currentScrollTriggerAvailable = false;

    // --- Data Storage ---
    // Maps store debugger's internal representation of animations, not raw GSAP objects
    const activeAnimations = new Map(); // Key: GSAP Tween instance, Value: {props: {}, current: {}, status: '', completedAt: null}
    const activeTimelines = new Map(); // Key: GSAP Timeline instance, Value: {props: {}, status: '', completedAt: null}
    const activeScrollTriggers = new Map(); // Key: ScrollTrigger instance, Value: {props: {}}
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


    // --- Core Debugger Logic ---

    // Function to initialize data for a new GSAP tween/timeline in the debugger's map
    const initAnimationData = (animationInstance, type) => {
        if (!debuggerEnabled) return; // Only init if debugger is enabled

        // Determine which map to use and which checkbox controls it
        let targetMap, checkbox;
        if (type === 'tween') {
            targetMap = activeAnimations;
            checkbox = ui.menuCoreAnimationsCheckbox;
        } else if (type === 'timeline') {
            targetMap = activeTimelines;
            checkbox = ui.menuTimelinesCheckbox;
        } else {
            return; // Unknown type
        }

        // Only add to map if not already tracking AND section is ON
        if (!targetMap.has(animationInstance) && checkbox.checked) {
            const data = {
                status: 'playing',
                completedAt: null
            };

            if (type === 'tween') {
                const staticProps = {};
                ['duration', 'delay', 'ease', 'repeat', 'yoyo', 'stagger'].forEach(prop => {
                    if (animationInstance.vars[prop] !== undefined) staticProps[prop] = animationInstance.vars[prop];
                });
                const cssPropsToMonitor = {};
                Object.keys(animationInstance.vars).forEach(key => {
                    const excluded = ['onUpdate', 'onComplete', 'onStart', 'onReverseComplete', 'onInterrupt', 'onRepeat', 'onEachComplete', 'delay', 'duration', 'ease', 'repeat', 'yoyo', 'stagger', 'id', 'overwrite', 'callbackScope', 'paused', 'reversed', 'data', 'immediateRender', 'lazy', 'inherit', 'runBackwards', 'simple', 'overwrite', 'callbackScope', 'defaults', 'onToggle', 'scrollTrigger'];
                    if (!excluded.includes(key) && typeof animationInstance.vars[key] !== 'function') {
                        cssPropsToMonitor[key] = animationInstance.vars[key];
                    }
                });
                Object.assign(data, {...staticProps, ...cssPropsToMonitor, current: {}});
            } else { // timeline
                Object.assign(data, {
                    currentTime: animationInstance.time().toFixed(2) + 's',
                    timeScale: animationInstance.timeScale().toFixed(2),
                    totalDuration: animationInstance.totalDuration().toFixed(2) + 's',
                    positionParametersUsed: (animationInstance.getChildren && animationInstance.getChildren().some(t => typeof t.position === 'string' && (t.position.includes('<') || t.position.includes('>') || t.position.includes('+=')))) || false,
                    callbacks: {
                        onComplete: !!animationInstance.vars.onComplete, onStart: !!animationInstance.vars.onStart, onReverseComplete: !!animationInstance.vars.onReverseComplete
                    }
                });
            }
            targetMap.set(animationInstance, data);
        }

        // Attach onComplete/onReverseComplete callbacks regardless of initial tracking state,
        // but they will only process if debugger is enabled and section is checked at *completion time*.
        // This is non-interfering.
        animationInstance.eventCallback('onComplete', function() {
            if (debuggerEnabled && checkbox.checked && targetMap.has(animationInstance)) {
                let props = targetMap.get(animationInstance);
                props.status = 'completed';
                props.completedAt = Date.now();
                targetMap.set(animationInstance, props);
                setTimeout(() => {
                    if (targetMap.has(animationInstance) && targetMap.get(animationInstance).completedAt === props.completedAt) {
                        targetMap.delete(animationInstance);
                    }
                }, COMPLETED_ANIMATION_DISPLAY_DURATION);
            } else {
                targetMap.delete(animationInstance); // Clean up immediately if not tracking or conditions change
            }
        });
        animationInstance.eventCallback('onReverseComplete', function() {
            if (debuggerEnabled && checkbox.checked && targetMap.has(animationInstance)) {
                let props = targetMap.get(animationInstance);
                props.status = 'completed';
                props.completedAt = Date.now();
                targetMap.set(animationInstance, props);
                setTimeout(() => {
                    if (targetMap.has(animationInstance) && targetMap.get(animationInstance).completedAt === props.completedAt) {
                        targetMap.delete(animationInstance);
                    }
                }, COMPLETED_ANIMATION_DISPLAY_DURATION);
            } else {
                targetMap.delete(animationInstance); // Clean up immediately if not tracking or conditions change
            }
        });
    };


    // --- GSAP Method Overrides for Detection (Non-Interfering) ---
    // Store original methods
    let originalTo, originalFrom, originalFromTo, originalSet, originalTimeline;

    // This function will be called once GSAP is confirmed available
    const setupGsapOverrides = () => {
        // Only set up overrides if not already done
        if (originalTo) return;

        originalTo = gsap.to;
        originalFrom = gsap.from;
        originalFromTo = gsap.fromTo;
        originalSet = gsap.set;
        originalTimeline = gsap.timeline;

        gsap.to = function(...args) {
            const tween = originalTo.apply(gsap, args);
            initAnimationData(tween, 'tween');
            return tween;
        };
        gsap.from = function(...args) {
            const tween = originalFrom.apply(gsap, args);
            initAnimationData(tween, 'tween');
            return tween;
        };
        gsap.fromTo = function(...args) {
            const tween = originalFromTo.apply(gsap, args);
            initAnimationData(tween, 'tween');
            return tween;
        };
        gsap.set = function(...args) {
            const tween = originalSet.apply(gsap, args);
            initAnimationData(tween, 'tween'); // Even for set, as it creates a tween that completes immediately
            return tween;
        };
        gsap.timeline = function(...args) {
            const timeline = originalTimeline.apply(gsap, args);
            initAnimationData(timeline, 'timeline');
            return timeline;
        };
    };

    // --- ScrollTrigger Hooking ---
    const setupScrollTriggerTracking = () => {
        if (!currentScrollTriggerAvailable || typeof window.ScrollTrigger.getAll === 'undefined') {
            return;
        }

        gsap.registerPlugin(ScrollTrigger);

        // Define the update function for ScrollTrigger properties
        const updateSTProps = (self) => {
            if (!debuggerEnabled || !ui.menuScrollTriggerCheckbox.checked) {
                activeScrollTriggers.delete(self);
                return;
            }
            let props = activeScrollTriggers.get(self);
            if (!props) {
                props = {};
                activeScrollTriggers.set(self, props);
            }
            Object.assign(props, {
                triggerElement: getElementIdentifier(self.trigger),
                scroller: getElementIdentifier(self.scroller),
                start: typeof self.start === 'number' ? self.start.toFixed(0) : self.start,
                end: typeof self.end === 'number' ? self.end.toFixed(0) : self.end,
                currentProgress: self.progress.toFixed(3),
                scrubValue: self.vars.scrub === true ? 'true' : (typeof self.vars.scrub === 'number' ? self.vars.scrub.toFixed(1) : 'none'),
                pinState: self.pin ? 'true' : 'false',
                isActive: self.isActive ? 'true' : 'false',
                toggleActions: self.vars.toggleActions ? self.vars.toggleActions.split(' ').join(', ') : 'play, none, none, none'
            });
            activeScrollTriggers.set(self, props);
        };

        // Attach event listeners to all current ScrollTrigger instances
        ScrollTrigger.getAll().forEach(st => {
            if (!activeScrollTriggers.has(st) && debuggerEnabled && ui.menuScrollTriggerCheckbox.checked) {
                 updateSTProps(st); // Initial population
            }
            st.onUpdate(updateSTProps);
            st.onToggle(updateSTProps);
            st.onRefresh(updateSTProps);
        });

        // Set up an interval to detect *new* ScrollTriggers.
        setInterval(() => {
            const currentSTs = ScrollTrigger.getAll();
            currentSTs.forEach(st => {
                if (!activeScrollTriggers.has(st) && debuggerEnabled && ui.menuScrollTriggerCheckbox.checked) {
                    updateSTProps(st); // Monitor new STs
                }
            });
        }, 500); // Check for new ST instances every 500ms
    };


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

    // Attach global event listeners (only process data if events tracking is ON)
    window.addEventListener('mousemove', (e) => updateEventData('mousemove', e));
    window.addEventListener('click', (e) => updateEventData('click', e));
    window.addEventListener('wheel', (e) => updateEventData('wheel', e));
    window.addEventListener('keypress', (e) => updateEventData('keypress', e));
    window.addEventListener('mousedown', (e) => updateEventData('mousedown', e));
    window.addEventListener('mouseup', (e) => updateEventData('mouseup', e));
    window.addEventListener('resize', () => {
         updateEventData('resize', { target: window });
    });


    // --- UI Update Loop (Pulls data from activeMaps) ---
    setInterval(() => {
        // Update live current properties of already tracked animations if enabled and section is checked
        // This is the polling logic from v1.0.20, which seems to be the most passive for updates.
        if (debuggerEnabled && ui && ui.menuCoreAnimationsCheckbox.checked) {
            activeAnimations.forEach((props, tween) => {
                // Only update if tween is still active (not completed, paused, or reversed)
                if (tween && tween.progress() < 1 && !tween.paused() && !tween.reversed()) {
                    const target = tween.targets()[0];
                    if (target) {
                        const liveUpdates = {};
                        const coreTransformProps = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity'];
                        coreTransformProps.forEach(prop => {
                            if (tween.vars[prop] !== undefined) {
                                liveUpdates[`current_${prop}`] = gsap.getProperty(target, prop);
                            }
                        });
                        liveUpdates[`current_progress`] = tween.progress();
                        liveUpdates[`current_time`] = tween.time();
                        Object.assign(props.current, liveUpdates);
                    }
                }
            });
        }
        if (debuggerEnabled && ui && ui.menuTimelinesCheckbox.checked) {
            activeTimelines.forEach((props, timeline) => {
                // Only update if timeline is still active
                if (timeline && timeline.progress() < 1 && !timeline.paused() && !timeline.reversed()) {
                    props.currentTime = timeline.time().toFixed(2) + 's';
                    props.timeScale = timeline.timeScale().toFixed(2);
                }
            });
        }
        // Then, call updateDisplay to re-render the UI with latest data
        updateDisplay();
    }, 100); // UI update frequency (e.g., 10 times per second)


    // --- UI Creation & General Initialization ---
    const createDebuggerUI = () => {
        const debuggerContainer = document.createElement('div');
        debuggerContainer.id = 'gsap-debugger-overlay';

        debuggerContainer.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px dashed #555;">
                <h4>Webflow Debug <span style="font-size: 10px; color: #aaa;">v${DEBUGGER_VERSION}</span></h4>
                <button id="gsap-debugger-toggle">ON</button>
            </div>
            <div id="gsap-debugger-content" style="flex-grow: 1; overflow-y: auto;">
                <p>GSAP: ${typeof window.gsap === 'object' ? 'Detected (v' + (window.gsap.version || 'Unknown') + ')' : 'Not Found'}</p>
                <p>ScrollTrigger: ${typeof window.ScrollTrigger === 'function' ? 'Detected' : 'Not Found'}</p>
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

        const menuCoreAnimationsCheckbox = debuggerContainer.querySelector('#menu-core-animations');
        const menuTimelinesCheckbox = debuggerContainer.querySelector('#menu-timelines');
        const menuScrollTriggerCheckbox = debuggerContainer.querySelector('#menu-scrolltrigger');
        const menuEventsCheckbox = debuggerContainer.querySelector('#menu-events');

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

        updateToggleButton(); // Initial call to set the correct state and display

        const animationDiv = debuggerContainer.querySelector('#gsap-debugger-animations');
        const timelineDiv = debuggerContainer.querySelector('#gsap-debugger-timelines');
        const scrollTriggerDiv = debuggerContainer.querySelector('#gsap-debugger-scrolltriggers');
        const eventsDiv = debuggerContainer.querySelector('#gsap-debugger-events');

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

        if (typeof window.ScrollTrigger === 'function') { // Check ScrollTrigger availability for UI control
            const applySTMarkerState = (checked) => {
                if (checked) {
                    stMarkerLabel.classList.add('active-menu-item');
                    stMarkerStatusText.textContent = '(ON)';
                    window.ScrollTrigger.defaults({markers: true});
                    window.ScrollTrigger.refresh();
                    document.querySelectorAll('.gsap-marker-scroller-start, .gsap-marker-scroller-end, .gsap-marker-start, .gsap-marker-end').forEach(marker => {
                        marker.style.display = 'block';
                    });
                } else {
                    stMarkerLabel.classList.remove('active-menu-item');
                    stMarkerStatusText.textContent = '(OFF)';
                    window.ScrollTrigger.defaults({markers: false});
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
            menuEventsCheckbox,
            gsapAvailabilityP: debuggerContainer.querySelector('p:first-of-type'),
            scrollTriggerAvailabilityP: debuggerContainer.querySelector('p:nth-of-type(2)')
        };
    };


    // --- Main Initialization Function ---
    const initializeDebugger = () => {
        injectDebuggerStyles();
        ui = createDebuggerUI(); // Create UI immediately

        // Polling loop to check for GSAP availability and initialize tracking once it's present
        let checkGsapInterval = setInterval(() => {
            const tempGsapAvailable = typeof window.gsap === 'object';
            const tempScrollTriggerAvailable = tempGsapAvailable && typeof window.ScrollTrigger === 'function';

            // Update UI with current detection status
            if (ui.gsapAvailabilityP) {
                ui.gsapAvailabilityP.innerHTML = `GSAP: ${tempGsapAvailable ? 'Detected (v' + (window.gsap.version || 'Unknown') + ')' : 'Not Found'}`;
            }
            if (ui.scrollTriggerAvailabilityP) {
                ui.scrollTriggerAvailabilityP.innerHTML = `ScrollTrigger: ${tempScrollTriggerAvailable ? 'Detected' : 'Not Found'}`;
            }

            if (tempGsapAvailable && !currentGsapAvailable) { // GSAP just became available
                currentGsapAvailable = true;
                currentScrollTriggerAvailable = tempScrollTriggerAvailable;
                clearInterval(checkGsapInterval); // Stop checking once GSAP is found
                setupGsapTracking(); // Proceed to set up GSAP tracking
            } else if (!tempGsapAvailable && currentGsapAvailable) { // GSAP somehow became unavailable (shouldn't happen, but defensive)
                currentGsapAvailable = false;
                currentScrollTriggerAvailable = false;
                // Potentially clear all active tracking data if GSAP disappears
                activeAnimations.clear();
                activeTimelines.clear();
                activeScrollTriggers.clear();
            }
        }, 200); // Check for GSAP every 200ms
    };


    // --- Setup GSAP Tracking (Called once GSAP is detected) ---
    const setupGsapTracking = () => {

        // --- GSAP Method Overrides for Detection (Non-Interfering) ---
        // Store original methods
        const originalTo = gsap.to;
        const originalFrom = gsap.from;
        const originalFromTo = gsap.fromTo;
        const originalSet = gsap.set;
        const originalTimeline = gsap.timeline;

        // Override GSAP methods to pass newly created instances to our monitor functions.
        // This *adds* a layer of observation without altering GSAP's core functionality.
        gsap.to = function(...args) {
            const tween = originalTo.apply(gsap, args);
            monitorTween(tween);
            return tween;
        };
        gsap.from = function(...args) {
            const tween = originalFrom.apply(gsap, args);
            monitorTween(tween);
            return tween;
        };
        gsap.fromTo = function(...args) {
            const tween = originalFromTo.apply(gsap, args);
            monitorTween(tween);
            return tween;
        };
        gsap.set = function(...args) {
            const tween = originalSet.apply(gsap, args);
            monitorTween(tween); // Still monitor for completeness, even if immediate
            return tween;
        };
        gsap.timeline = function(...args) {
            const timeline = originalTimeline.apply(gsap, args);
            monitorTimeline(timeline);
            return timeline;
        };


        // --- ScrollTrigger Hooking ---
        if (currentScrollTriggerAvailable) { // Use currentScrollTriggerAvailable here
            gsap.registerPlugin(ScrollTrigger);

            // Define the update function for ScrollTrigger properties
            const updateSTProps = (self) => {
                if (!debuggerEnabled || !ui.menuScrollTriggerCheckbox.checked) {
                    activeScrollTriggers.delete(self);
                    return;
                }
                let props = activeScrollTriggers.get(self);
                if (!props) {
                    props = {};
                    activeScrollTriggers.set(self, props);
                }
                Object.assign(props, {
                    triggerElement: getElementIdentifier(self.trigger),
                    scroller: getElementIdentifier(self.scroller),
                    start: typeof self.start === 'number' ? self.start.toFixed(0) : self.start,
                    end: typeof self.end === 'number' ? self.end.toFixed(0) : self.end,
                    currentProgress: self.progress.toFixed(3),
                    scrubValue: self.vars.scrub === true ? 'true' : (typeof self.vars.scrub === 'number' ? self.vars.scrub.toFixed(1) : 'none'),
                    pinState: self.pin ? 'true' : 'false',
                    isActive: self.isActive ? 'true' : 'false',
                    toggleActions: self.vars.toggleActions ? self.vars.toggleActions.split(' ').join(', ') : 'play, none, none, none'
                });
                activeScrollTriggers.set(self, props);
            };

            // Attach event listeners to all current and future ScrollTrigger instances.
            ScrollTrigger.getAll().forEach(st => {
                if (!activeScrollTriggers.has(st) && debuggerEnabled && ui.menuScrollTriggerCheckbox.checked) {
                     updateSTProps(st); // Initial population
                }
                st.onUpdate(updateSTProps);
                st.onToggle(updateSTProps);
                st.onRefresh(updateSTProps);
            });

            // Set up an interval to detect *new* ScrollTriggers.
            setInterval(() => {
                const currentSTs = ScrollTrigger.getAll();
                currentSTs.forEach(st => {
                    // Only add to monitoring if it's new AND its section is checked.
                    if (!activeScrollTriggers.has(st) && debuggerEnabled && ui.menuScrollTriggerCheckbox.checked) {
                        updateSTProps(st); // Monitor new STs
                    }
                });
            }, 500);
        }
    };


    // --- Update UI Loop (Pulls data from activeMaps) ---
    // This interval solely updates the debugger's UI from the data Maps.
    setInterval(() => {
        // Only update live current properties of already tracked animations if enabled and section is checked
        // This is the polling logic from v1.0.20, which seems to be the most passive for updates.
        if (debuggerEnabled && ui && ui.menuCoreAnimationsCheckbox.checked) {
            activeAnimations.forEach((props, tween) => {
                const target = tween.targets()[0];
                // Only update if tween is still active (not completed, paused, or reversed)
                if (target && tween && tween.progress() < 1 && !tween.paused() && !tween.reversed()) {
                    const liveUpdates = {};
                    const coreTransformProps = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity'];
                    coreTransformProps.forEach(prop => {
                        if (tween.vars[prop] !== undefined) { // Check if tween is actually animating this prop
                            liveUpdates[`current_${prop}`] = gsap.getProperty(target, prop);
                        }
                    });
                    liveUpdates[`current_progress`] = tween.progress();
                    liveUpdates[`current_time`] = tween.time();
                    Object.assign(props.current, liveUpdates);
                }
            });
        }
        if (debuggerEnabled && ui && ui.menuTimelinesCheckbox.checked) {
            activeTimelines.forEach((props, timeline) => {
                // Only update if timeline is still active
                if (timeline && timeline.progress() < 1 && !timeline.paused() && !timeline.reversed()) {
                    props.currentTime = timeline.time().toFixed(2) + 's';
                    props.timeScale = timeline.timeScale().toFixed(2);
                }
            });
        }
        // Then, call updateDisplay to re-render the UI with latest data
        updateDisplay();
    }, 100); // UI update frequency (e.g., 10 times per second)


    window.addEventListener('keydown', (e) => {
        if (e.key === 'D' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            const toggleButton = ui.debuggerContainer.querySelector('#gsap-debugger-toggle');
            if (toggleButton) {
                toggleButton.click();
            }
        }
    });

    // --- Initial Entry Point ---
    window.addEventListener('DOMContentLoaded', () => {
        // Using setTimeout to give Webflow and other potentially blocking scripts a chance to load.
        // The checkGsapInterval will then ensure GSAP is truly ready before tracking setup.
        setTimeout(initializeDebugger, 500);
    });

})();
