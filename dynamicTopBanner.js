Webflow.push(function () {
  // GSAP Powered sticky top-of-the-page dynamic banner and hide on scroll down, show on scroll up.
  // This script now also controls an OPTIONAL secondary sticky element: #sticky-filter-wrapper
  // VERSION: 3.1 (All console messages controlled by external debugger)

  let isInitialized = false;

  // The 'debounce' function is loaded from your separate 'utils.js' script.

  function initNavScroll() {
    if (isInitialized) return;

    // Check for debug mode using the centralized utility function.
    const isDebugMode = window.siteUtils && window.siteUtils.isDebugMode();
    
    // --- Get CORE elements required on every page ---
    const banner = document.getElementById("top-banner");
    const navwrap = document.getElementById("nav-wrap");
    const pageWrapper = document.querySelector(".page_wrapper");

    // Abort if the absolute core elements are missing.
    if (!banner || !navwrap || !pageWrapper) {
      if (isDebugMode) {
        console.warn("Aborting script: Core elements were not found. (Requires: #top-banner, #nav-wrap, .page_wrapper)");
      }
      return;
    }

    const filterWrapper = document.getElementById("sticky-filter-wrapper");

    isInitialized = true;

    if (isDebugMode) {
      console.log("Sticky nav script initialized. Page will snap into position on load.");
      if(filterWrapper) {
          console.log("Optional sticky filter element found and is being controlled.");
      }
    }

    const STICKY_OFFSET = 32;

    // This function now instantly sets all positions.
    function updatePositions() {
      const navWrapHeight = navwrap.offsetHeight;

      // Instantly set the filter's sticky top position if it exists.
      if (filterWrapper) {
          const filterStickyTopValue = navWrapHeight + STICKY_OFFSET;
          filterWrapper.style.top = `${filterStickyTopValue}px`;
      }

      // Instantly set padding on the wrapper to reserve space.
      pageWrapper.style.paddingTop = `${navWrapHeight}px`;
    }

    // --- State Variables ---
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

    // The main function that runs on every animation frame to check scroll position.
    function checkScroll() {
      const currentScroll = window.pageYOffset;
      const direction = currentScroll > lastScroll ? "down" : "up";

      if (Math.abs(currentScroll - lastScroll) < 5) {
        requestAnimationFrame(checkScroll);
        return;
      }

      if (direction !== lastDirection) {
        scrollDelta = 0;
        lastDirection = direction;
      }

      scrollDelta += Math.abs(currentScroll - lastScroll);
      lastScroll = currentScroll;

      if (currentScroll < 80) {
        scrollDelta = 0;
        if (bannerHidden) {
            bannerHidden = false;
            gsap.to(navwrap, { y: 0, duration: 0.3, ease: "power2.inOut", force3D: true });
            if(filterWrapper){
                const newTop = navwrap.offsetHeight + STICKY_OFFSET;
                gsap.to(filterWrapper, { top: newTop, duration: 0.3, ease: "power2.inOut" });
            }
        }
        requestAnimationFrame(checkScroll);
        return;
      }

      if (!isAnimating) {
        if (direction === "down" && !bannerHidden && scrollDelta > threshold) {
          isAnimating = true;
          
          if(filterWrapper){
              const topWhenHidden = (navwrap.offsetHeight - getBannerHeight()) + STICKY_OFFSET;
              gsap.to(filterWrapper, { top: topWhenHidden, duration: 0.3, ease: "power2.inOut" });
          }

          gsap.to(navwrap, {
            y: -getBannerHeight(),
            duration: 0.3,
            ease: "power2.inOut",
            force3D: true,
            onComplete: () => {
              bannerHidden = true;
              isAnimating = false;
              scrollDelta = 0;
              requestAnimationFrame(checkScroll);
            },
          });
          return;
        }

        if (direction === "up" && bannerHidden && scrollDelta > threshold) {
          isAnimating = true;

          if(filterWrapper){
              const topWhenVisible = navwrap.offsetHeight + STICKY_OFFSET;
              gsap.to(filterWrapper, { top: topWhenVisible, duration: 0.3, ease: "power2.inOut" });
          }

          gsap.to(navwrap, {
            y: 0,
            duration: 0.3,
            ease: "power2.inOut",
            force3D: true,
            onComplete: () => {
              bannerHidden = false;
              isAnimating = false;
              scrollDelta = 0;
              requestAnimationFrame(checkScroll);
            },
          });
          return;
        }
      }
      requestAnimationFrame(checkScroll);
    }

    requestAnimationFrame(checkScroll);

    // Use a small timeout for the initial positioning to ensure the browser has calculated the final layout.
    setTimeout(updatePositions, 100);

    // Call the debounce function from the shared utility library.
    const debouncedUpdate = window.siteUtils.debounce(updatePositions, 250);
    window.addEventListener('resize', debouncedUpdate);
  }

  // --- Event Listeners to initialize the script on page load and on Webflow's page changes ---
  initNavScroll();
  document.addEventListener("wfPageView", function() {
    isInitialized = false;
    initNavScroll();
  });
});
