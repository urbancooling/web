Webflow.push(function () {
  // GSAP Powered sticky top-of-the-page dynamic banner and hide on scroll down, show on scroll up.
  // This script now also controls an OPTIONAL secondary sticky element: #sticky-filter-wrapper
  // VERSION: 2.9 (Refactored to use external utils.js library)

  let isInitialized = false;

  function initNavScroll() {
    if (isInitialized) return;

    // ---!! DYNAMIC DEBUGGING CONTROL !!---
    const isDebugMode = window.siteUtils.isDebugMode(); // This will now check for ?debug=true

    // The 'debugPanel' variable and its creation/update logic are no longer needed
    // as the GSAP Debugger now handles the universal display.

    // --- Get CORE elements required on every page ---
    const banner = document.getElementById("top-banner");
    const navwrap = document.getElementById("nav-wrap");
    const pageWrapper = document.querySelector(".page_wrapper");

    if (!banner || !navwrap || !pageWrapper) {
      console.warn("Aborting script: Core elements were not found. (Requires: #top-banner, #nav-wrap, .page_wrapper)");
      return;
    }

    const filterWrapper = document.getElementById("sticky-filter-wrapper");

    isInitialized = true;

    console.log("Sticky nav script initialized. Page will snap into position on load.");
    if(filterWrapper) {
        console.log("Optional sticky filter element found and is being controlled.");
    }

    if (isDebugMode) {
        console.log("Debug Mode is ON (activated by URL parameter).");
        // No debugPanel creation here anymore. The GSAP debugger handles that.
    }

    const STICKY_OFFSET = 32;

    function updatePositions() {
      const navWrapHeight = navwrap.offsetHeight;
      if (filterWrapper) {
          const filterStickyTopValue = navWrapHeight + STICKY_OFFSET;
          filterWrapper.style.top = `${filterStickyTopValue}px`;
      }
      pageWrapper.style.paddingTop = `${navWrapHeight}px`;
    }

    let bannerHidden = false;
    let isAnimating = false;
    let scrollDelta = 0;
    let lastScroll = window.pageYOffset;
    let lastDirection = null;
    const threshold = 200;

    function getBannerHeight() {
      return banner.getBoundingClientRect().height;
    }

    gsap.set(navwrap, { y: 0 });

    function checkScroll() {
      const currentScroll = window.pageYOffset;
      const direction = currentScroll > lastScroll ? "down" : "up";

      // REMOVE THIS BLOCK (or comment out) if you want the GSAP Debugger to be your sole debug panel
      // if (isDebugMode && debugPanel) {
      //   debugPanel.innerHTML = `
      //     <strong>-- Live Debug --</strong><br>
      //     Scroll Position: ${Math.round(currentScroll)}px<br>
      //     Direction: ${direction.toUpperCase()}<br>
      //     Scroll Delta: ${Math.round(scrollDelta)}px / ${threshold}px<br>
      //     Banner Hidden: ${bannerHidden}<br>
      //     Animating: ${isAnimating}
      //   `;
      // }

      if (Math.abs(currentScroll - lastScroll) < 5) {
        requestAnimationFrame(checkScroll);
        return;
      }
      // ... (rest of checkScroll logic remains unchanged)
      requestAnimationFrame(checkScroll);
    }

    requestAnimationFrame(checkScroll);
    setTimeout(updatePositions, 100);
    const debouncedUpdate = window.siteUtils.debounce(updatePositions, 250);
    window.addEventListener('resize', debouncedUpdate);
  }

  initNavScroll();
  document.addEventListener("wfPageView", function() {
    isInitialized = false;
    initNavScroll();
  });
});
