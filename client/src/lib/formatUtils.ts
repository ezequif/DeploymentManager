// Convert a date to Eastern Time Zone
function convertToEasternTime(date: Date): Date {
  // Create a date string with the timezone offset for Eastern Time (UTC-4 or UTC-5 depending on DST)
  // This is a simplification - in a production app, you might want to use a library like date-fns-tz
  const options: Intl.DateTimeFormatOptions = { 
    timeZone: 'America/New_York',
    year: 'numeric', 
    month: 'numeric', 
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  };
  
  // Format the date in Eastern Time
  const easternTimeStr = new Intl.DateTimeFormat('en-US', options).format(date);
  return new Date(easternTimeStr);
}

// Format date in MM/DD/YYYY format (Eastern Time)
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const eastern = convertToEasternTime(d);
  
  return `${(eastern.getMonth() + 1).toString().padStart(2, '0')}/${eastern.getDate().toString().padStart(2, '0')}/${eastern.getFullYear()}`;
}

// Format date and time in MM/DD/YYYY hh:mm AM/PM format (Eastern Time)
export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const eastern = convertToEasternTime(d);
  
  const hours = eastern.getHours();
  const minutes = eastern.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  
  const formattedHours = hours % 12 || 12;
  const formattedMinutes = minutes.toString().padStart(2, '0');
  
  return `${formatDate(d)} ${formattedHours}:${formattedMinutes} ${ampm} ET`;
}

// Format number to always show 1 decimal place
export function formatQuantity(quantity: number): string {
  return quantity.toFixed(1);
}

// Check if date is expiring soon (within 30 days) - uses Eastern Time
export function isExpiringSoon(expirationDate: string): boolean {
  const expDate = new Date(expirationDate);
  const today = new Date();
  
  // Convert both dates to Eastern Time
  const expDateEastern = convertToEasternTime(expDate);
  const todayEastern = convertToEasternTime(today);
  
  // Set hours, minutes, seconds to 0 for accurate day comparison
  todayEastern.setHours(0, 0, 0, 0);
  
  const diffTime = expDateEastern.getTime() - todayEastern.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays <= 30 && diffDays >= 0;
}

// Check if date is expired - uses Eastern Time
export function isExpired(expirationDate: string): boolean {
  const expDate = new Date(expirationDate);
  const today = new Date();
  
  // Convert both dates to Eastern Time
  const expDateEastern = convertToEasternTime(expDate);
  const todayEastern = convertToEasternTime(today);
  
  // Set hours, minutes, seconds to 0 for accurate day comparison
  todayEastern.setHours(0, 0, 0, 0);
  
  return expDateEastern < todayEastern;
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
 * Normalize date string to YYYY-MM-DD format for consistent storage in Eastern Time
 * This function handles timezone issues by explicitly using Eastern Time
 * to preserve the exact date chosen by the user in Eastern Time Zone.
 * 
 * @param dateString Date string in any format that JavaScript can parse (preferably YYYY-MM-DD)
 * @returns Normalized date string in YYYY-MM-DD format (Eastern Time)
 */
export function normalizeDate(dateString: string): string {
  try {
    // If it's already in YYYY-MM-DD format, parse it directly
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [year, month, day] = dateString.split('-').map(n => parseInt(n, 10));
      
      // Use the date as provided - it's already in the expected format
      // This preserves dates entered directly in the date picker
      return dateString;
    }
    
    // For other formats, convert to a Date and then to Eastern Time
    const date = new Date(dateString);
    const easternDate = convertToEasternTime(date);
    
    // Format as YYYY-MM-DD
    const year = easternDate.getFullYear();
    const month = (easternDate.getMonth() + 1).toString().padStart(2, '0');
    const day = easternDate.getDate().toString().padStart(2, '0');
    
    // Return the date in ISO format (YYYY-MM-DD) using Eastern Time values
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error("Error normalizing date:", error);
    return dateString; // Return original if something goes wrong
  }
}
