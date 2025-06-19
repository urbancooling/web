// gsap-debugger-webflow.js

/**
 * GSAP Live Animation Debugger/Monitor for Webflow Projects
 * Version: 1.0.16 (Semantic Versioning: MAJOR.MINOR.PATCH)
 * - Incremented patch for:
 * - CRITICAL FIX: Ensures absolute non-interference with existing GSAP animations by:
 * - Reverting to attaching observers via `tween.eventCallback()` (which *adds* callbacks, not replaces).
 * - Removed all direct overriding of `gsap.to`, `gsap.from`, etc., and `gsap.ticker.add()` polling for animation status.
 * - GSAP callbacks are now the sole source of real-time animation state changes for the debugger.
 * - UX IMPROVEMENT: Implemented a buffer for completed animations:
 * - Animations now remain visible in the debugger for `COMPLETED_ANIMATION_DISPLAY_DURATION` (default 3 seconds)
 * after they complete, with a 'COMPLETED' status indicator.
 * - Refined data clearing: Data maps are cleared if sections are toggled OFF, or after buffer time for completed animations.
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
    const DEBUGGER_VERSION = "1.0.16"; // Updated debugger version constant
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
                        const statusColor = props.status === 'completed' ? '#ffcc00' : '#00ff00'; // Yellow for completed, green for playing
                        const statusText = props.status === 'completed' ? ' (COMPLETED)' : ' (PLAYING)';

                        animHTML += `<div style="border-color: ${statusColor} !important; margin-bottom: 8px !important; padding: 5px !important; border-radius: 4px !important;">
                                    <strong>Target: ${getElementIdentifier(target)} <span style="color: ${statusColor} !important;">${statusText}</span></strong>`;
                        ['duration', 'delay', 'ease', 'repeat', 'yoyo', 'stagger'].forEach(prop => {
                            if (props[prop] !== undefined) {
                                animHTML += `<p style="margin-left: 10px;">${formatProperty(prop, props[prop])}</p>`;
                            }
                        });
                        for (const key in props.current) {
                            animHTML += `<p style="margin-left: 10px;">${formatProperty(key, props.current[key])}</p>`;
                        }
                        for (const key in props) {
                            if (!['duration', 'delay', 'ease', 'repeat', 'yoyo', 'stagger', 'current', 'status', 'completedAt'].includes(key)) {
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
                        const statusColor = props.status === 'completed' ? '#ffcc00' : '#00ff00';
                        const statusText = props.status === 'completed' ? ' (COMPLETED)' : ' (PLAYING)';

                        timelineHTML += `<div style="border-color: ${statusColor} !important; margin-bottom: 8px !important; padding: 5px !important; border-radius: 4px !important;">
                                        <strong>Timeline: ${timeline.vars.id || 'Unnamed'} <span style="color: ${statusColor} !important;">${statusText}</span></strong>`;
                        for (const key in props) {
                            if (key === 'callbacks') {
                                timelineHTML += `<p style="margin-left: 10px;">Callbacks:</p>`;
                                for (const cbKey in props.callbacks) {
                                    timelineHTML += `<p style="margin-left: 20px;">- ${formatProperty(cbKey, props.callbacks[cbKey])}</p>`;
                                }
                            } else if (!['status', 'completedAt'].includes(key)) {
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
                        const statusColor = props.isActive === 'true' ? '#00ff00' : '#bbb'; // Green for active, grey for inactive
                        const statusText = props.isActive === 'true' ? ' (ACTIVE)' : ' (INACTIVE)';

                        stHTML += `<div style="border-color: ${statusColor} !important; margin-bottom: 8px !important; padding: 5px !important; border-radius: 4px !important;">
                                    <strong>Trigger: ${getElementIdentifier(st.trigger)} <span style="color: ${statusColor} !important;">${statusText}</span></strong><br>
                                    Scroller: ${getElementIdentifier(st.scroller)}
                                    <p style="margin-left: 10px;">Progress: ${props.currentProgress}</p>
                                    <p style="margin-left: 10px;">Start: ${props.start}</p>
                                    <p style="margin-left: 10px;">End: ${props.end}</p>
                                    <p style="margin-left: 10px;">Scrub: ${props.scrubValue}</p>
                                    <p style="margin-left: 10px;">Pin: ${props.pinState}</p>
                                    <p style="margin-left: 10px;">Actions: ${props.toggleActions}</p>
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


        // --- GSAP Hooking via Event Callbacks (Non-interfering observation) ---

        // Function to monitor individual GSAP tweens
        const monitorTween = (tween) => {
            // Add initial properties to activeAnimations Map
            if (!activeAnimations.has(tween)) {
                const staticProps = {};
                ['duration', 'delay', 'ease', 'repeat', 'yoyo', 'stagger'].forEach(prop => {
                    if (tween.vars[prop] !== undefined) staticProps[prop] = tween.vars[prop];
                });
                const cssPropsToMonitor = {};
                Object.keys(tween.vars).forEach(key => {
                    const excluded = ['onUpdate', 'onComplete', 'onStart', 'onReverseComplete', 'onInterrupt', 'onRepeat', 'onEachComplete', 'delay', 'duration', 'ease', 'repeat', 'yoyo', 'stagger', 'id', 'overwrite', 'callbackScope', 'paused', 'reversed', 'data', 'immediateRender', 'lazy', 'inherit', 'runBackwards', 'simple', 'overwrite', 'callbackScope', 'defaults', 'onToggle', 'scrollTrigger'];
                    if (!excluded.includes(key) && typeof tween.vars[key] !== 'function') {
                        cssPropsToMonitor[key] = tween.vars[key];
                    }
                });
                // Initialize status as 'playing' and no completedAt time
                activeAnimations.set(tween, {...staticProps, ...cssPropsToMonitor, current: {}, status: 'playing', completedAt: null});
            }


            // Attach onUpdate callback to continuously update live properties
            tween.eventCallback('onUpdate', function() { // Use 'function' to preserve 'this' context if needed, though 'tween' is passed
                if (!debuggerEnabled || !ui.menuCoreAnimationsCheckbox.checked) {
                    activeAnimations.delete(tween); // Clear if debugger disabled or section untracked
                    return;
                }

                let props = activeAnimations.get(tween);
                if (!props) { // Re-initialize if for some reason it was deleted but still updating
                    // This scenario should be rare with proper cleaning, but adds robustness
                    const staticProps = {}; // Re-extract static props as `tween.vars` is available
                    ['duration', 'delay', 'ease', 'repeat', 'yoyo', 'stagger'].forEach(prop => {
                        if (tween.vars[prop] !== undefined) staticProps[prop] = tween.vars[prop];
                    });
                    const cssPropsToMonitor = {};
                    Object.keys(tween.vars).forEach(key => {
                        const excluded = ['onUpdate', 'onComplete', 'onStart', 'onReverseComplete', 'onInterrupt', 'onRepeat', 'onEachComplete', 'delay', 'duration', 'ease', 'repeat', 'yoyo', 'stagger', 'id', 'overwrite', 'callbackScope', 'paused', 'reversed', 'data', 'immediateRender', 'lazy', 'inherit', 'runBackwards', 'simple', 'overwrite', 'callbackScope', 'defaults', 'onToggle', 'scrollTrigger'];
                        if (!excluded.includes(key) && typeof tween.vars[key] !== 'function') cssPropsToMonitor[key] = tween.vars[key];
                    });
                    props = {...staticProps, ...cssPropsToMonitor, current: {}, status: 'playing', completedAt: null};
                    activeAnimations.set(tween, props);
                }

                const target = tween.targets()[0];
                if (target) {
                    const liveUpdates = {};
                    const coreTransformProps = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity'];
                    coreTransformProps.forEach(prop => {
                        if (tween.vars[prop] !== undefined) { // Check if the property is actually animated by this tween
                            liveUpdates[`current_${prop}`] = gsap.getProperty(target, prop);
                        }
                    });
                    Object.assign(props.current, liveUpdates);
                }
                props.status = 'playing'; // Ensure status is playing during updates
                props.completedAt = null; // Clear completedAt if animation becomes active again
                activeAnimations.set(tween, props); // Update the map
            });

            // Attach onComplete callback to mark as completed and set timestamp
            tween.eventCallback('onComplete', function() {
                if (!activeAnimations.has(tween)) return; // Already cleared, or not tracked

                let props = activeAnimations.get(tween);
                props.status = 'completed';
                props.completedAt = Date.now();
                activeAnimations.set(tween, props);

                // Set a timeout to remove the animation after the display duration
                setTimeout(() => {
                    if (activeAnimations.has(tween) && activeAnimations.get(tween).completedAt === props.completedAt) { // Only remove if it hasn't become active again
                        activeAnimations.delete(tween);
                    }
                }, COMPLETED_ANIMATION_DISPLAY_DURATION);
            });

            // Similar logic for onReverseComplete
            tween.eventCallback('onReverseComplete', function() {
                 if (!activeAnimations.has(tween)) return;

                let props = activeAnimations.get(tween);
                props.status = 'completed';
                props.completedAt = Date.now();
                activeAnimations.set(tween, props);

                setTimeout(() => {
                    if (activeAnimations.has(tween) && activeAnimations.get(tween).completedAt === props.completedAt) {
                        activeAnimations.delete(tween);
                    }
                }, COMPLETED_ANIMATION_DISPLAY_DURATION);
            });
        };

        // Function to monitor individual GSAP timelines
        const monitorTimeline = (timeline) => {
            if (!activeTimelines.has(timeline)) {
                // Initial properties for timeline
                activeTimelines.set(timeline, {
                    status: 'playing',
                    completedAt: null,
                    // Store static timeline properties here initially, they don't change
                    currentTime: timeline.time().toFixed(2) + 's',
                    timeScale: timeline.timeScale().toFixed(2),
                    totalDuration: timeline.totalDuration().toFixed(2) + 's',
                    positionParametersUsed: (timeline.getChildren && timeline.getChildren().some(t => typeof t.position === 'string' && (t.position.includes('<') || t.position.includes('>') || t.position.includes('+=')))) || false,
                    callbacks: {
                        onComplete: !!timeline.vars.onComplete,
                        onStart: !!timeline.vars.onStart,
                        onReverseComplete: !!timeline.vars.onReverseComplete
                    }
                });
            }

            timeline.eventCallback('onUpdate', function() {
                if (!debuggerEnabled || !ui.menuTimelinesCheckbox.checked) {
                    activeTimelines.delete(timeline);
                    return;
                }
                let props = activeTimelines.get(timeline);
                if (!props) { // Re-initialize if deleted, but still updating
                     activeTimelines.set(timeline, {
                        status: 'playing',
                        completedAt: null,
                        currentTime: timeline.time().toFixed(2) + 's',
                        timeScale: timeline.timeScale().toFixed(2),
                        totalDuration: timeline.totalDuration().toFixed(2) + 's',
                        positionParametersUsed: (timeline.getChildren && timeline.getChildren().some(t => typeof t.position === 'string' && (t.position.includes('<') || t.position.includes('>') || t.position.includes('+=')))) || false,
                        callbacks: {
                            onComplete: !!timeline.vars.onComplete, onStart: !!timeline.vars.onStart, onReverseComplete: !!timeline.vars.onReverseComplete
                        }
                    });
                     props = activeTimelines.get(timeline); // Get updated props
                }

                // Update dynamic properties
                props.status = 'playing';
                props.completedAt = null;
                props.currentTime = timeline.time().toFixed(2) + 's';
                props.timeScale = timeline.timeScale().toFixed(2);
                activeTimelines.set(timeline, props);
            });

            timeline.eventCallback('onComplete', function() {
                if (!activeTimelines.has(timeline)) return;

                let props = activeTimelines.get(timeline);
                props.status = 'completed';
                props.completedAt = Date.now();
                activeTimelines.set(timeline, props);

                setTimeout(() => {
                    if (activeTimelines.has(timeline) && activeTimelines.get(timeline).completedAt === props.completedAt) {
                        activeTimelines.delete(timeline);
                    }
                }, COMPLETED_ANIMATION_DISPLAY_DURATION);
            });

            timeline.eventCallback('onReverseComplete', function() {
                 if (!activeTimelines.has(timeline)) return;

                let props = activeTimelines.get(timeline);
                props.status = 'completed';
                props.completedAt = Date.now();
                activeTimelines.set(timeline, props);

                setTimeout(() => {
                    if (activeTimelines.has(timeline) && activeTimelines.get(timeline).completedAt === props.completedAt) {
                        activeTimelines.delete(timeline);
                    }
                }, COMPLETED_ANIMATION_DISPLAY_DURATION);
            });
        };

        // This is a global function that GSAP calls internally whenever any tween or timeline is created.
        // We use it to attach our observers without interfering with creation logic.
        gsap.core.Animation.prototype.render = function() {
            // Call original render method first to ensure GSAP's internal logic runs
            // Using `call(this, ...args)` to ensure context and arguments are passed correctly
            const result = gsap.core.Animation.prototype.render.apply(this, arguments);

            if (!debuggerEnabled) return result; // Don't do anything if debugger is off

            // Check if this animation object is a direct child of the global timeline
            // This filters out nested animations within timelines, as we track timelines separately
            const parentTimeline = this.parent;
            if (parentTimeline !== gsap.globalTimeline && !parentTimeline._is
                ) { // _is property helps identify common internal GSAP types not meant to be "parents"
                return result; // Not a root-level animation or a timeline we care about here
            }

            if (this instanceof gsap.core.Tween) {
                // Ensure it's not a ScrollTrigger's internal scrub tween (which often gets created on globalTimeline)
                // These are typically short-lived and tied to ScrollTriggers, which we track separately
                if (!this.scrollTrigger) { // If it doesn't have an associated ScrollTrigger
                    // Only process if the Core Animations menu item is checked
                    if (ui.menuCoreAnimationsCheckbox.checked) {
                        monitorTween(this);
                    } else {
                        activeAnimations.delete(this); // Ensure it's cleared if checkbox is off
                    }
                }
            } else if (this instanceof gsap.core.Timeline) {
                // Only process if the Timelines menu item is checked
                if (ui.menuTimelinesCheckbox.checked) {
                    monitorTimeline(this);
                } else {
                    activeTimelines.delete(this); // Ensure it's cleared if checkbox is off
                }
            }
            return result;
        };


        // --- ScrollTrigger Hooking ---
        if (scrollTriggerAvailable) {
             gsap.registerPlugin(ScrollTrigger);

            // Instead of polling, we attach observers to ScrollTrigger's internal events
            // whenever a ScrollTrigger is created.
            // This is complex as ScrollTrigger doesn't expose a creation hook easily
            // We rely on monkey-patching ScrollTrigger.create or monitoring all instances.
            // A safer, non-interfering way is to iterate existing ones on init and periodically,
            // then ensure callbacks are attached, but only process data conditionally.

            const allExistingSTs = ScrollTrigger.getAll();
            allExistingSTs.forEach(st => monitorScrollTrigger(st));

            // Monitor for newly created ScrollTriggers
            // This relies on the core `ScrollTrigger.getAll()` for new instances.
            setInterval(() => {
                const currentSTs = ScrollTrigger.getAll();
                currentSTs.forEach(st => {
                    if (!activeScrollTriggers.has(st) && debuggerEnabled && ui.menuScrollTriggerCheckbox.checked) {
                        monitorScrollTrigger(st);
                    }
                });
            }, 500); // Check for new ST instances every 500ms

        }

        const monitorScrollTrigger = (st) => {
            // Initial check and add to map if not already there AND section is ON
            if (!activeScrollTriggers.has(st) && debuggerEnabled && ui.menuScrollTriggerCheckbox.checked) {
                activeScrollTriggers.set(st, {});
            }

            // Define the update function for this specific ScrollTrigger
            const updateSTProps = (self) => {
                if (!debuggerEnabled || !ui.menuScrollTriggerCheckbox.checked) {
                    activeScrollTriggers.delete(self); // Clear data if debugger disabled or section untracked
                    return;
                }
                let props = activeScrollTriggers.get(self);
                if (!props) { // Re-initialize if deleted, but still updating
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

            // Attach event listeners to ScrollTrigger instance. These are non-interfering.
            st.onUpdate(updateSTProps);
            st.onToggle(updateSTProps);
            st.onRefresh(updateSTProps);

            // Initial population of properties for this ST
            updateSTProps(st);
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
