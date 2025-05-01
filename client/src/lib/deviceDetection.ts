// Device detection utility for handling different devices like TC70

export function isTC70() {
  if (typeof window === 'undefined') return false;
  
  // TC70 devices typically have a specific user agent string
  const userAgent = navigator.userAgent.toLowerCase();
  
  // The first thing we'll check is if the URL has a special flag for testing
  // This allows bypassing detection for development and testing
  if (window.location.search.includes('device=tc70')) {
    return true;
  }
  
  // ONLY identify TC70 devices by model identifiers in user agent
  // DO NOT use screen size or other heuristics as they can misidentify tablets
  
  // TC70 uses Android browser with specific Zebra/Motorola/Symbol identifiers
  const hasZebraIdentifiers = 
    userAgent.includes('zebra') || 
    userAgent.includes('motorola') || 
    userAgent.includes('symbol') ||
    userAgent.includes('tc70') ||
    userAgent.includes('tc75') ||
    userAgent.includes('tc51') ||
    userAgent.includes('tc56') ||
    userAgent.includes('mc') ||
    userAgent.includes('tc');
  
  // Log detection for debugging
  if (hasZebraIdentifiers) {
    console.log("Detected TC70/Zebra device via user agent:", userAgent);
  }
  
  // Return based ONLY on explicit model identification
  return hasZebraIdentifiers;
}

export function isLowPowerDevice() {
  // Check if we're on a mobile device or TC70
  return isTC70() || /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent);
}

// Check if the current device is a mobile device or tablet
export function isMobileOrTablet() {
  // Multiple detection methods for more accurate results
  
  // 1. User agent detection
  const userAgentCheck = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet|android|touch/i.test(navigator.userAgent);
  
  // 2. Screen size check - most tablets/phones have smaller screens
  const screenSizeCheck = window.innerWidth <= 1024 || window.innerHeight <= 1024;
  
  // 3. Touch capability check
  const touchCheck = ('ontouchstart' in window) || 
                     (navigator.maxTouchPoints > 0) || 
                     // @ts-ignore - Some browsers have this property
                     (navigator.msMaxTouchPoints > 0);
  
  // 4. Platform check (iOS/Android)
  const platformCheck = /android|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent);
  
  // Combine checks for better accuracy
  // If both user agent and at least one other check are positive, it's likely a mobile/tablet device
  return userAgentCheck && (screenSizeCheck || touchCheck || platformCheck);
}

// Feature detection
export function hasWebSocketSupport() {
  return typeof WebSocket !== 'undefined';
}

// Get browser information for debugging
export function getBrowserInfo() {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    vendor: navigator.vendor,
    isTC70: isTC70(),
    isLowPower: isLowPowerDevice(),
    hasWebSocket: hasWebSocketSupport()
  };
}