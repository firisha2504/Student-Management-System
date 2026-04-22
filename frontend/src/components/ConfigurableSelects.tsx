import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  useGradeLevels, 
  useStreams, 
  useSections, 
  useSubSections,
  useIsStreamEnabled,
  useIsSectionEnabled,
  useIsSubSectionEnabled
} from "@/contexts/SchoolConfigContext";

// Re-export AcademicYearSelect components
export { AcademicYearSelect, SimpleAcademicYearSelect, ManualAcademicYearInput } from "./AcademicYearSelect";

interface BaseSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

interface GradeSelectProps extends BaseSelectProps {
  includeAll?: boolean;
  allLabel?: string;
}

interface StreamSelectProps extends BaseSelectProps {
  includeNone?: boolean;
  includeAll?: boolean;
  noneLabel?: string;
  allLabel?: string;
}

interface SectionSelectProps extends BaseSelectProps {
  includeNone?: boolean;
  includeAll?: boolean;
  noneLabel?: string;
  allLabel?: string;
}

interface SubSectionSelectProps extends BaseSelectProps {
  includeNone?: boolean;
  includeAll?: boolean;
  noneLabel?: string;
  allLabel?: string;
}

// Grade Level Select Component
export const GradeSelect: React.FC<GradeSelectProps> = ({
  value,
  onValueChange,
  placeholder = "Select grade",
  className = "rounded-xl",
  disabled = false,
  includeAll = false,
  allLabel = "All Grades"
}) => {
  const gradeLevels = useGradeLevels();

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {includeAll && <SelectItem value="all">{allLabel}</SelectItem>}
        {gradeLevels.map(grade => (
          <SelectItem key={grade} value={String(grade)}>
            Grade {grade}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

// Stream Select Component
export const StreamSelect: React.FC<StreamSelectProps> = ({
  value,
  onValueChange,
  placeholder = "Select stream",
  className = "rounded-xl",
  disabled = false,
  includeNone = false,
  includeAll = false,
  noneLabel = "No Stream",
  allLabel = "All Streams"
}) => {
  const streams = useStreams();
  const isEnabled = useIsStreamEnabled();

  if (!isEnabled) return null;

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {includeAll && <SelectItem value="all">{allLabel}</SelectItem>}
        {includeNone && <SelectItem value="none">{noneLabel}</SelectItem>}
        {streams.map(stream => (
          <SelectItem key={stream} value={stream}>
            {stream.charAt(0).toUpperCase() + stream.slice(1)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

// Section Select Component
export const SectionSelect: React.FC<SectionSelectProps> = ({
  value,
  onValueChange,
  placeholder = "Select section",
  className = "rounded-xl",
  disabled = false,
  includeNone = false,
  includeAll = false,
  noneLabel = "No Section",
  allLabel = "All Sections"
}) => {
  const sections = useSections();
  const isEnabled = useIsSectionEnabled();

  if (!isEnabled) return null;

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {includeAll && <SelectItem value="all">{allLabel}</SelectItem>}
        {includeNone && <SelectItem value="none">{noneLabel}</SelectItem>}
        {sections.map(section => (
          <SelectItem key={section} value={section}>
            {section.charAt(0).toUpperCase() + section.slice(1)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

// Sub-Section Select Component
export const SubSectionSelect: React.FC<SubSectionSelectProps> = ({
  value,
  onValueChange,
  placeholder = "Select sub-section",
  className = "rounded-xl",
  disabled = false,
  includeNone = false,
  includeAll = false,
  noneLabel = "No Sub-Section",
  allLabel = "All Sub-Sections"
}) => {
  const subSections = useSubSections();
  const isEnabled = useIsSubSectionEnabled();

  if (!isEnabled) return null;

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {includeAll && <SelectItem value="all">{allLabel}</SelectItem>}
        {includeNone && <SelectItem value="none">{noneLabel}</SelectItem>}
        {subSections.map(subSection => (
          <SelectItem key={subSection} value={subSection}>
            {subSection}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

// Combined Academic Structure Select (for forms that need multiple selects)
interface AcademicSelectGroupProps {
  grade: string;
  stream: string;
  section: string;
  subSection: string;
  onGradeChange: (value: string) => void;
  onStreamChange: (value: string) => void;
  onSectionChange: (value: string) => void;
  onSubSectionChange: (value: string) => void;
  disabled?: boolean;
  includeNoneOptions?: boolean;
  className?: string;
}

export const AcademicSelectGroup: React.FC<AcademicSelectGroupProps> = ({
  grade,
  stream,
  section,
  subSection,
  onGradeChange,
  onStreamChange,
  onSectionChange,
  onSubSectionChange,
  disabled = false,
  includeNoneOptions = false,
  className = "grid grid-cols-2 gap-3"
}) => {
  const gradeLevels = useGradeLevels();
  const needsStream = gradeLevels.includes(parseInt(grade)) && parseInt(grade) >= 11; // Configurable logic

  return (
    <div className={className}>
      <div className="space-y-1">
        <label className="text-xs font-semibold">Grade Level</label>
        <GradeSelect
          value={grade}
          onValueChange={onGradeChange}
          disabled={disabled}
        />
      </div>
      
      {needsStream && (
        <div className="space-y-1">
          <label className="text-xs font-semibold">Stream</label>
          <StreamSelect
            value={stream}
            onValueChange={onStreamChange}
            disabled={disabled}
            includeNone={includeNoneOptions}
          />
        </div>
      )}
      
      <div className="space-y-1">
        <label className="text-xs font-semibold">Section</label>
        <SectionSelect
          value={section}
          onValueChange={onSectionChange}
          disabled={disabled}
          includeNone={includeNoneOptions}
        />
      </div>
      
      <div className="space-y-1">
        <label className="text-xs font-semibold">Sub-Section</label>
        <SubSectionSelect
          value={subSection}
          onValueChange={onSubSectionChange}
          disabled={disabled}
          includeNone={includeNoneOptions}
        />
      </div>
    </div>
  );
};

export default {
  GradeSelect,
  StreamSelect,
  SectionSelect,
  SubSectionSelect,
  AcademicSelectGroup
};