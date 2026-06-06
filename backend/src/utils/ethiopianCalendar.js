// Ethiopian Calendar Utility Functions
// Ethiopian calendar has 13 months: 12 months of 30 days + 1 month of 5/6 days

/**
 * Ethiopian Calendar Utilities
 * Ethiopian year starts on September 11 (or 12 in leap years) in Gregorian calendar
 * Ethiopian calendar is approximately 7-8 years behind Gregorian calendar
 */

// Ethiopian month names
export const ETHIOPIAN_MONTHS = [
  'Meskerem',   // September
  'Tikimt',     // October  
  'Hidar',      // November
  'Tahsas',     // December
  'Tir',        // January
  'Yekatit',    // February
  'Megabit',    // March
  'Miazia',     // April
  'Ginbot',     // May
  'Sene',       // June
  'Hamle',      // July
  'Nehase',     // August
  'Pagumen'     // 13th month (5-6 days)
];

/**
 * Check if Ethiopian year is leap year
 * @param {number} ethYear - Ethiopian year
 * @returns {boolean}
 */
export function isEthiopianLeapYear(ethYear) {
  return (ethYear % 4) === 3;
}

/**
 * Convert Gregorian date to Ethiopian date
 * @param {Date} gregorianDate - Gregorian date
 * @returns {object} Ethiopian date {year, month, day}
 */
export function gregorianToEthiopian(gregorianDate) {
  const year = gregorianDate.getFullYear();
  const month = gregorianDate.getMonth() + 1; // JS months are 0-indexed
  const day = gregorianDate.getDate();
  
  // Ethiopian new year starts on September 11 (or 12 in leap years)
  let ethYear, ethMonth, ethDay;
  
  if (month < 9 || (month === 9 && day < 11)) {
    // Before Ethiopian new year
    ethYear = year - 8;
  } else {
    // After Ethiopian new year
    ethYear = year - 7;
  }
  
  // Simplified conversion (for academic year purposes)
  // This is an approximation - exact conversion requires more complex calculations
  const dayOfYear = getDayOfYear(gregorianDate);
  const ethNewYearDay = isLeapYear(year) ? 255 : 254; // Sept 11 or 12
  
  let ethDayOfYear;
  if (dayOfYear >= ethNewYearDay) {
    ethDayOfYear = dayOfYear - ethNewYearDay + 1;
  } else {
    ethDayOfYear = dayOfYear + (365 - ethNewYearDay) + 1;
  }
  
  // Convert day of year to Ethiopian month and day
  ethMonth = Math.floor((ethDayOfYear - 1) / 30) + 1;
  ethDay = ((ethDayOfYear - 1) % 30) + 1;
  
  // Handle 13th month (Pagumen)
  if (ethMonth > 12) {
    ethMonth = 13;
    ethDay = ethDayOfYear - 360; // 12 months * 30 days
  }
  
  return { year: ethYear, month: ethMonth, day: ethDay };
}

/**
 * Convert Ethiopian date to Gregorian date
 * @param {number} ethYear - Ethiopian year
 * @param {number} ethMonth - Ethiopian month (1-13)
 * @param {number} ethDay - Ethiopian day
 * @returns {Date} Gregorian date
 */
export function ethiopianToGregorian(ethYear, ethMonth, ethDay) {
  // Simplified conversion
  const gregYear = ethYear + 7; // Approximate
  
  // Ethiopian new year is around September 11
  let dayOfYear;
  if (ethMonth <= 12) {
    dayOfYear = (ethMonth - 1) * 30 + ethDay;
  } else {
    dayOfYear = 360 + ethDay; // 12 months + Pagumen days
  }
  
  // Add to Ethiopian new year start
  const ethNewYearDay = isLeapYear(gregYear) ? 255 : 254;
  let gregDayOfYear = ethNewYearDay + dayOfYear - 1;
  
  // Handle year overflow
  const daysInGregYear = isLeapYear(gregYear) ? 366 : 365;
  if (gregDayOfYear > daysInGregYear) {
    gregDayOfYear -= daysInGregYear;
    return dayOfYearToDate(gregYear + 1, gregDayOfYear);
  }
  
  return dayOfYearToDate(gregYear, gregDayOfYear);
}

/**
 * Generate Ethiopian academic year string
 * @param {number} ethYear - Ethiopian year
 * @returns {string} Academic year string (e.g., "2018 E.C.")
 */
export function getEthiopianAcademicYear(ethYear) {
  return `${ethYear} E.C.`;
}

/**
 * Generate Gregorian academic year string
 * @param {number} gregYear - Gregorian year
 * @returns {string} Academic year string (e.g., "2025-2026")
 */
export function getGregorianAcademicYear(gregYear) {
  return `${gregYear}-${gregYear + 1}`;
}

/**
 * Get current Ethiopian year
 * @returns {number} Current Ethiopian year
 */
export function getCurrentEthiopianYear() {
  const now = new Date();
  const ethDate = gregorianToEthiopian(now);
  return ethDate.year;
}

/**
 * Get current Gregorian academic year
 * @returns {number} Current Gregorian academic year start
 */
export function getCurrentGregorianAcademicYear() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  
  // Academic year typically starts in September
  if (month >= 9) {
    return year;
  } else {
    return year - 1;
  }
}

/**
 * Generate academic year options for both calendars
 * @param {number} yearsBack - How many years back to include
 * @param {number} yearsForward - How many years forward to include
 * @returns {object} Object with gregorian and ethiopian year arrays
 */
export function generateAcademicYearOptions(yearsBack = 5, yearsForward = 3) {
  const currentGregYear = getCurrentGregorianAcademicYear();
  const currentEthYear = getCurrentEthiopianYear();
  
  const gregorianYears = [];
  const ethiopianYears = [];
  
  // Generate Gregorian years
  for (let i = -yearsBack; i <= yearsForward; i++) {
    const year = currentGregYear + i;
    gregorianYears.push({
      value: getGregorianAcademicYear(year),
      label: getGregorianAcademicYear(year),
      year: year,
      calendar: 'gregorian'
    });
  }
  
  // Generate Ethiopian years
  for (let i = -yearsBack; i <= yearsForward; i++) {
    const year = currentEthYear + i;
    ethiopianYears.push({
      value: getEthiopianAcademicYear(year),
      label: getEthiopianAcademicYear(year),
      year: year,
      calendar: 'ethiopian'
    });
  }
  
  return {
    gregorian: gregorianYears,
    ethiopian: ethiopianYears,
    combined: [...gregorianYears, ...ethiopianYears].sort((a, b) => {
      // Sort by actual year value for mixed display
      const aYear = a.calendar === 'gregorian' ? a.year : a.year + 7;
      const bYear = b.calendar === 'gregorian' ? b.year : b.year + 7;
      return aYear - bYear;
    })
  };
}

/**
 * Convert between calendar systems for academic years
 * @param {string} academicYear - Academic year string
 * @param {string} fromCalendar - Source calendar ('gregorian' or 'ethiopian')
 * @param {string} toCalendar - Target calendar ('gregorian' or 'ethiopian')
 * @returns {string} Converted academic year string
 */
export function convertAcademicYear(academicYear, fromCalendar, toCalendar) {
  if (fromCalendar === toCalendar) return academicYear;
  
  if (fromCalendar === 'gregorian' && toCalendar === 'ethiopian') {
    const year = parseInt(academicYear.split('-')[0]);
    const ethYear = year - 7; // Approximate conversion
    return getEthiopianAcademicYear(ethYear);
  } else if (fromCalendar === 'ethiopian' && toCalendar === 'gregorian') {
    const year = parseInt(academicYear.split('-')[0]);
    const gregYear = year + 7; // Approximate conversion
    return getGregorianAcademicYear(gregYear);
  }
  
  return academicYear;
}

// Helper functions
function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

function getDayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function dayOfYearToDate(year, dayOfYear) {
  const date = new Date(year, 0, dayOfYear);
  return date;
}

export default {
  ETHIOPIAN_MONTHS,
  isEthiopianLeapYear,
  gregorianToEthiopian,
  ethiopianToGregorian,
  getEthiopianAcademicYear,
  getGregorianAcademicYear,
  getCurrentEthiopianYear,
  getCurrentGregorianAcademicYear,
  generateAcademicYearOptions,
  convertAcademicYear
};