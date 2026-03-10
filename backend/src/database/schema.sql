-- Grade Hub - Complete Database Schema
-- This file creates all tables and initial data for the Grade Hub system

-- Disable foreign key checks temporarily
SET FOREIGN_KEY_CHECKS = 0;

-- Drop existing tables if they exist (in reverse dependency order)
DROP TABLE IF EXISTS assessment_scores;
DROP TABLE IF EXISTS assessment_types;
DROP TABLE IF EXISTS academic_year_summaries;
DROP TABLE IF EXISTS academic_year_results;
DROP TABLE IF EXISTS course_enrollments;
DROP TABLE IF EXISTS student_registrations;
DROP TABLE IF EXISTS ranking_approvals;
DROP TABLE IF EXISTS teacher_sub_sections;
DROP TABLE IF EXISTS teacher_sections;
DROP TABLE IF EXISTS credentials_log;
DROP TABLE IF EXISTS grades;
DROP TABLE IF EXISTS teacher_subjects;
DROP TABLE IF EXISTS teacher_requests;
DROP TABLE IF EXISTS parent_students;
DROP TABLE IF EXISTS student_profiles;
DROP TABLE IF EXISTS profiles;
DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS subjects;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS system_settings;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- CORE TABLES
-- ============================================================

-- Users table
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_username (username),
  INDEX idx_email (email)
);

-- User roles table
CREATE TABLE user_roles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  role ENUM('student', 'teacher', 'admin', 'registrar', 'director', 'parent') NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_role (user_id, role),
  INDEX idx_user_id (user_id),
  INDEX idx_role (role)
);

-- Profiles table (common fields for all users)
CREATE TABLE profiles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  address TEXT,
  date_of_birth DATE,
  gender ENUM('male', 'female', 'other'),
  profile_image VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_full_name (full_name)
);

-- Student specific profiles
CREATE TABLE student_profiles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT UNIQUE NOT NULL,
  admission_number VARCHAR(50) UNIQUE NOT NULL,
  grade_level INT,
  stream ENUM('Science', 'Arts', 'Commerce'),
  section ENUM('oromo', 'amharic', 'somali'),
  sub_section VARCHAR(10),
  enrollment_date DATE NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_admission_number (admission_number),
  INDEX idx_grade_level (grade_level)
);

-- Subjects table
CREATE TABLE subjects (
  id INT PRIMARY KEY AUTO_INCREMENT,
  subject_name VARCHAR(100) UNIQUE NOT NULL,
  subject_code VARCHAR(20) UNIQUE NOT NULL,
  description TEXT,
  credit_hours INT DEFAULT 3,
  ects INT DEFAULT 5,
  grade_level INT,
  stream ENUM('Science', 'Arts', 'Commerce', 'Common') DEFAULT 'Common',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_subject_name (subject_name)
);

-- ============================================================
-- TEACHER & ASSIGNMENT TABLES
-- ============================================================

-- Teacher subjects assignment
CREATE TABLE teacher_subjects (
  id INT PRIMARY KEY AUTO_INCREMENT,
  teacher_id INT NOT NULL,
  subject_id INT NOT NULL,
  grade_level INT NOT NULL,
  stream ENUM('Science', 'Arts', 'Commerce'),
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  UNIQUE KEY unique_teacher_subject (teacher_id, subject_id, grade_level, stream),
  INDEX idx_teacher_id (teacher_id),
  INDEX idx_subject_id (subject_id)
);

-- Teacher sections assignment
CREATE TABLE teacher_sections (
  id INT PRIMARY KEY AUTO_INCREMENT,
  teacher_id INT NOT NULL,
  section VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_teacher_section (teacher_id, section),
  INDEX idx_teacher_id (teacher_id)
);

-- Teacher sub-sections assignment
CREATE TABLE teacher_sub_sections (
  id INT PRIMARY KEY AUTO_INCREMENT,
  teacher_id INT NOT NULL,
  sub_section VARCHAR(10) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_teacher_sub_section (teacher_id, sub_section),
  INDEX idx_teacher_id (teacher_id)
);

-- Teacher requests (for new teacher registration)
CREATE TABLE teacher_requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  subject_specialization VARCHAR(100),
  qualifications TEXT,
  experience_years INT,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP NULL,
  reviewed_by INT NULL,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_email (email),
  INDEX idx_status (status)
);

-- ============================================================
-- GRADING & ASSESSMENT TABLES
-- ============================================================

-- Legacy grades table (simple grading)
CREATE TABLE grades (
  id INT PRIMARY KEY AUTO_INCREMENT,
  student_id INT NOT NULL,
  subject_id INT NOT NULL,
  teacher_id INT NOT NULL,
  score DECIMAL(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
  term ENUM('Term 1', 'Term 2', 'Term 3') NOT NULL,
  academic_year VARCHAR(9) NOT NULL,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_grade (student_id, subject_id, term, academic_year),
  INDEX idx_student_id (student_id),
  INDEX idx_subject_id (subject_id),
  INDEX idx_academic_year (academic_year)
);

-- Assessment types (flexible assessment configuration)
CREATE TABLE assessment_types (
  id INT PRIMARY KEY AUTO_INCREMENT,
  teacher_id INT NOT NULL,
  subject_id INT NOT NULL,
  grade_level INT NOT NULL,
  stream VARCHAR(50),
  section VARCHAR(50),
  sub_section VARCHAR(10),
  assessment_name VARCHAR(100) NOT NULL,
  weight DECIMAL(5,2) NOT NULL CHECK (weight >= 0 AND weight <= 100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  INDEX idx_teacher_subject (teacher_id, subject_id),
  INDEX idx_grade_stream (grade_level, stream)
);

-- Assessment scores (detailed scoring per assessment type)
CREATE TABLE assessment_scores (
  id INT PRIMARY KEY AUTO_INCREMENT,
  student_id INT NOT NULL,
  assessment_type_id INT NOT NULL,
  score DECIMAL(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
  term VARCHAR(20) NOT NULL,
  academic_year VARCHAR(20) NOT NULL,
  published BOOLEAN DEFAULT TRUE,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assessment_type_id) REFERENCES assessment_types(id) ON DELETE CASCADE,
  UNIQUE KEY unique_assessment_score (student_id, assessment_type_id, term, academic_year),
  INDEX idx_student_id (student_id),
  INDEX idx_assessment_type (assessment_type_id),
  INDEX idx_term_year (term, academic_year)
);

-- ============================================================
-- RANKING & REGISTRATION TABLES
-- ============================================================

-- Ranking approvals (director approval for rankings)
CREATE TABLE ranking_approvals (
  id INT PRIMARY KEY AUTO_INCREMENT,
  grade_level INT NOT NULL,
  stream VARCHAR(50),
  section VARCHAR(50),
  sub_section VARCHAR(10),
  term VARCHAR(20) NOT NULL,
  academic_year VARCHAR(20) NOT NULL,
  approved_by INT NOT NULL,
  approved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_ranking_approval (grade_level, stream, section, sub_section, term, academic_year),
  INDEX idx_grade_stream (grade_level, stream),
  INDEX idx_term_year (term, academic_year)
);

-- Student registrations (course registration tracking)
CREATE TABLE student_registrations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  student_id INT NOT NULL,
  academic_year VARCHAR(20) NOT NULL,
  term VARCHAR(20) DEFAULT 'Fall',
  registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('registered', 'withdrawn', 'pending') DEFAULT 'registered',
  total_credit_hours INT DEFAULT 0,
  total_ects INT DEFAULT 0,
  advisor_approved BOOLEAN DEFAULT FALSE,
  registrar_approved BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_registration (student_id, academic_year, term),
  INDEX idx_student_year (student_id, academic_year),
  INDEX idx_status (status)
);

-- Course enrollments (enrolled courses per registration)
CREATE TABLE course_enrollments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  registration_id INT NOT NULL,
  subject_id INT NOT NULL,
  credit_hours INT DEFAULT 3,
  ects INT DEFAULT 5,
  instructor VARCHAR(255) DEFAULT 'TBA',
  enrollment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (registration_id) REFERENCES student_registrations(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  INDEX idx_registration (registration_id),
  INDEX idx_subject (subject_id)
);

-- ============================================================
-- ACADEMIC YEAR ARCHIVING TABLES
-- ============================================================

-- Academic year results (archived subject results)
CREATE TABLE academic_year_results (
  id INT PRIMARY KEY AUTO_INCREMENT,
  student_id INT NOT NULL,
  academic_year VARCHAR(20) NOT NULL,
  grade_level INT NOT NULL,
  stream VARCHAR(50),
  section VARCHAR(50),
  sub_section VARCHAR(10),
  subject_id INT NOT NULL,
  subject_name VARCHAR(100) NOT NULL,
  total_score DECIMAL(5,2) NOT NULL,
  archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  INDEX idx_student_year (student_id, academic_year),
  INDEX idx_grade_level (grade_level)
);

-- Academic year summaries (archived rankings)
CREATE TABLE academic_year_summaries (
  id INT PRIMARY KEY AUTO_INCREMENT,
  student_id INT NOT NULL,
  academic_year VARCHAR(20) NOT NULL,
  grade_level INT NOT NULL,
  stream VARCHAR(50),
  section VARCHAR(50),
  sub_section VARCHAR(10),
  total_score DECIMAL(7,2) NOT NULL,
  average_score DECIMAL(5,2) NOT NULL,
  rank_position INT NOT NULL,
  total_students INT NOT NULL,
  subject_count INT NOT NULL,
  status ENUM('promoted', 'retained', 'graduated') DEFAULT 'promoted',
  archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_student_year (student_id, academic_year),
  INDEX idx_student_year (student_id, academic_year),
  INDEX idx_grade_level (grade_level),
  INDEX idx_rank (rank_position)
);

-- ============================================================
-- RELATIONSHIP & UTILITY TABLES
-- ============================================================

-- Parent-Student relationship
CREATE TABLE parent_students (
  id INT PRIMARY KEY AUTO_INCREMENT,
  parent_id INT NOT NULL,
  student_id INT NOT NULL,
  relationship ENUM('father', 'mother', 'guardian') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_parent_student (parent_id, student_id),
  INDEX idx_parent_id (parent_id),
  INDEX idx_student_id (student_id)
);

-- System settings
CREATE TABLE system_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Credentials log (tracking created user credentials)
CREATE TABLE credentials_log (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  username VARCHAR(100) NOT NULL,
  password VARCHAR(100) NOT NULL,
  role VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_role (role),
  INDEX idx_created_at (created_at)
);

-- ============================================================
-- DEFAULT DATA
-- ============================================================

-- Insert default system settings
INSERT INTO system_settings (setting_key, setting_value) VALUES
('system_locked', 'false'),
('current_academic_year', '2024-2025'),
('current_term', 'Term 1');

-- Insert default subjects
INSERT INTO subjects (subject_name, subject_code, description, credit_hours, ects, grade_level, stream) VALUES
('Mathematics', 'MATH101', 'Core Mathematics', 3, 5, 9, 'Common'),
('English', 'ENG101', 'English Language and Literature', 3, 5, 9, 'Common'),
('Physics', 'PHY101', 'Physics - Science Stream', 3, 5, 9, 'Science'),
('Chemistry', 'CHEM101', 'Chemistry - Science Stream', 3, 5, 9, 'Science'),
('Biology', 'BIO101', 'Biology - Science Stream', 3, 5, 9, 'Science'),
('History', 'HIST101', 'History - Arts Stream', 3, 5, 9, 'Arts'),
('Geography', 'GEO101', 'Geography', 3, 5, 9, 'Common'),
('Economics', 'ECON101', 'Economics - Commerce Stream', 3, 5, 9, 'Commerce'),
('Business Studies', 'BUS101', 'Business Studies - Commerce Stream', 3, 5, 9, 'Commerce'),
('Computer Science', 'CS101', 'Computer Science', 3, 5, 9, 'Common');

-- ============================================================
-- SCHEMA COMPLETE
-- ============================================================
-- Total Tables: 20
-- Core: 5 (users, user_roles, profiles, student_profiles, subjects)
-- Teachers: 4 (teacher_subjects, teacher_sections, teacher_sub_sections, teacher_requests)
-- Grading: 3 (grades, assessment_types, assessment_scores)
-- Rankings: 3 (ranking_approvals, student_registrations, course_enrollments)
-- Archiving: 2 (academic_year_results, academic_year_summaries)
-- Utility: 3 (parent_students, system_settings, credentials_log)
-- ============================================================
