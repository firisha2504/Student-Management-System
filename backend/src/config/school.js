// School Configuration System
// This file centralizes all school-specific settings

export const SCHOOL_CONFIG = {
  // School Identity
  school: {
    name: process.env.SCHOOL_NAME || 'Melka Jebdu',
    shortName: process.env.SCHOOL_SHORT_NAME || 'MJ',
    logo: process.env.SCHOOL_LOGO_PATH || '/uploads/logo/school-logo.jpg',
    email: process.env.SCHOOL_EMAIL || 'admin@school.com',
    website: process.env.SCHOOL_WEBSITE || '',
    address: process.env.SCHOOL_ADDRESS || '',
    phone: process.env.SCHOOL_PHONE || ''
  },

  // Academic Structure
  academic: {
    gradeLevels: process.env.GRADE_LEVELS ? 
      process.env.GRADE_LEVELS.split(',').map(g => parseInt(g.trim())) : 
      [9, 10, 11, 12],
    
    streams: process.env.STREAMS ? 
      process.env.STREAMS.split(',').map(s => s.trim()) : 
      ['natural', 'social'],
    
    sections: process.env.SECTIONS ? 
      process.env.SECTIONS.split(',').map(s => s.trim()) : 
      ['oromo', 'amharic', 'somali'],
    
    subSections: process.env.SUB_SECTIONS ? 
      process.env.SUB_SECTIONS.split(',').map(s => s.trim()) : 
      ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
    
    terms: process.env.TERMS ? 
      process.env.TERMS.split(',').map(t => t.trim()) : 
      ['Semester 1', 'Semester 2'],
    
    currentYear: process.env.CURRENT_ACADEMIC_YEAR || '2018 E.C.',
    currentTerm: process.env.CURRENT_TERM || 'Semester 1',
    
    // Calendar System Configuration
    calendarSystem: process.env.CALENDAR_SYSTEM || 'ethiopian', // 'gregorian', 'ethiopian', 'both'
    primaryCalendar: process.env.PRIMARY_CALENDAR || 'ethiopian', // Default display calendar
    enableCalendarConversion: process.env.ENABLE_CALENDAR_CONVERSION !== 'false', // Default true
    
    // Default fallbacks for system
    defaultTerm: 'Semester 1',
    defaultYear: '2018 E.C.'
  },

  // ID Generation
  idPrefixes: {
    student: process.env.STUDENT_ID_PREFIX || 'MJS',
    teacher: process.env.TEACHER_ID_PREFIX || 'MJT',
    registrar: process.env.REGISTRAR_ID_PREFIX || 'MJR',
    director: process.env.DIRECTOR_ID_PREFIX || 'MJD',
    admin: process.env.ADMIN_ID_PREFIX || 'MJA',
    parent: process.env.PARENT_ID_PREFIX || 'MJP'
  },

  // System Settings
  system: {
    emailDomain: process.env.EMAIL_DOMAIN || 'school.com',
    defaultPassword: process.env.DEFAULT_PASSWORD || 'pass123',
    passwordPolicy: {
      minLength: parseInt(process.env.PASSWORD_MIN_LENGTH) || 6,
      requireUppercase: process.env.PASSWORD_REQUIRE_UPPERCASE === 'true',
      requireNumbers: process.env.PASSWORD_REQUIRE_NUMBERS === 'true',
      requireSpecialChars: process.env.PASSWORD_REQUIRE_SPECIAL === 'true'
    }
  },

  // Features
  features: {
    enableStreams: process.env.ENABLE_STREAMS !== 'false', // Default true
    enableSections: process.env.ENABLE_SECTIONS !== 'false', // Default true
    enableSubSections: process.env.ENABLE_SUB_SECTIONS !== 'false', // Default true
    enableParentPortal: process.env.ENABLE_PARENT_PORTAL !== 'false', // Default true
    enableRankings: process.env.ENABLE_RANKINGS !== 'false', // Default true
    enableRegistration: process.env.ENABLE_REGISTRATION !== 'false', // Default true
    enableEthiopianCalendar: process.env.ENABLE_ETHIOPIAN_CALENDAR !== 'false' // Default true
  }
};

// Helper functions
export const getGradeLevels = () => SCHOOL_CONFIG.academic.gradeLevels;
export const getStreams = () => SCHOOL_CONFIG.academic.streams;
export const getSections = () => SCHOOL_CONFIG.academic.sections;
export const getSubSections = () => SCHOOL_CONFIG.academic.subSections;
export const getIdPrefix = (role) => SCHOOL_CONFIG.idPrefixes[role] || 'MJ';
export const getSchoolName = () => SCHOOL_CONFIG.school.name;
export const getEmailDomain = () => SCHOOL_CONFIG.system.emailDomain;

// Calendar system helpers
export const getCalendarSystem = () => SCHOOL_CONFIG.academic.calendarSystem;
export const getPrimaryCalendar = () => SCHOOL_CONFIG.academic.primaryCalendar;
export const isCalendarConversionEnabled = () => SCHOOL_CONFIG.academic.enableCalendarConversion;
export const isEthiopianCalendarEnabled = () => SCHOOL_CONFIG.features.enableEthiopianCalendar;
export const isBothCalendarsEnabled = () => SCHOOL_CONFIG.academic.calendarSystem === 'both';
export const isGregorianOnly = () => SCHOOL_CONFIG.academic.calendarSystem === 'gregorian';
export const isEthiopianOnly = () => SCHOOL_CONFIG.academic.calendarSystem === 'ethiopian';

// Validation functions
export const isValidGrade = (grade) => SCHOOL_CONFIG.academic.gradeLevels.includes(parseInt(grade));
export const isValidStream = (stream) => SCHOOL_CONFIG.academic.streams.includes(stream);
export const isValidSection = (section) => SCHOOL_CONFIG.academic.sections.includes(section);
export const isValidSubSection = (subSection) => SCHOOL_CONFIG.academic.subSections.includes(subSection);

export default SCHOOL_CONFIG;