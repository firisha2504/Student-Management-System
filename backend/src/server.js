import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import studentRoutes from './routes/students.js';
import gradeRoutes from './routes/grades.js';
import subjectRoutes from './routes/subjects.js';
import adminRoutes from './routes/admin.js';
import profileRoutes from './routes/profile.js';
import registrationRoutes from './routes/registration.js';
import rankingsRoutes from './routes/rankings.js';
import assessmentsRoutes from './routes/assessments.js';
import teacherAssignmentsRoutes from './routes/teacher-assignments.js';
import academicYearRoutes from './routes/academic-year.js';
import parentsRoutes from './routes/parents.js';
import teacherRequestsRoutes from './routes/teacher-requests.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5174',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (uploaded images)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/grades', gradeRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/registration', registrationRoutes);
app.use('/api/rankings', rankingsRoutes);
app.use('/api/assessments', assessmentsRoutes);
app.use('/api/teacher-assignments', teacherAssignmentsRoutes);
app.use('/api/academic-year', academicYearRoutes);
app.use('/api/parents', parentsRoutes);
app.use('/api/teacher-requests', teacherRequestsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📝 API Documentation: http://localhost:${PORT}/api/health`);
});
