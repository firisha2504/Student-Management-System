import React from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
import { getCurrentEthiopianYear } from "@/utils/ethiopianCalendar";

// Validate: YYYY E.C. (single year, Ethiopian Calendar)
export const validateECYear = (year: string): boolean => {
  return /^\d{4}\s*E\.C\.?$/i.test(year.trim());
};

// Normalize: if user types bare "2018", append " E.C."
export const normalizeECYear = (input: string): string => {
  const trimmed = input.trim();
  if (/^\d{4}$/.test(trimmed)) return `${trimmed} E.C.`;
  return trimmed;
};

// Get current Ethiopian year as "YYYY E.C."
const getCurrentECYear = (): string => {
  const year = getCurrentEthiopianYear();
  return `${year} E.C.`;
};

// ── Main component ──────────────────────────────────────────────────
interface AcademicYearSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  showCalendarToggle?: boolean;   // ignored — kept for API compat
  showConversionButton?: boolean; // ignored — kept for API compat
}

export const AcademicYearSelect: React.FC<AcademicYearSelectProps> = ({
  value,
  onValueChange,
  placeholder,
  className = "rounded-xl",
  disabled = false,
}) => {
  const isValid = !value || validateECYear(value);
  const currentYear = getCurrentECYear();
  const displayPlaceholder = placeholder || `e.g., ${currentYear}`;

  const handleChange = (input: string) => {
    onValueChange(normalizeECYear(input));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="text-xs">Ethiopian Calendar</Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onValueChange(currentYear)}
          className="h-7 px-2 text-xs"
          title="Set current Ethiopian academic year"
          type="button"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Current
        </Button>
      </div>

      <div className="relative">
        <Input
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={displayPlaceholder}
          disabled={disabled}
          className={`${className} ${value && !isValid ? 'border-red-300 focus:border-red-500' : ''}`}
        />
        {value && !isValid && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <Badge variant="destructive" className="text-xs">Invalid</Badge>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Format: YYYY E.C. (e.g., {currentYear})
      </p>
    </div>
  );
};

// ── Simplified wrapper ───────────────────────────────────────────────
interface SimpleAcademicYearSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const SimpleAcademicYearSelect: React.FC<SimpleAcademicYearSelectProps> = (props) => (
  <AcademicYearSelect {...props} />
);

// ── Manual plain input ───────────────────────────────────────────────
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
  placeholder,
  className = "rounded-xl",
  disabled = false,
}) => (
  <Input
    value={value}
    onChange={(e) => onValueChange(e.target.value)}
    placeholder={placeholder || `e.g., ${getCurrentECYear()}`}
    disabled={disabled}
    className={className}
  />
);

export default AcademicYearSelect;
