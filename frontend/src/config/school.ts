// Frontend School Configuration
// This should match the backend configuration

export interface SchoolConfig {
  school: {
    name: string;
    shortName: string;
    logo: string;
    email: string;
    website: string;
    address: string;
    phone: string;
  };
  academic: {
    gradeLevels: number[];
    streams: string[];
    sections: string[];
    subSections: string[];
    terms: string[];
    calendarSystem: 'gregorian' | 'ethiopian' | 'both';
    primaryCalendar: 'gregorian' | 'ethiopian';
    enableCalendarConversion: boolean;
  };
  idPrefixes: {
    student: string;
    teacher: string;
    registrar: string;
    director: string;
    admin: string;
    parent: string;
  };
  system: {
    emailDomain: string;
  };
  features: {
    enableStreams: boolean;
    enableSections: boolean;
    enableSubSections: boolean;
    enableParentPortal: boolean;
    enableRankings: boolean;
    enableRegistration: boolean;
    enableEthiopianCalendar: boolean;
  };
}

// Default configuration (fallback)
export const DEFAULT_SCHOOL_CONFIG: SchoolConfig = {
  school: {
    name: 'Melka Jebdu',
    shortName: 'MJ',
    logo: '/uploads/logo/school-logo.jpg',
    email: 'admin@school.com',
    website: '',
    address: '',
    phone: ''
  },
  academic: {
    gradeLevels: [9, 10, 11, 12],
    streams: ['natural', 'social'],
    sections: ['oromo', 'amharic', 'somali'],
    subSections: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
    terms: ['Semester 1', 'Semester 2'],
    calendarSystem: 'both',
    primaryCalendar: 'ethiopian',
    enableCalendarConversion: true
  },
  idPrefixes: {
    student: 'MJS',
    teacher: 'MJT',
    registrar: 'MJR',
    director: 'MJD',
    admin: 'MJA',
    parent: 'MJP'
  },
  system: {
    emailDomain: 'school.com'
  },
  features: {
    enableStreams: true,
    enableSections: true,
    enableSubSections: true,
    enableParentPortal: true,
    enableRankings: true,
    enableRegistration: true,
    enableEthiopianCalendar: true
  }
};

// Global school configuration (will be loaded from API)
let schoolConfig: SchoolConfig = DEFAULT_SCHOOL_CONFIG;

// API to fetch school configuration from backend
export const fetchSchoolConfig = async (): Promise<SchoolConfig> => {
  try {
    const response = await fetch('/api/config/school');
    if (response.ok) {
      const config = await response.json();
      schoolConfig = { ...DEFAULT_SCHOOL_CONFIG, ...config };
      return schoolConfig;
    }
  } catch (error) {
    console.warn('Failed to fetch school config, using defaults:', error);
  }
  return DEFAULT_SCHOOL_CONFIG;
};

// Getter functions
export const getSchoolConfig = (): SchoolConfig => schoolConfig;
export const getSchoolName = (): string => schoolConfig.school.name;
export const getGradeLevels = (): number[] => schoolConfig.academic.gradeLevels;
export const getStreams = (): string[] => schoolConfig.academic.streams;
export const getSections = (): string[] => schoolConfig.academic.sections;
export const getSubSections = (): string[] => schoolConfig.academic.subSections;
export const getIdPrefix = (role: keyof SchoolConfig['idPrefixes']): string => schoolConfig.idPrefixes[role];

// Feature flags
export const isStreamEnabled = (): boolean => schoolConfig.features.enableStreams;
export const isSectionEnabled = (): boolean => schoolConfig.features.enableSections;
export const isSubSectionEnabled = (): boolean => schoolConfig.features.enableSubSections;
export const isParentPortalEnabled = (): boolean => schoolConfig.features.enableParentPortal;
export const isRankingsEnabled = (): boolean => schoolConfig.features.enableRankings;
export const isRegistrationEnabled = (): boolean => schoolConfig.features.enableRegistration;
export const isEthiopianCalendarEnabled = (): boolean => schoolConfig.features.enableEthiopianCalendar;

// Calendar system helpers
export const getCalendarSystem = (): 'gregorian' | 'ethiopian' | 'both' => schoolConfig.academic.calendarSystem;
export const getPrimaryCalendar = (): 'gregorian' | 'ethiopian' => schoolConfig.academic.primaryCalendar;
export const isCalendarConversionEnabled = (): boolean => schoolConfig.academic.enableCalendarConversion;
export const isBothCalendarsEnabled = (): boolean => schoolConfig.academic.calendarSystem === 'both';
export const isGregorianOnly = (): boolean => schoolConfig.academic.calendarSystem === 'gregorian';
export const isEthiopianOnly = (): boolean => schoolConfig.academic.calendarSystem === 'ethiopian';

// Validation functions
export const isValidGrade = (grade: number): boolean => schoolConfig.academic.gradeLevels.includes(grade);
export const isValidStream = (stream: string): boolean => schoolConfig.academic.streams.includes(stream);
export const isValidSection = (section: string): boolean => schoolConfig.academic.sections.includes(section);
export const isValidSubSection = (subSection: string): boolean => schoolConfig.academic.subSections.includes(subSection);

// Helper to check if grade needs stream (for grades 11-12 in Ethiopian system)
export const gradeNeedsStream = (grade: number): boolean => {
  // This could be configurable too, but for now keep the Ethiopian logic
  return grade >= 11 && isStreamEnabled();
};

// Initialize configuration on app start
export const initializeSchoolConfig = async (): Promise<void> => {
  await fetchSchoolConfig();
};

export default schoolConfig;