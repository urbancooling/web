// --- utils.js ---
// Make a container on the window object for our site-wide functions
window.siteUtils = window.siteUtils || {};

// Shared debounce function
window.siteUtils.debounce = function(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Shared Debug Mode checker
window.siteUtils.isDebugMode = function() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('dbug') === 'true';
};

// You can add more utilities here in the future
