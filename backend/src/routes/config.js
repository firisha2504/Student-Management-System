import express from 'express';
import { SCHOOL_CONFIG } from '../config/school.js';
import { generateAcademicYearOptions } from '../utils/ethiopianCalendar.js';

const router = express.Router();

// GET /api/config/school - Get school configuration
router.get('/school', (req, res) => {
  try {
    // Return sanitized config (no sensitive data)
    const publicConfig = {
      school: {
        name: SCHOOL_CONFIG.school.name,
        shortName: SCHOOL_CONFIG.school.shortName,
        logo: SCHOOL_CONFIG.school.logo,
        website: SCHOOL_CONFIG.school.website,
        address: SCHOOL_CONFIG.school.address,
        phone: SCHOOL_CONFIG.school.phone
        // Note: email excluded for security
      },
      academic: SCHOOL_CONFIG.academic,
      idPrefixes: SCHOOL_CONFIG.idPrefixes,
      features: SCHOOL_CONFIG.features
    };

    res.json(publicConfig);
  } catch (error) {
    console.error('Error fetching school config:', error);
    res.status(500).json({ error: 'Failed to fetch school configuration' });
  }
});

// GET /api/config/academic - Get academic structure only
router.get('/academic', (req, res) => {
  try {
    res.json(SCHOOL_CONFIG.academic);
  } catch (error) {
    console.error('Error fetching academic config:', error);
    res.status(500).json({ error: 'Failed to fetch academic configuration' });
  }
});

// GET /api/config/features - Get feature flags
router.get('/features', (req, res) => {
  try {
    res.json(SCHOOL_CONFIG.features);
  } catch (error) {
    console.error('Error fetching feature config:', error);
    res.status(500).json({ error: 'Failed to fetch feature configuration' });
  }
});

// GET /api/config/academic-years - Get academic year options for both calendars
router.get('/academic-years', (req, res) => {
  try {
    const { yearsBack = 5, yearsForward = 3 } = req.query;
    const academicYears = generateAcademicYearOptions(
      parseInt(yearsBack), 
      parseInt(yearsForward)
    );
    
    // Filter based on calendar system configuration
    const calendarSystem = SCHOOL_CONFIG.academic.calendarSystem;
    let filteredYears = academicYears;
    
    if (calendarSystem === 'gregorian') {
      filteredYears = { 
        gregorian: academicYears.gregorian, 
        ethiopian: [], 
        combined: academicYears.gregorian 
      };
    } else if (calendarSystem === 'ethiopian') {
      filteredYears = { 
        gregorian: [], 
        ethiopian: academicYears.ethiopian, 
        combined: academicYears.ethiopian 
      };
    }
    
    res.json({
      ...filteredYears,
      calendarSystem,
      primaryCalendar: SCHOOL_CONFIG.academic.primaryCalendar,
      enableConversion: SCHOOL_CONFIG.academic.enableCalendarConversion
    });
  } catch (error) {
    console.error('Error generating academic years:', error);
    res.status(500).json({ error: 'Failed to generate academic years' });
  }
});

export default router;