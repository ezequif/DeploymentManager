// Format date in MM/DD/YYYY format
// This displays exactly what the user sees, with no timezone shifting
export function formatDate(date: string | Date): string {
  // If date is a string in YYYY-MM-DD format (like from database), parse it directly
  if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = date.split('-').map(Number);
    return `${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}/${year}`;
  }
  
  // For other dates, use the standard JavaScript Date formatting
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}/${d.getFullYear()}`;
}

// Format date and time in MM/DD/YYYY hh:mm AM/PM format
export function formatDateTime(date: string | Date): string {
  // If date is a string in ISO format from the database, parse it directly
  const d = typeof date === 'string' ? new Date(date) : date;
  
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/New_York'
  };
  
  // Format the date with Eastern Time zone
  const formatted = new Intl.DateTimeFormat('en-US', options).format(d);
  return `${formatted} ET`;
}

// Format number to always show 1 decimal place
export function formatQuantity(quantity: number): string {
  return quantity.toFixed(1);
}

// Constants for weight conversion
const LBS_TO_KGS_RATIO = 0.45359237; // 1 pound = 0.45359237 kilograms
const KGS_TO_LBS_RATIO = 2.2046226218; // 1 kilogram = 2.2046226218 pounds

/**
 * Convert weight between LBS and KGS
 * @param value The weight value to convert
 * @param fromUnit The unit to convert from ('LBS' or 'KGS')
 * @param toUnit The unit to convert to ('LBS' or 'KGS')
 * @returns The converted weight value
 */
export function convertWeight(value: number, fromUnit: 'LBS' | 'KGS', toUnit: 'LBS' | 'KGS'): number {
  // If units are the same, return the value unchanged
  if (fromUnit === toUnit) return value;
  
  // Convert based on the direction
  if (fromUnit === 'LBS' && toUnit === 'KGS') {
    return value * LBS_TO_KGS_RATIO;
  } else if (fromUnit === 'KGS' && toUnit === 'LBS') {
    return value * KGS_TO_LBS_RATIO;
  }
  
  // Fallback (should never reach here)
  return value;
}

/**
 * Format a weight value with its unit for display
 * @param value The weight value
 * @param unit The unit ('LBS' or 'KGS')
 * @returns Formatted string (e.g., "10.5 KGS")
 */
export function formatWeightWithUnit(value: number, unit: 'LBS' | 'KGS'): string {
  return `${formatQuantity(value)} ${unit}`;
}

// Helper function to convert date to Eastern Time for comparison
function getEasternDateParts(date: Date): {year: number, month: number, day: number} {
  const options: Intl.DateTimeFormatOptions = { 
    timeZone: 'America/New_York',
    year: 'numeric', 
    month: 'numeric', 
    day: 'numeric'
  };
  
  // Format date in Eastern Time
  const [month, day, year] = new Intl.DateTimeFormat('en-US', options)
    .format(date)
    .split('/')
    .map(Number);
    
  return { year, month, day };
}

// Check if date is expiring soon (within 30 days) using Eastern Time
export function isExpiringSoon(expirationDate: string): boolean {
  // If the expiration date is in YYYY-MM-DD format (from database)
  if (expirationDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [expYear, expMonth, expDay] = expirationDate.split('-').map(Number);
    
    // Get today in Eastern Time
    const today = new Date();
    const { year: todayYear, month: todayMonth, day: todayDay } = getEasternDateParts(today);
    
    // Create Date objects for comparison (use noon to avoid time issues)
    const expDateObj = new Date(expYear, expMonth - 1, expDay, 12, 0, 0);
    const todayObj = new Date(todayYear, todayMonth - 1, todayDay, 12, 0, 0);
    
    // Calculate difference in days
    const diffTime = expDateObj.getTime() - todayObj.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays <= 30 && diffDays >= 0;
  }
  
  // Fallback for other date formats
  return false;
}

// Check if date is expired using Eastern Time
export function isExpired(expirationDate: string): boolean {
  // If the expiration date is in YYYY-MM-DD format (from database)
  if (expirationDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [expYear, expMonth, expDay] = expirationDate.split('-').map(Number);
    
    // Get today in Eastern Time
    const today = new Date();
    const { year: todayYear, month: todayMonth, day: todayDay } = getEasternDateParts(today);
    
    // Create Date objects for comparison (use noon to avoid time issues)
    const expDateObj = new Date(expYear, expMonth - 1, expDay, 12, 0, 0);
    const todayObj = new Date(todayYear, todayMonth - 1, todayDay, 12, 0, 0);
    
    return expDateObj < todayObj;
  }
  
  // Fallback for other date formats
  return false;
}

// Format elapsed time for last sync
export function formatElapsedTime(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) {
    return "Just now";
  } else if (seconds < 120) {
    return "1 minute ago";
  } else if (seconds < 3600) {
    return `${Math.floor(seconds / 60)} minutes ago`;
  } else if (seconds < 7200) {
    return "1 hour ago";
  } else if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)} hours ago`;
  } else {
    return `${Math.floor(seconds / 86400)} days ago`;
  }
}

/**
 * Normalize date string to YYYY-MM-DD format for consistent storage
 * This function preserves the date as entered by the user 
 * without any timezone transformations.
 * 
 * @param dateString Date string in any format that JavaScript can parse (preferably YYYY-MM-DD)
 * @returns Normalized date string in YYYY-MM-DD format
 */
export function normalizeDate(dateString: string): string {
  try {
    // If it's already in YYYY-MM-DD format, return it as-is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }
    
    // For other formats, use the getEasternDateParts helper
    const date = new Date(dateString);
    const { year, month, day } = getEasternDateParts(date);
    
    // Format as YYYY-MM-DD
    const monthStr = month.toString().padStart(2, '0');
    const dayStr = day.toString().padStart(2, '0');
    
    // Return the date in ISO format (YYYY-MM-DD)
    return `${year}-${monthStr}-${dayStr}`;
  } catch (error) {
    console.error("Error normalizing date:", error);
    return dateString; // Return original if something goes wrong
  }
}
