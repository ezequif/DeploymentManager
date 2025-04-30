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
  
  // Some TC70 devices don't identify themselves properly in user agent
  // They often have outdated Android and WebView versions
  
  // TC70 uses Android browser with specific Zebra/Motorola/Symbol identifiers
  const hasZebraIdentifiers = 
    userAgent.includes('zebra') || 
    userAgent.includes('motorola') || 
    userAgent.includes('symbol') ||
    userAgent.includes('tc70');
    
  // Or check for potentially old Android WebView that could be a TC70
  const isOlderAndroid = 
    userAgent.includes('android') && 
    (userAgent.includes('android 4') || 
     userAgent.includes('android 5') ||
     userAgent.includes('android 6'));
     
  // TC70 devices have poor GPU and limited memory
  // We can't check hardware directly but can infer
  const hasLimitedPerformance = (() => {
    try {
      // Check window size - TC70s are usually small-screen devices
      const isSmallScreen = window.innerWidth < 600;
      
      // Check if deviceMemory API is available (not on TC70s)
      const hasMemoryAPI = 'deviceMemory' in navigator;
      
      return isSmallScreen && !hasMemoryAPI;
    } catch (e) {
      // On error, better to assume it might be a low-power device
      return true;
    }
  })();
    
  return hasZebraIdentifiers || (isOlderAndroid && hasLimitedPerformance);
}

export function isLowPowerDevice() {
  // Check if we're on a mobile device or TC70
  return isTC70() || /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent);
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