<script>
Webflow.push(function () {
  // GSAP Powered sticky top-of-the-page dynamic banner and hide on scroll down, show on scroll up.
  // This script now also controls an OPTIONAL secondary sticky element: #sticky-filter-wrapper
  // VERSION: 2.5 (Automated Structural Isolation for Ultimate Performance)

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
    const pageWrapper = document.querySelector(".page_wrapper");

    // Abort if the absolute core elements are missing.
    if (!banner || !navwrap || !pageWrapper) {
      console.warn("Aborting script: Core elements were not found. (Requires: #top-banner, #nav-wrap, .page_wrapper)");
      return;
    }
    
    // --- NEW: AUTOMATICALLY CREATE THE ANIMATION WRAPPER ---
    // This injects the needed <div> so you don't have to edit 80+ pages.
    const pageAnimator = document.createElement('div');
    pageAnimator.id = 'page-content-animator';

    // Move all of pageWrapper's children into the new animator div.
    while (pageWrapper.firstChild) {
      pageAnimator.appendChild(pageWrapper.firstChild);
    }
    // Append the new animator, containing all the content, back into the page wrapper.
    pageWrapper.appendChild(pageAnimator);
    // The DOM structure is now optimized for animation on every page automatically.

    const filterWrapper = document.getElementById("sticky-filter-wrapper");

    isInitialized = true;
    let isInitialLoad = true; 

    console.log("Sticky nav script initialized. Animation wrapper created dynamically.");
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

    // --- UPDATED: This function now uses the dynamically created animation structure ---
    function updatePositions() {
      const navWrapHeight = navwrap.offsetHeight;

      if (filterWrapper) {
          const filterStickyTopValue = navWrapHeight + STICKY_OFFSET;
          filterWrapper.style.top = `${filterStickyTopValue}px`;
      }

      if (isInitialLoad) {
        // Step 1: Instantly set padding on the OUTER wrapper to reserve space.
        pageWrapper.style.paddingTop = `${navWrapHeight}px`;
        
        // Step 2: Instantly pull the INNER animator div up.
        gsap.set(pageAnimator, { y: -navWrapHeight });

        // Step 3: Animate the INNER animator div down.
        gsap.to(pageAnimator, { 
            y: 0, 
            duration: 0.8,
            ease: "sine.out",
            force3D: true,
            onComplete: () => {
              pageAnimator.style.willChange = 'auto';
            }
        });

        isInitialLoad = false;
      } else {
        // On resize, update padding instantly.
        pageWrapper.style.paddingTop = `${navWrapHeight}px`;
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
    
    // Prepare the new animator div for its transform.
    gsap.set(pageAnimator, { willChange: 'transform' });
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
    setTimeout(updatePositions, 200);

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
</script>
