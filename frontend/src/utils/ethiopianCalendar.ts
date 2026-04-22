// Ethiopian Calendar Utility Functions for Frontend
// This is a TypeScript version of the backend Ethiopian calendar utilities

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

export interface EthiopianDate {
  year: number;
  month: number;
  day: number;
}

export interface AcademicYearOption {
  value: string;
  label: string;
  year: number;
  calendar: 'gregorian' | 'ethiopian';
}

export interface AcademicYearOptions {
  gregorian: AcademicYearOption[];
  ethiopian: AcademicYearOption[];
  combined: AcademicYearOption[];
  calendarSystem: 'gregorian' | 'ethiopian' | 'both';
  primaryCalendar: 'gregorian' | 'ethiopian';
  enableConversion: boolean;
}

/**
 * Check if Ethiopian year is leap year
 */
export function isEthiopianLeapYear(ethYear: number): boolean {
  return (ethYear % 4) === 3;
}

/**
 * Convert Gregorian date to Ethiopian date
 */
export function gregorianToEthiopian(gregorianDate: Date): EthiopianDate {
  const year = gregorianDate.getFullYear();
  const month = gregorianDate.getMonth() + 1; // JS months are 0-indexed
  const day = gregorianDate.getDate();
  
  // Ethiopian new year starts on September 11 (or 12 in leap years)
  let ethYear: number;
  
  if (month < 9 || (month === 9 && day < 11)) {
    // Before Ethiopian new year
    ethYear = year - 8;
  } else {
    // After Ethiopian new year
    ethYear = year - 7;
  }
  
  // Simplified conversion (for academic year purposes)
  const dayOfYear = getDayOfYear(gregorianDate);
  const ethNewYearDay = isLeapYear(year) ? 255 : 254; // Sept 11 or 12
  
  let ethDayOfYear: number;
  if (dayOfYear >= ethNewYearDay) {
    ethDayOfYear = dayOfYear - ethNewYearDay + 1;
  } else {
    ethDayOfYear = dayOfYear + (365 - ethNewYearDay) + 1;
  }
  
  // Convert day of year to Ethiopian month and day
  let ethMonth = Math.floor((ethDayOfYear - 1) / 30) + 1;
  let ethDay = ((ethDayOfYear - 1) % 30) + 1;
  
  // Handle 13th month (Pagumen)
  if (ethMonth > 12) {
    ethMonth = 13;
    ethDay = ethDayOfYear - 360; // 12 months * 30 days
  }
  
  return { year: ethYear, month: ethMonth, day: ethDay };
}

/**
 * Convert Ethiopian date to Gregorian date
 */
export function ethiopianToGregorian(ethYear: number, ethMonth: number, ethDay: number): Date {
  // Simplified conversion
  const gregYear = ethYear + 7; // Approximate
  
  // Ethiopian new year is around September 11
  let dayOfYear: number;
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
 */
export function getEthiopianAcademicYear(ethYear: number): string {
  return `${ethYear}-${ethYear + 1} E.C.`;
}

/**
 * Generate Gregorian academic year string
 */
export function getGregorianAcademicYear(gregYear: number): string {
  return `${gregYear}-${gregYear + 1}`;
}

/**
 * Get current Ethiopian year
 */
export function getCurrentEthiopianYear(): number {
  const now = new Date();
  const ethDate = gregorianToEthiopian(now);
  return ethDate.year;
}

/**
 * Get current Gregorian academic year
 */
export function getCurrentGregorianAcademicYear(): number {
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
 * Convert between calendar systems for academic years
 */
export function convertAcademicYear(
  academicYear: string, 
  fromCalendar: 'gregorian' | 'ethiopian', 
  toCalendar: 'gregorian' | 'ethiopian'
): string {
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

/**
 * Fetch academic year options from backend
 */
export async function fetchAcademicYearOptions(
  yearsBack: number = 5, 
  yearsForward: number = 3
): Promise<AcademicYearOptions> {
  try {
    const response = await fetch(`/api/config/academic-years?yearsBack=${yearsBack}&yearsForward=${yearsForward}`);
    if (response.ok) {
      return await response.json();
    }
    throw new Error('Failed to fetch academic years');
  } catch (error) {
    console.warn('Failed to fetch academic years from backend, generating locally:', error);
    return generateLocalAcademicYearOptions(yearsBack, yearsForward);
  }
}

/**
 * Generate academic year options locally (fallback)
 */
export function generateLocalAcademicYearOptions(
  yearsBack: number = 5, 
  yearsForward: number = 3
): AcademicYearOptions {
  const currentGregYear = getCurrentGregorianAcademicYear();
  const currentEthYear = getCurrentEthiopianYear();
  
  const gregorianYears: AcademicYearOption[] = [];
  const ethiopianYears: AcademicYearOption[] = [];
  
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
  
  const combined = [...gregorianYears, ...ethiopianYears].sort((a, b) => {
    // Sort by actual year value for mixed display
    const aYear = a.calendar === 'gregorian' ? a.year : a.year + 7;
    const bYear = b.calendar === 'gregorian' ? b.year : b.year + 7;
    return aYear - bYear;
  });
  
  return {
    gregorian: gregorianYears,
    ethiopian: ethiopianYears,
    combined,
    calendarSystem: 'both',
    primaryCalendar: 'gregorian',
    enableConversion: true
  };
}

/**
 * Format academic year for display with calendar indicator
 */
export function formatAcademicYearDisplay(
  academicYear: string, 
  calendar: 'gregorian' | 'ethiopian',
  showCalendarType: boolean = true
): string {
  if (!showCalendarType) return academicYear;
  
  if (calendar === 'ethiopian') {
    return academicYear; // Already includes "E.C."
  } else {
    return `${academicYear} G.C.`; // Add Gregorian Calendar indicator
  }
}

// Helper functions
function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function dayOfYearToDate(year: number, dayOfYear: number): Date {
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
  convertAcademicYear,
  fetchAcademicYearOptions,
  generateLocalAcademicYearOptions,
  formatAcademicYearDisplay
};