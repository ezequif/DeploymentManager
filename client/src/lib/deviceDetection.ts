// Device detection utility for handling different devices like TC70

export function isTC70() {
  if (typeof window === 'undefined') return false;
  
  // TC70 devices typically have a specific user agent string
  const userAgent = navigator.userAgent.toLowerCase();
  
  // TC70 uses Android browser with specific Zebra/Motorola/Symbol identifiers
  return (
    userAgent.includes('android') && 
    (userAgent.includes('zebra') || 
     userAgent.includes('motorola') || 
     userAgent.includes('symbol') ||
     userAgent.includes('tc70'))
  );
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