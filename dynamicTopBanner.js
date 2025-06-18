Webflow.push(function () {
  // GSAP Powered sticky top-of-the-page dynamic banner and hide on scroll down, show on scroll up.
  // This script now also controls an OPTIONAL secondary sticky element: #sticky-filter-wrapper
  // VERSION: 2.0 (With Dynamic Debugging)

  let isInitialized = false;

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  function initNavScroll() {
    if (isInitialized) return;

    // ---!! DYNAMIC DEBUGGING CONTROL !!---
    // Set this to 'true' to show the live debug panel on the page.
    // Set to 'false' for production to hide it.
    const isDebugMode = true;
    let debugPanel = null;
    
    // --- Get CORE elements required on every page ---
    const banner = document.getElementById("top-banner");
    const navwrap = document.getElementById("nav-wrap");
    const pageContent = document.querySelector(".page_wrapper");

    // Abort if core elements are missing.
    if (!banner || !navwrap || !pageContent) {
      console.warn("Aborting script: Core elements were not found. (Requires: #top-banner, #nav-wrap, .page_wrapper)");
      return;
    }
    
    // --- Get OPTIONAL sticky filter element ---
    const filterWrapper = document.getElementById("sticky-filter-wrapper");

    isInitialized = true;
    console.log("Sticky nav script initialized.");
    if(filterWrapper) {
        console.log("Optional sticky filter element found and is being controlled.");
    }

    // ---!! SETUP DEBUG PANEL !!---
    if (isDebugMode) {
        console.log("Debug Mode is ON.");
        // Create the debug panel element
        debugPanel = document.createElement('div');
        debugPanel.id = 'dynamic-debug-panel';
        debugPanel.style.cssText = 'position:fixed; bottom:10px; left:10px; background:rgba(0,0,0,0.7); color:white; padding:10px; border-radius:8px; font-family:monospace; font-size:12px; z-index:9999; line-height:1.5; pointer-events:none;';
        document.body.appendChild(debugPanel);
    }


    const STICKY_OFFSET = 32; // This is your desired 2rem/32px gap below the nav

    // This function calculates and applies positions for core layout and the optional filter
    function updatePositions() {
      const navWrapHeight = navwrap.offsetHeight;

      // 1. Update page content padding (always runs). This prevents content from jumping behind the fixed nav.
      pageContent.style.paddingTop = `${navWrapHeight}px`;
      
      // 2. Conditionally set the filter's sticky top position IF it exists on the page.
      if (filterWrapper) {
          // 'top' defines where the element will stick relative to the viewport.
          const filterStickyTopValue = navWrapHeight + STICKY_OFFSET;
          filterWrapper.style.top = `${filterStickyTopValue}px`;
      }
    }

    // --- State Variables ---
    let bannerHidden = false;   // Is the banner currently visible or hidden?
    let isAnimating = false;    // Is a GSAP animation currently in progress?
    let scrollDelta = 0;        // How many pixels has the user scrolled in the current direction?
    let lastScroll = window.pageYOffset; // The last recorded scroll position.
    let lastDirection = null;   // Was the last scroll direction 'up' or 'down'?
    const threshold = 200;      // How far the user must scroll before the animation triggers.

    // A helper function to get the banner's current height.
    function getBannerHeight() {
      return banner.getBoundingClientRect().height;
    }

    // Set the initial position of the nav wrapper.
    gsap.set(navwrap, { y: 0 });

    // The main function that runs on every animation frame to check scroll position.
    function checkScroll() {
      const currentScroll = window.pageYOffset;
      const direction = currentScroll > lastScroll ? "down" : "up";

      // ---!! UPDATE DEBUG PANEL !!---
      if (isDebugMode && debugPanel) {
        debugPanel.innerHTML = `
          <strong>-- Live Debug --</strong><br>
          Scroll Position: ${Math.round(currentScroll)}px<br>
          Direction: ${direction.toUpperCase()}<br>
          Scroll Delta: ${Math.round(scrollDelta)}px / ${threshold}px<br>
          Banner Hidden: ${bannerHidden}<br>
          Animating: ${isAnimating}
        `;
      }

      // Ignore tiny scroll movements to prevent jitter.
      if (Math.abs(currentScroll - lastScroll) < 5) {
        requestAnimationFrame(checkScroll);
        return;
      }

      // If the scroll direction changes, reset the scroll delta.
      if (direction !== lastDirection) {
        scrollDelta = 0;
        lastDirection = direction;
      }

      // Accumulate the distance scrolled in the current direction.
      scrollDelta += Math.abs(currentScroll - lastScroll);
      lastScroll = currentScroll;

      // When near the top of the page, always show the nav and reset state.
      if (currentScroll < 80) {
        scrollDelta = 0; // Reset delta to prevent immediate hide on scroll down.
        if (bannerHidden) {
            console.log("Top of page reached. Forcing nav to show.");
            bannerHidden = false;
            gsap.to(navwrap, { y: 0, duration: 0.3, ease: "power2.inOut" });
            if(filterWrapper){
                const newTop = navwrap.offsetHeight + STICKY_OFFSET;
                gsap.to(filterWrapper, { top: newTop, duration: 0.3, ease: "power2.inOut" });
            }
        }
        requestAnimationFrame(checkScroll); // Continue the loop.
        return;
      }

      // Only trigger animations if one isn't already running.
      if (!isAnimating) {
        // --- HIDE LOGIC ---
        // Conditions: Scrolling DOWN, the banner is NOT already hidden, and the scroll delta has passed the threshold.
        if (direction === "down" && !bannerHidden && scrollDelta > threshold) {
          console.log("Hiding nav: Scroll down threshold reached.");
          isAnimating = true;
          
          if(filterWrapper){
              const topWhenHidden = (navwrap.offsetHeight - getBannerHeight()) + STICKY_OFFSET;
              gsap.to(filterWrapper, { top: topWhenHidden, duration: 0.3, ease: "power2.inOut" });
          }

          gsap.to(navwrap, {
            y: -getBannerHeight(),
            duration: 0.3,
            ease: "power2.inOut",
            onComplete: () => {
              bannerHidden = true;
              isAnimating = false;
              scrollDelta = 0; // Reset for the next action.
              requestAnimationFrame(checkScroll);
            },
          });
          return; // Exit to prevent conflicting checks in the same frame.
        }

        // --- SHOW LOGIC ---
        // Conditions: Scrolling UP, the banner IS hidden, and the scroll delta has passed the threshold.
        if (direction === "up" && bannerHidden && scrollDelta > threshold) {
          console.log("Showing nav: Scroll up threshold reached.");
          isAnimating = true;

          if(filterWrapper){
              const topWhenVisible = navwrap.offsetHeight + STICKY_OFFSET;
              gsap.to(filterWrapper, { top: topWhenVisible, duration: 0.3, ease: "power2.inOut" });
          }

          gsap.to(navwrap, {
            y: 0,
            duration: 0.3,
            ease: "power2.inOut",
            onComplete: () => {
              bannerHidden = false;
              isAnimating = false;
              scrollDelta = 0; // Reset for the next action.
              requestAnimationFrame(checkScroll);
            },
          });
          return; // Exit to prevent conflicting checks in the same frame.
        }
      }
      requestAnimationFrame(checkScroll); // Continue the loop if no actions were taken.
    }

    requestAnimationFrame(checkScroll); // Start the main loop.

    // Use a small timeout for the initial positioning to ensure the browser has calculated the final layout.
    setTimeout(updatePositions, 500);

    // Update positions on window resize, but debounce it for performance.
    const debouncedUpdate = debounce(updatePositions, 250);
    window.addEventListener('resize', debouncedUpdate);
  }

  // --- Event Listeners to initialize the script on page load and on Webflow's page changes ---
  initNavScroll();
  document.addEventListener("wfPageView", function() {
    isInitialized = false; // Reset the flag for the new page.
    initNavScroll();
  });
});
