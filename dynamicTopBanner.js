<script>
Webflow.push(function () {
  // GSAP Powered sticky top-of-the-page dynamic banner and hide on scroll down, show on scroll up.
  // This script now also controls a secondary sticky element: #sticky-filter-wrapper

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

    const banner = document.getElementById("top-banner");
    const navwrap = document.getElementById("nav-wrap");
    const pageContent = document.querySelector(".page_wrapper");
    // --- NEW: Get the sticky filter element ---
    const filterWrapper = document.getElementById("sticky-filter-wrapper");

    // --- UPDATED: Check for all required elements ---
    if (!banner || !navwrap || !pageContent || !filterWrapper) {
      console.warn("Aborting script: One or more required elements were not found. (Requires: #top-banner, #nav-wrap, .page_wrapper, #sticky-filter-wrapper)");
      return;
    }

    isInitialized = true;
    console.log("Sticky nav & filter script initialized.");

    // This variable will hold the calculated 'top' value for the filter
    let filterStickyTopValue; 
    const STICKY_OFFSET = 32; // This is your desired 2rem/32px gap

    // --- UPDATED: This function now also positions the sticky filter ---
    function updatePageAndFilterPositions() {
      const navWrapHeight = navwrap.offsetHeight;
      const bannerHeight = banner.offsetHeight;

      // 1. Update page content padding (existing logic)
      pageContent.style.paddingTop = `${navWrapHeight}px`;
      
      // 2. --- NEW: Calculate and set the filter's sticky top position ---
      // This is the position when the banner IS visible.
      filterStickyTopValue = navWrapHeight + STICKY_OFFSET;
      filterWrapper.style.top = `${filterStickyTopValue}px`;

      console.log(`Page padding set to: ${navWrapHeight}px | Filter sticky top set to: ${filterStickyTopValue}px`);
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
        // --- NEW: Ensure filter is in the correct state at the top of the page ---
        if (bannerHidden) {
            bannerHidden = false;
            gsap.to(navwrap, { y: 0, duration: 0.3, ease: "power2.inOut" });
            const newTop = navwrap.offsetHeight + STICKY_OFFSET;
            gsap.to(filterWrapper, { top: newTop, duration: 0.3, ease: "power2.inOut" });
        }
        requestAnimationFrame(checkScroll);
        return;
      }
      if (!isAnimating) {
        if (direction === "down" && !bannerHidden && scrollDelta > threshold) {
          isAnimating = true;
          
          // --- NEW: Calculate the filter's new top position when banner is hidden ---
          const topWhenHidden = (navwrap.offsetHeight - getBannerHeight()) + STICKY_OFFSET;
          
          // --- UPDATED: Animate filter top position IN SYNC with nav animation ---
          gsap.to(filterWrapper, { top: topWhenHidden, duration: 0.3, ease: "power2.inOut" });
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

          // --- NEW: Calculate the filter's new top position when banner is visible ---
          const topWhenVisible = navwrap.offsetHeight + STICKY_OFFSET;

          // --- UPDATED: Animate filter top position IN SYNC with nav animation ---
          gsap.to(filterWrapper, { top: topWhenVisible, duration: 0.3, ease: "power2.inOut" });
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

    // Use a small timeout for the initial positioning to ensure layout is settled
    setTimeout(updatePageAndFilterPositions, 100);

    const debouncedUpdate = debounce(updatePageAndFilterPositions, 250);
    window.addEventListener('resize', debouncedUpdate);
  }

  // --- Simplified Event Listeners ---
  initNavScroll();
  document.addEventListener("wfPageView", function() {
    isInitialized = false;
    initNavScroll();
  });
});
</script>
