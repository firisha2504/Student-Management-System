# Student Management System - Backend API

Node.js + Express + MySQL backend for the Student Management System.

## Features

- JWT-based authentication
- Role-based access control (Student, Teacher, Admin, Registrar, Director, Parent)
- RESTful API endpoints
- MySQL database with proper relationships
- Input validation and error handling
- Secure password hashing with bcrypt

## Prerequisites

- Node.js 18+ 
- MySQL 8.0+
- npm or yarn

## Installation

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Edit `.env` with your configuration:
```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=student_management
JWT_SECRET=your_secret_key_here
```

5. Initialize the database:
```bash
npm run init-db
```

This will:
- Create the database
- Create all tables
- Insert default subjects
- Create a default admin user

## Default Admin Credentials

After initialization:
- Email: `admin@school.com`
- Password: `admin123`

⚠️ **Change this password immediately after first login!**

## Running the Server

### Development mode (with auto-reload):
```bash
npm run dev
```

### Production mode:
```bash
npm start
```

The server will run on `http://localhost:5000`

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user profile
- `POST /api/auth/logout` - Logout

### Users
- `GET /api/users` - Get all users (admin/registrar)
- `POST /api/users` - Create new user (admin/registrar)
- `PATCH /api/users/:id/status` - Update user status (admin)
- `DELETE /api/users/:id` - Delete user (admin)

### Students
- `GET /api/students` - Get all students
- `GET /api/students/:id` - Get student by ID
- `PUT /api/students/:id` - Update student profile
- `GET /api/students/rankings/by-grade` - Get student rankings

### Grades
- `GET /api/grades/student/:studentId` - Get student grades
- `POST /api/grades` - Upload/update grade (teacher)
- `POST /api/grades/bulk` - Bulk upload grades (teacher)
- `DELETE /api/grades/:id` - Delete grade (teacher/admin)
- `GET /api/grades/stats/overview` - Get grade statistics (admin/director)

### Subjects
- `GET /api/subjects` - Get all subjects
- `POST /api/subjects` - Create subject (admin)
- `POST /api/subjects/assign-teacher` - Assign teacher to subject (admin/director)
- `GET /api/subjects/teacher/:teacherId` - Get teacher's subjects

## Database Schema

### Main Tables
- `users` - User accounts
- `user_roles` - User role assignments
- `profiles` - User profile information
- `student_profiles` - Student-specific data
- `subjects` - Subject definitions
- `grades` - Student grades
- `teacher_subjects` - Teacher-subject assignments
- `parent_students` - Parent-student relationships
- `teacher_requests` - Teacher registration requests
- `system_settings` - System configuration

## Authentication

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## Role-Based Access

Different endpoints require different roles:
- **Admin**: Full system access
- **Registrar**: User and student management
- **Director**: Academic oversight and reporting
- **Teacher**: Grade management for assigned subjects
- **Student**: View own grades and profile
- **Parent**: View linked student information

## Error Handling

The API returns standard HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

Error responses include a message:
```json
{
  "error": "Error message here"
}
```

## Security Features

- Password hashing with bcrypt
- JWT token authentication
- Role-based authorization
- SQL injection prevention (parameterized queries)
- Input validation with express-validator
- CORS configuration

## Development

### Database Reset

To reset the database:
```bash
npm run init-db
```

This will drop all tables and recreate them with fresh data.

### Adding New Routes

1. Create route file in `src/routes/`
2. Import in `src/server.js`
3. Add route: `app.use('/api/your-route', yourRoute)`

## Production Deployment

1. Set `NODE_ENV=production` in `.env`
2. Use a strong `JWT_SECRET`
3. Configure proper database credentials
4. Use a process manager like PM2
5. Set up reverse proxy (nginx)
6. Enable HTTPS

## Troubleshooting

### Database Connection Failed
- Check MySQL is running
- Verify credentials in `.env`
- Ensure database exists

### Port Already in Use
- Change `PORT` in `.env`
- Or kill process using port 5000

### JWT Errors
- Ensure `JWT_SECRET` is set in `.env`
- Check token expiration

## License

MIT
