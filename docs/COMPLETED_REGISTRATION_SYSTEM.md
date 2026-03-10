# Student Registration System - Complete Implementation

## Overview
The registration system tracks student attendance for each academic year. After year-end promotion, students must register to confirm they're attending the new year.

## How It Works

### 1. Year-End Promotion (Admin)
- Admin clicks "Promote Students" in Admin Panel → Settings
- System evaluates all students based on their grades:
  - **Average ≥ 50%**: Promoted to next grade
  - **Average < 50%**: Retained in current grade
  - **Grade 12 with ≥ 50%**: Graduated (account deactivated)
- System updates `current_academic_year` in system settings
- Students' `grade_level` is updated in `student_profiles` table

### 2. Student Registration
After promotion, students see the **Register** tab in their dashboard:

#### If NOT Registered:
- Shows promotion confirmation form
- Displays student info and available courses
- Student clicks "Confirm Registration" button
- System creates record in `student_registrations` table
- System creates course enrollments in `course_enrollments` table

#### If Already Registered:
- Shows registration slip with:
  - Student information
  - List of registered courses with credit hours and ECTS
  - Signature lines for advisor and registrar
  - Print button

### 3. Tracking Unregistered Students (Admin/Registrar)
Admin and Registrar can track who hasn't registered:

**API Endpoint**: `GET /api/registration/unregistered?academic_year=2025-2026`

**Response**:
```json
{
  "academicYear": "2025-2026",
  "count": 5,
  "students": [
    {
      "user_id": 123,
      "username": "john.doe.001",
      "full_name": "John Doe",
      "phone": "1234567890",
      "grade_level": 10,
      "stream": "Science"
    }
  ]
}
```

## Database Tables

### student_registrations
Tracks which students registered for each academic year:
- `id`: Primary key
- `student_id`: Foreign key to users table
- `academic_year`: e.g., "2025-2026"
- `term`: e.g., "Fall", "Spring"
- `total_credit_hours`: Sum of all course credit hours
- `total_ects`: Sum of all course ECTS
- `status`: "registered", "approved", "rejected"
- `registrar_approved`: Boolean flag
- `registration_date`: Timestamp

### course_enrollments
Tracks which courses each student registered for:
- `id`: Primary key
- `registration_id`: Foreign key to student_registrations
- `subject_id`: Foreign key to subjects table
- `credit_hours`: Credit hours for this course
- `ects`: ECTS for this course
- `instructor`: Instructor name (default: "TBA")

## API Endpoints

### Student Endpoints
- `GET /api/registration/my-status` - Check if student registered for current year
- `GET /api/registration/available-courses` - Get courses for student's grade/stream
- `POST /api/registration/register` - Register for courses

### Admin/Registrar Endpoints
- `GET /api/registration/all` - Get all registrations (with filters)
- `GET /api/registration/unregistered` - Get students who haven't registered
- `PATCH /api/registration/:id/approve` - Approve/reject registration

## User Flow

### Student Flow:
1. Student logs in after year-end promotion
2. Clicks "Register" tab in dashboard
3. Sees promotion confirmation form with available courses
4. Clicks "Confirm Registration" button
5. Success modal appears
6. Registration slip is now available (can print)

### Admin Flow:
1. Admin runs year-end promotion
2. System promotes students and updates academic year
3. Admin can view:
   - All registrations: `GET /api/registration/all`
   - Unregistered students: `GET /api/registration/unregistered`
4. Admin can approve/reject registrations if needed

## Key Features

✅ **Automatic Promotion**: Students are promoted based on grades
✅ **Registration Tracking**: System knows who registered and who didn't
✅ **Registration Slip**: Students can print their registration slip
✅ **Course Enrollment**: Tracks which courses each student registered for
✅ **Unregistered Students**: Admin can see who hasn't registered yet
✅ **Academic Year Management**: System updates academic year automatically

## Important Notes

1. **Registration is Required**: After promotion, students MUST register to confirm attendance
2. **One Registration Per Year**: Students can only register once per academic year
3. **Unregistered = Not Attending**: If a student doesn't register, the system assumes they're not attending
4. **Graduated Students**: Grade 12 students with passing grades are automatically deactivated
5. **Stream Reset**: Students promoted from grade 10 to 11 have their stream reset (they choose new stream)

## Testing the Feature

### Test Scenario 1: Year-End Promotion
1. Login as admin (username: `system.administrator.001`, password: `admin123`)
2. Go to Admin Panel → Settings
3. Click "Promote Students"
4. Verify students are promoted to next grade

### Test Scenario 2: Student Registration
1. Login as student
2. Click "Register" tab
3. Verify promotion confirmation form appears
4. Click "Confirm Registration"
5. Verify registration slip appears

### Test Scenario 3: Unregistered Students
1. Login as admin or registrar
2. Call API: `GET http://localhost:5000/api/registration/unregistered`
3. Verify list of students who haven't registered

## Future Enhancements

- [ ] Email notifications to unregistered students
- [ ] Registration deadline management
- [ ] Course selection (currently auto-enrolls all courses)
- [ ] Prerequisites checking
- [ ] Credit hour limits
- [ ] Stream selection for grade 11 students
- [ ] Parent approval for registration
- [ ] Late registration workflow
