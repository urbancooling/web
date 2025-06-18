Webflow.push(function () {
  // GSAP Powered sticky top-of-the-page dynamic banner and hide on scroll down, show on scroll up.
  // This script now also controls an OPTIONAL secondary sticky element: #sticky-filter-wrapper
  // VERSION: 2.1 (Smooth initial load animation)

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
    const isDebugMode = false; // Set to 'true' to show the live debug panel.
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
    
    const filterWrapper = document.getElementById("sticky-filter-wrapper");

    isInitialized = true;
    // --- NEW: Flag for initial load animation ---
    let isInitialLoad = true; 

    console.log("Sticky nav script initialized.");
    if(filterWrapper) {
        console.log("Optional sticky filter element found and is being controlled.");
    }

    if (isDebugMode) {
        console.log("Debug Mode is ON.");
        debugPanel = document.createElement('div');
        debugPanel.id = 'dynamic-debug-panel';
        debugPanel.style.cssText = 'position:fixed; bottom:10px; left:10px; background:rgba(0,0,0,0.7); color:white; padding:10px; border-radius:8px; font-family:monospace; font-size:12px; z-index:9999; line-height:1.5; pointer-events:none;';
        document.body.appendChild(debugPanel);
    }


    const STICKY_OFFSET = 32;

    // --- UPDATED: This function now animates the page into view on load ---
    function updatePositions() {
      const navWrapHeight = navwrap.offsetHeight;

      // Conditionally set the filter's sticky top position IF it exists on the page.
      if (filterWrapper) {
          const filterStickyTopValue = navWrapHeight + STICKY_OFFSET;
          filterWrapper.style.top = `${filterStickyTopValue}px`;
      }

      // On initial load, animate the padding for a smooth entry. On resize, update instantly.
      if (isInitialLoad) {
        gsap.to(pageContent, { 
            paddingTop: `${navWrapHeight}px`,
            opacity: 1, // Fade the content in
            duration: 0.6,
            ease: "power2.out" 
        });
        isInitialLoad = false; // Ensure this animation only runs once
      } else {
        // On resize, update instantly without animation for a responsive feel.
        pageContent.style.paddingTop = `${navWrapHeight}px`;
      }
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
    
    // --- NEW: Set initial state of page content for the animation ---
    // Start with the content invisible. It will be faded in by updatePositions.
    gsap.set(pageContent, { opacity: 0 });
    gsap.set(navwrap, { y: 0 });

    // The main function that runs on every animation frame to check scroll position.
    function checkScroll() {
      const currentScroll = window.pageYOffset;
      const direction = currentScroll > lastScroll ? "down" : "up";

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
            gsap.to(navwrap, { y: 0, duration: 0.3, ease: "power2.inOut" });
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

    // Update positions on window resize, but debounce it for performance.
    const debouncedUpdate = debounce(updatePositions, 250);
    window.addEventListener('resize', debouncedUpdate);
  }

  // --- Event Listeners to initialize the script on page load and on Webflow's page changes ---
  initNavScroll();
  document.addEventListener("wfPageView", function() {
    isInitialized = false;
    initNavScroll();
  });
});
