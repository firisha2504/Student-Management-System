import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { SchoolConfig, DEFAULT_SCHOOL_CONFIG } from '../config/school';

interface SchoolConfigContextType {
  config: SchoolConfig;
  loading: boolean;
  error: string | null;
  refreshConfig: () => Promise<void>;
}

const SchoolConfigContext = createContext<SchoolConfigContextType | undefined>(undefined);

interface SchoolConfigProviderProps {
  children: ReactNode;
}

export const SchoolConfigProvider: React.FC<SchoolConfigProviderProps> = ({ children }) => {
  const [config, setConfig] = useState<SchoolConfig>(DEFAULT_SCHOOL_CONFIG);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/config/school');
      if (response.ok) {
        const fetchedConfig = await response.json();
        setConfig({ ...DEFAULT_SCHOOL_CONFIG, ...fetchedConfig });
      } else {
        throw new Error('Failed to fetch school configuration');
      }
    } catch (err) {
      console.warn('Failed to fetch school config, using defaults:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setConfig(DEFAULT_SCHOOL_CONFIG);
    } finally {
      setLoading(false);
    }
  };

  const refreshConfig = async () => {
    await fetchConfig();
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const value: SchoolConfigContextType = {
    config,
    loading,
    error,
    refreshConfig
  };

  return (
    <SchoolConfigContext.Provider value={value}>
      {children}
    </SchoolConfigContext.Provider>
  );
};

export const useSchoolConfig = (): SchoolConfigContextType => {
  const context = useContext(SchoolConfigContext);
  if (context === undefined) {
    throw new Error('useSchoolConfig must be used within a SchoolConfigProvider');
  }
  return context;
};

// Convenience hooks for specific config sections
export const useSchoolInfo = () => {
  const { config } = useSchoolConfig();
  return config.school;
};

export const useAcademicConfig = () => {
  const { config } = useSchoolConfig();
  return config.academic;
};

export const useFeatureFlags = () => {
  const { config } = useSchoolConfig();
  return config.features;
};

export const useIdPrefixes = () => {
  const { config } = useSchoolConfig();
  return config.idPrefixes;
};

// Helper hooks for common checks
export const useGradeLevels = () => {
  const { config } = useSchoolConfig();
  return config.academic.gradeLevels;
};

export const useStreams = () => {
  const { config } = useSchoolConfig();
  return config.academic.streams;
};

export const useSections = () => {
  const { config } = useSchoolConfig();
  return config.academic.sections;
};

export const useSubSections = () => {
  const { config } = useSchoolConfig();
  return config.academic.subSections;
};

export const useIsStreamEnabled = () => {
  const { config } = useSchoolConfig();
  return config.features.enableStreams;
};

export const useIsSectionEnabled = () => {
  const { config } = useSchoolConfig();
  return config.features.enableSections;
};

export const useIsSubSectionEnabled = () => {
  const { config } = useSchoolConfig();
  return config.features.enableSubSections;
};

// Calendar system hooks
export const useCalendarSystem = () => {
  const { config } = useSchoolConfig();
  return config.academic.calendarSystem;
};

export const usePrimaryCalendar = () => {
  const { config } = useSchoolConfig();
  return config.academic.primaryCalendar;
};

export const useIsEthiopianCalendarEnabled = () => {
  const { config } = useSchoolConfig();
  return config.features.enableEthiopianCalendar;
};

export const useIsBothCalendarsEnabled = () => {
  const { config } = useSchoolConfig();
  return config.academic.calendarSystem === 'both';
};

export const useIsCalendarConversionEnabled = () => {
  const { config } = useSchoolConfig();
  return config.academic.enableCalendarConversion;
};