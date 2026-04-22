# Ethiopian Calendar System Integration

## Overview

The Student Management System now supports both Gregorian and Ethiopian calendar systems for academic year management. This feature allows schools to use either calendar system or both simultaneously with conversion capabilities.

## Features Implemented

### 1. Dual Calendar Support
- **Gregorian Calendar**: Standard international calendar (2025-2026)
- **Ethiopian Calendar**: Traditional Ethiopian calendar (2018-2019 E.C.)
- **Both Systems**: Support for both calendars with conversion between them

### 2. Configuration Options
The system can be configured through environment variables:

```env
# Calendar System Configuration
CALENDAR_SYSTEM=both
# Options: 'gregorian', 'ethiopian', 'both'

PRIMARY_CALENDAR=gregorian
# Options: 'gregorian', 'ethiopian'
# Default calendar system to display first

ENABLE_CALENDAR_CONVERSION=true
# Allow users to convert between calendar systems

ENABLE_ETHIOPIAN_CALENDAR=true
# Enable Ethiopian calendar features
```

### 3. Academic Year Generation
- Automatic generation of academic years for both calendar systems
- Configurable range (years back and forward)
- Proper formatting with calendar indicators (G.C. / E.C.)
- API endpoint: `/api/config/academic-years`

### 4. User Interface Components

#### AcademicYearSelect Component
- Full-featured academic year selector with calendar switching
- Calendar system indicators and conversion buttons
- Refresh functionality for dynamic updates

#### SimpleAcademicYearSelect Component
- Simplified version for basic use cases
- Automatic calendar system detection
- Clean, minimal interface

### 5. Calendar Conversion
- Convert academic years between Gregorian and Ethiopian calendars
- Approximate conversion (Ethiopian year ≈ Gregorian year - 7/8)
- Bidirectional conversion support

## Ethiopian Calendar Information

### Calendar Structure
- **13 Months**: 12 months of 30 days + 1 month (Pagumen) of 5-6 days
- **New Year**: Starts on September 11 (or 12 in leap years) in Gregorian calendar
- **Year Difference**: Ethiopian calendar is approximately 7-8 years behind Gregorian

### Month Names
1. Meskerem (September)
2. Tikimt (October)
3. Hidar (November)
4. Tahsas (December)
5. Tir (January)
6. Yekatit (February)
7. Megabit (March)
8. Miazia (April)
9. Ginbot (May)
10. Sene (June)
11. Hamle (July)
12. Nehase (August)
13. Pagumen (13th month, 5-6 days)

### Academic Year Examples
- **Gregorian**: 2025-2026 G.C.
- **Ethiopian**: 2018-2019 E.C.
- **Conversion**: 2025-2026 G.C. ≈ 2018-2019 E.C.

## Implementation Details

### Backend Components

#### 1. Ethiopian Calendar Utilities (`src/utils/ethiopianCalendar.js`)
```javascript
// Key functions
- gregorianToEthiopian(date)
- ethiopianToGregorian(ethYear, ethMonth, ethDay)
- generateAcademicYearOptions(yearsBack, yearsForward)
- convertAcademicYear(year, fromCalendar, toCalendar)
```

#### 2. School Configuration (`src/config/school.js`)
```javascript
// Calendar system configuration
academic: {
  calendarSystem: 'both',
  primaryCalendar: 'gregorian',
  enableCalendarConversion: true
}
```

#### 3. API Routes (`src/routes/config.js`)
```javascript
// New endpoint
GET /api/config/academic-years
// Returns academic years for both calendar systems
```

### Frontend Components

#### 1. Ethiopian Calendar Utilities (`src/utils/ethiopianCalendar.ts`)
- TypeScript version of backend utilities
- Frontend-specific functions for UI components
- API integration for fetching academic years

#### 2. AcademicYearSelect Component (`src/components/AcademicYearSelect.tsx`)
```tsx
// Full-featured component
<AcademicYearSelect
  value={academicYear}
  onValueChange={setAcademicYear}
  showCalendarToggle={true}
  showConversionButton={true}
/>

// Simplified component
<SimpleAcademicYearSelect
  value={academicYear}
  onValueChange={setAcademicYear}
/>
```

#### 3. School Configuration Context
```tsx
// New hooks for calendar system
useCalendarSystem()
usePrimaryCalendar()
useIsEthiopianCalendarEnabled()
useIsBothCalendarsEnabled()
useIsCalendarConversionEnabled()
```

## Usage Examples

### 1. Basic Academic Year Selection
```tsx
import { SimpleAcademicYearSelect } from '@/components/ConfigurableSelects';

function MyComponent() {
  const [academicYear, setAcademicYear] = useState('');
  
  return (
    <SimpleAcademicYearSelect
      value={academicYear}
      onValueChange={setAcademicYear}
      placeholder="Select academic year"
    />
  );
}
```

### 2. Advanced Academic Year Selection with Calendar Switching
```tsx
import { AcademicYearSelect } from '@/components/ConfigurableSelects';

function AdvancedComponent() {
  const [academicYear, setAcademicYear] = useState('');
  
  return (
    <AcademicYearSelect
      value={academicYear}
      onValueChange={setAcademicYear}
      showCalendarToggle={true}
      showConversionButton={true}
      yearsBack={10}
      yearsForward={5}
    />
  );
}
```

### 3. Calendar System Configuration
```tsx
import { useCalendarSystem, useIsBothCalendarsEnabled } from '@/contexts/SchoolConfigContext';

function CalendarInfo() {
  const calendarSystem = useCalendarSystem();
  const bothEnabled = useIsBothCalendarsEnabled();
  
  return (
    <div>
      <p>Calendar System: {calendarSystem}</p>
      <p>Both Calendars: {bothEnabled ? 'Yes' : 'No'}</p>
    </div>
  );
}
```

## Configuration Examples

### 1. Ethiopian School (Both Calendars, Ethiopian Primary)
```env
SCHOOL_NAME=Melka Jebdu Secondary School
CALENDAR_SYSTEM=both
PRIMARY_CALENDAR=ethiopian
ENABLE_ETHIOPIAN_CALENDAR=true
ENABLE_CALENDAR_CONVERSION=true
```

### 2. International School (Gregorian Only)
```env
SCHOOL_NAME=International Academy
CALENDAR_SYSTEM=gregorian
PRIMARY_CALENDAR=gregorian
ENABLE_ETHIOPIAN_CALENDAR=false
ENABLE_CALENDAR_CONVERSION=false
```

### 3. Ethiopian School (Ethiopian Only)
```env
SCHOOL_NAME=Traditional Ethiopian School
CALENDAR_SYSTEM=ethiopian
PRIMARY_CALENDAR=ethiopian
ENABLE_ETHIOPIAN_CALENDAR=true
ENABLE_CALENDAR_CONVERSION=false
```

## API Endpoints

### Get Academic Years
```http
GET /api/config/academic-years?yearsBack=5&yearsForward=3

Response:
{
  "gregorian": [...],
  "ethiopian": [...],
  "combined": [...],
  "calendarSystem": "both",
  "primaryCalendar": "gregorian",
  "enableConversion": true
}
```

### Get School Configuration
```http
GET /api/config/school

Response includes:
{
  "academic": {
    "calendarSystem": "both",
    "primaryCalendar": "gregorian",
    "enableCalendarConversion": true
  },
  "features": {
    "enableEthiopianCalendar": true
  }
}
```

## Integration Points

### 1. Updated Pages
- **RegistrarPortal**: Academic year selection for registration settings and archiving
- **TeacherPortal**: Academic year context for grade management
- **Admin Settings**: Calendar system configuration

### 2. Database Considerations
- Academic year fields support both calendar formats
- Conversion handled at application layer
- Existing data remains compatible

### 3. Backward Compatibility
- Existing academic year data works without changes
- Default configuration maintains current behavior
- Gradual migration path for schools wanting to adopt Ethiopian calendar

## Testing

### 1. API Testing
```bash
# Test academic years endpoint
curl http://localhost:5001/api/config/academic-years

# Test with parameters
curl "http://localhost:5001/api/config/academic-years?yearsBack=10&yearsForward=5"
```

### 2. Frontend Testing
- Test calendar switching functionality
- Verify conversion between calendar systems
- Check proper formatting and display

### 3. Configuration Testing
- Test different calendar system configurations
- Verify feature flags work correctly
- Test environment variable changes

## Future Enhancements

### 1. Precise Date Conversion
- Implement exact Ethiopian-Gregorian date conversion
- Handle leap years and month boundaries accurately
- Add date picker components for both calendars

### 2. Localization
- Add Amharic language support for Ethiopian calendar
- Localized month names and formatting
- Right-to-left text support

### 3. Advanced Features
- Ethiopian calendar date calculations for holidays
- Academic calendar generation with Ethiopian holidays
- Integration with Ethiopian government academic calendar

### 4. Reporting
- Academic year reports in both calendar systems
- Automatic calendar conversion in exports
- Dual-calendar academic transcripts

## Troubleshooting

### Common Issues

1. **Calendar Conversion Errors**
   - Check that both calendar systems are enabled
   - Verify academic year format (YYYY-YYYY vs YYYY-YYYY E.C.)

2. **Configuration Not Loading**
   - Restart backend server after environment variable changes
   - Check that configuration API endpoints are accessible

3. **UI Components Not Showing**
   - Verify that Ethiopian calendar feature is enabled
   - Check that calendar system is set to 'both' or 'ethiopian'

### Debug Information
- Check browser console for API errors
- Verify backend logs for configuration loading
- Test API endpoints directly with curl/Postman

## Conclusion

The Ethiopian calendar system integration provides comprehensive support for schools using the Ethiopian calendar while maintaining full backward compatibility. The system is highly configurable and can adapt to different institutional needs, from Ethiopian schools wanting both calendar systems to international schools using only the Gregorian calendar.

The implementation follows the existing configuration system patterns and integrates seamlessly with the current codebase, making it a natural extension of the school management system's capabilities.