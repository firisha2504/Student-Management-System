# Grade Hub - Student Management System

A comprehensive full-stack web application for managing students, grades, assessments, and academic operations with role-based access control.

> **Latest Update**: Complete infrastructure with assessment system, academic year archiving, sub-section support, and year-end promotion.

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite (build tool)
- React Router v6
- TanStack Query (data fetching)
- Shadcn/ui + Radix UI (components)
- Tailwind CSS (styling)
- Recharts (data visualization)

### Backend
- Node.js + Express
- MySQL 8.0+
- JWT Authentication
- bcrypt (password hashing)
- express-validator (input validation)

## Project Structure

```
Grade-Hub/
├── backend/           # Node.js backend API
├── frontend/          # React frontend application
├── docs/              # Feature documentation
├── INFRASTRUCTURE_SETUP.md    # Complete setup guide
├── SETUP_COMPLETE.md          # Setup summary
├── PROJECT_STRUCTURE.md       # Detailed structure
└── README.md                  # This file
```

See `PROJECT_STRUCTURE.md` for detailed directory structure.

## Features

### User Roles
- **Student** - View grades, update profile, check academic progress
- **Teacher** - Upload and manage student grades
- **Admin** - Full system management, user control, system settings
- **Registrar** - Student registration, profile management
- **Director** - Academic monitoring, teacher assignments, student rankings
- **Parent** - View child's grades and academic progress

### Core Functionality
- JWT-based authentication & role-based access control
- **Assessment System** - Custom assessment types with configurable weights
- **Grade Management** - Flexible grading with multiple assessment types
- **Student Registration** - Course registration and enrollment tracking
- **Academic Year Archiving** - Preserve results and rankings
- **Year-End Promotion** - Automated student promotion based on performance
- **Ranking System** - Director-approved student rankings
- **Sub-Section Support** - Divide classes into A, B, C sections
- **Profile Management** - Student, teacher, and parent profiles
- **Academic Statistics** - Charts and analytics
- **System Lock** - Prevent changes during critical periods
- **Dark/Light Theme** - User preference support
- **Responsive Design** - Mobile-friendly interface

## Getting Started

### Prerequisites
- Node.js 18+
- MySQL 8.0+
- npm or yarn

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment:
```bash
cp .env.example .env
```

Edit `.env` with your MySQL credentials:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=student_management
JWT_SECRET=your_secret_key_here
PORT=5000
```

4. Initialize database:
```bash
# Create base schema
npm run init-db

# Add all missing infrastructure
npm run setup

# Verify everything is set up correctly
npm run verify
```

This creates all tables and a default admin user:
- Username: `system.administrator.001`
- Password: `admin123`

5. Start backend server:
```bash
npm run dev
```

Backend runs on `http://localhost:5000`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start development server:
```bash
npm run dev
```

Frontend runs on `http://localhost:5174`

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user profile

### Users & Profiles
- `GET /api/users` - Get all users
- `POST /api/users` - Create new user
- `PATCH /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user
- `GET /api/profile/me` - Get my profile
- `PATCH /api/profile/me` - Update my profile

### Students
- `GET /api/students` - Get all students
- `GET /api/students/:id` - Get student by ID
- `PATCH /api/students/:id` - Update student profile

### Subjects
- `GET /api/subjects` - Get all subjects
- `POST /api/subjects` - Create subject
- `PATCH /api/subjects/:id` - Update subject
- `DELETE /api/subjects/:id` - Delete subject
- `POST /api/subjects/assign-teacher` - Assign teacher

### Assessments (NEW)
- `GET /api/assessments/types` - Get assessment types
- `POST /api/assessments/types` - Create assessment type
- `PATCH /api/assessments/types/:id` - Update assessment type
- `DELETE /api/assessments/types/:id` - Delete assessment type
- `GET /api/assessments/scores` - Get scores
- `POST /api/assessments/scores` - Upload score
- `POST /api/assessments/scores/bulk` - Bulk upload

### Grades (Legacy)
- `GET /api/grades/student/:studentId` - Get student grades
- `POST /api/grades` - Upload grade
- `POST /api/grades/bulk` - Bulk upload

### Rankings
- `GET /api/rankings/by-grade` - Get rankings
- `POST /api/rankings/approve` - Approve rankings (Director)
- `DELETE /api/rankings/approve` - Unpublish rankings

### Registration
- `GET /api/registration/my-status` - Check registration status
- `POST /api/registration/register` - Register for courses
- `GET /api/registration/unregistered` - Get unregistered students

### Academic Year (NEW)
- `POST /api/academic-year/archive` - Archive year (Registrar)
- `GET /api/academic-year/history/:studentId` - Get history
- `GET /api/academic-year/archived-years` - Get all archived years
- `DELETE /api/academic-year/archive/:year` - Delete archive (Admin)
- `POST /api/academic-year/promote` - Year-end promotion (Admin)

### Admin
- `GET /api/admin/dashboard-stats` - Dashboard statistics
- `PATCH /api/admin/system-lock` - Lock/unlock system
- `GET /api/admin/system-settings` - Get settings
- `PATCH /api/admin/system-settings` - Update settings

## Default Login

After database initialization:
- **Username**: `system.administrator.001`
- **Password**: `admin123`

⚠️ **Change this password immediately after first login!**

## Quick Commands

```bash
# Backend
npm run init-db    # Initialize database
npm run setup      # Add missing infrastructure
npm run verify     # Verify setup
npm run dev        # Start with auto-reload
npm start          # Start production

# Frontend
npm run dev        # Start development server
npm run build      # Build for production
npm run preview    # Preview production build
```

## Development

### Backend Development
```bash
cd backend
npm run dev  # Runs with nodemon for auto-reload
```

### Frontend Development
```bash
cd frontend
npm run dev  # Runs with Vite HMR
```

### Database Reset
```bash
cd backend
npm run init-db  # Drops and recreates all tables
```

## Production Deployment

### Backend
1. Set `NODE_ENV=production`
2. Use strong `JWT_SECRET`
3. Configure proper database credentials
4. Use process manager (PM2)
5. Set up reverse proxy (nginx)
6. Enable HTTPS

### Frontend
1. Build for production:
```bash
cd frontend
npm run build
```

2. Serve the `dist` folder with nginx or similar

## Security Features

- Password hashing with bcrypt
- JWT token authentication
- Role-based authorization
- SQL injection prevention (parameterized queries)
- Input validation
- CORS configuration
- System lock functionality

## License

MIT

## Documentation

- **INFRASTRUCTURE_SETUP.md** - Complete setup guide with troubleshooting
- **SETUP_COMPLETE.md** - Summary of infrastructure additions
- **PROJECT_STRUCTURE.md** - Detailed directory structure
- **docs/FEATURES.md** - Feature documentation index
- **docs/COMPLETED_REGISTRATION_SYSTEM.md** - Registration system guide
- **docs/RANKING_APPROVAL_SYSTEM.md** - Ranking system guide
- **docs/SUBJECT_SYSTEM_SUMMARY.md** - Subject management guide

## Support

For issues and questions:
1. Check the documentation files
2. Run `npm run verify` to check system health
3. Review console logs for errors
4. Check `INFRASTRUCTURE_SETUP.md` for troubleshooting
