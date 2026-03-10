# Grade Hub - Features Documentation

This directory contains detailed documentation for specific features.

## Feature Guides

### 1. Registration System
See: `COMPLETED_REGISTRATION_SYSTEM.md`
- Student registration workflow
- Course enrollment
- Registration tracking
- Unregistered students report

### 2. Ranking System
See: `RANKING_APPROVAL_SYSTEM.md`
- Director approval workflow
- Student ranking calculation
- Publish/unpublish rankings
- Grade and stream-based rankings

### 3. Subject Management
See: `SUBJECT_SYSTEM_SUMMARY.md`
- Subject CRUD operations
- Credit hours and ECTS configuration
- Teacher assignment to subjects
- Grade and stream filtering

## Quick Links

- **Setup Guide**: `../INFRASTRUCTURE_SETUP.md`
- **Setup Summary**: `../SETUP_COMPLETE.md`
- **Main README**: `../README.md`

## Feature Status

| Feature | Status | Documentation |
|---------|--------|---------------|
| User Management | ✅ Complete | README.md |
| Authentication | ✅ Complete | README.md |
| Student Profiles | ✅ Complete | README.md |
| Subject Management | ✅ Complete | SUBJECT_SYSTEM_SUMMARY.md |
| Assessment System | ✅ Complete | INFRASTRUCTURE_SETUP.md |
| Grading System | ✅ Complete | README.md |
| Ranking System | ✅ Complete | RANKING_APPROVAL_SYSTEM.md |
| Registration System | ✅ Complete | COMPLETED_REGISTRATION_SYSTEM.md |
| Academic Year Archive | ✅ Complete | INFRASTRUCTURE_SETUP.md |
| Year-End Promotion | ✅ Complete | INFRASTRUCTURE_SETUP.md |
| Sub-Section Support | ✅ Complete | INFRASTRUCTURE_SETUP.md |
| Teacher Portal | ✅ Complete | README.md |
| Parent Portal | ✅ Complete | README.md |
| Profile Management | ✅ Complete | README.md |

## System Architecture

```
Grade Hub
│
├── Backend (Node.js + Express + MySQL)
│   ├── Authentication & Authorization
│   ├── RESTful API (11 route groups)
│   ├── File Upload (Multer)
│   └── Database (20+ tables)
│
├── Frontend (React + TypeScript + Tailwind)
│   ├── Role-based Dashboards
│   ├── Responsive UI
│   └── Component Library (shadcn/ui)
│
└── Documentation
    ├── Setup Guides
    ├── Feature Documentation
    └── API Reference
```

## Getting Help

1. Check the relevant feature documentation
2. Review `INFRASTRUCTURE_SETUP.md` for setup issues
3. Run `npm run verify` to check system health
4. Check console logs for errors
