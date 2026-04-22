import React, { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, RefreshCw, ArrowLeftRight } from "lucide-react";
import { 
  usePrimaryCalendar, 
  useIsBothCalendarsEnabled,
  useIsCalendarConversionEnabled 
} from "@/contexts/SchoolConfigContext";
import { 
  convertAcademicYear, 
  getCurrentEthiopianYear,
  getCurrentGregorianAcademicYear,
  getEthiopianAcademicYear,
  getGregorianAcademicYear
} from "@/utils/ethiopianCalendar";

interface AcademicYearSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  showCalendarToggle?: boolean;
  showConversionButton?: boolean;
}

export const AcademicYearSelect: React.FC<AcademicYearSelectProps> = ({
  value,
  onValueChange,
  placeholder = "Enter academic year",
  className = "rounded-xl",
  disabled = false,
  showCalendarToggle = true,
  showConversionButton = true
}) => {
  const primaryCalendar = usePrimaryCalendar();
  const isBothEnabled = useIsBothCalendarsEnabled();
  const isConversionEnabled = useIsCalendarConversionEnabled();
  
  const [currentCalendarView, setCurrentCalendarView] = useState<'gregorian' | 'ethiopian'>(primaryCalendar);

  // Get current academic year as placeholder based on calendar system
  const getCurrentAcademicYear = () => {
    if (currentCalendarView === 'ethiopian') {
      const ethYear = getCurrentEthiopianYear();
      return getEthiopianAcademicYear(ethYear);
    } else {
      const gregYear = getCurrentGregorianAcademicYear();
      return getGregorianAcademicYear(gregYear);
    }
  };

  // Get placeholder text with current year example
  const getPlaceholderText = () => {
    const currentYear = getCurrentAcademicYear();
    if (currentCalendarView === 'ethiopian') {
      return placeholder || `e.g., ${currentYear}`;
    } else {
      return placeholder || `e.g., ${currentYear}`;
    }
  };

  // Validate academic year format
  const validateAcademicYear = (year: string): boolean => {
    if (!year.trim()) return false;
    
    if (currentCalendarView === 'ethiopian') {
      // Ethiopian format: YYYY-YYYY E.C. (flexible spacing)
      return /^\d{4}-\d{4}\s*E\.C\.?$/i.test(year.trim());
    } else {
      // Gregorian format: YYYY-YYYY
      return /^\d{4}-\d{4}$/.test(year.trim());
    }
  };

  // Format input value based on calendar system
  const formatInputValue = (inputValue: string): string => {
    const trimmed = inputValue.trim();
    
    if (currentCalendarView === 'ethiopian') {
      // Auto-add E.C. if not present
      if (/^\d{4}-\d{4}$/.test(trimmed)) {
        return `${trimmed} E.C.`;
      }
    }
    
    return trimmed;
  };

  // Handle input change
  const handleInputChange = (inputValue: string) => {
    const formatted = formatInputValue(inputValue);
    onValueChange(formatted);
  };

  // Convert current value to opposite calendar system
  const handleConversion = () => {
    if (!value || !isConversionEnabled) return;
    
    const currentCalendar = value.includes('E.C.') ? 'ethiopian' : 'gregorian';
    const targetCalendar = currentCalendar === 'gregorian' ? 'ethiopian' : 'gregorian';
    
    const convertedYear = convertAcademicYear(value, currentCalendar, targetCalendar);
    onValueChange(convertedYear);
    
    // Also switch the calendar view if both calendars are enabled
    if (isBothEnabled) {
      setCurrentCalendarView(targetCalendar);
    }
  };

  // Toggle calendar view (only available when both calendars are enabled)
  const toggleCalendarView = () => {
    if (!isBothEnabled) return;
    const newCalendarView = currentCalendarView === 'gregorian' ? 'ethiopian' : 'gregorian';
    setCurrentCalendarView(newCalendarView);
    
    // Convert current value to new calendar system if value exists
    if (value && isConversionEnabled) {
      const currentCalendar = value.includes('E.C.') ? 'ethiopian' : 'gregorian';
      if (currentCalendar !== newCalendarView) {
        const convertedYear = convertAcademicYear(value, currentCalendar, newCalendarView);
        onValueChange(convertedYear);
      }
    }
  };

  // Set current academic year
  const setCurrentYear = () => {
    const currentYear = getCurrentAcademicYear();
    onValueChange(currentYear);
  };

  const currentCalendarLabel = currentCalendarView === 'gregorian' ? 'Gregorian' : 'Ethiopian';
  const canConvert = isConversionEnabled && value && isBothEnabled;
  const canToggleView = isBothEnabled && showCalendarToggle;
  const isValidFormat = validateAcademicYear(value);

  return (
    <div className="space-y-2">
      {/* Calendar System Header */}
      {(canToggleView || canConvert) && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Badge variant="outline" className="text-xs">
              {currentCalendarLabel} Calendar
            </Badge>
          </div>
          
          <div className="flex items-center gap-1 flex-wrap">
            {canToggleView && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleCalendarView}
                className="h-7 px-2 text-xs flex-shrink-0"
                title={`Switch to ${currentCalendarView === 'gregorian' ? 'Ethiopian' : 'Gregorian'} calendar`}
              >
                <Calendar className="h-3 w-3 sm:mr-1" />
                <span className="hidden sm:inline">Switch</span>
              </Button>
            )}
            
            {canConvert && showConversionButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleConversion}
                className="h-7 px-2 text-xs flex-shrink-0"
                title="Convert to other calendar system"
              >
                <ArrowLeftRight className="h-3 w-3 sm:mr-1" />
                <span className="hidden sm:inline">Convert</span>
              </Button>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={setCurrentYear}
              className="h-7 px-2 text-xs flex-shrink-0"
              title="Set current academic year"
            >
              <RefreshCw className="h-3 w-3 sm:mr-1" />
              <span className="hidden sm:inline">Current</span>
            </Button>
          </div>
        </div>
      )}

      {/* Academic Year Input */}
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={getPlaceholderText()}
          disabled={disabled}
          className={`${className} ${!isValidFormat && value ? 'border-red-300 focus:border-red-500' : ''}`}
        />
        {!isValidFormat && value && (
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
            <Badge variant="destructive" className="text-xs">
              Invalid
            </Badge>
          </div>
        )}
      </div>

      {/* Format Help Text */}
      <div className="text-xs text-muted-foreground">
        {currentCalendarView === 'ethiopian' ? (
          <span>
            Format: YYYY-YYYY E.C. (e.g., 2018-2019 E.C.)
          </span>
        ) : (
          <span>
            Format: YYYY-YYYY (e.g., 2025-2026)
          </span>
        )}
        {isBothEnabled && isConversionEnabled && (
          <>
            <span className="hidden sm:inline"> • Use convert button to switch between calendars.</span>
            <span className="sm:hidden"> • Tap convert to switch calendars.</span>
          </>
        )}
      </div>
    </div>
  );
};

// Simplified version for basic use cases
interface SimpleAcademicYearSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const SimpleAcademicYearSelect: React.FC<SimpleAcademicYearSelectProps> = (props) => {
  return (
    <AcademicYearSelect
      {...props}
      showCalendarToggle={false}
      showConversionButton={false}
    />
  );
};

// Very basic manual input version
interface ManualAcademicYearInputProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const ManualAcademicYearInput: React.FC<ManualAcademicYearInputProps> = ({
  value,
  onValueChange,
  placeholder = "e.g., 2025-2026",
  className = "rounded-xl",
  disabled = false
}) => {
  return (
    <Input
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
    />
  );
};

export default AcademicYearSelect;