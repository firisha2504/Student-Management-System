-- Student Management System Database Schema

-- Disable foreign key checks temporarily
SET FOREIGN_KEY_CHECKS = 0;

-- Drop existing tables if they exist
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
  grade_level INT NOT NULL,
  stream ENUM('Science', 'Arts', 'Commerce'),
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_subject_name (subject_name)
);

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

-- Grades table
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

-- System settings
CREATE TABLE system_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert default system settings
INSERT INTO system_settings (setting_key, setting_value) VALUES
('system_locked', 'false'),
('current_academic_year', '2024-2025'),
('current_term', 'Term 1');

-- Insert default subjects
INSERT INTO subjects (subject_name, subject_code, description) VALUES
('Mathematics', 'MATH101', 'Core Mathematics'),
('English', 'ENG101', 'English Language and Literature'),
('Physics', 'PHY101', 'Physics - Science Stream'),
('Chemistry', 'CHEM101', 'Chemistry - Science Stream'),
('Biology', 'BIO101', 'Biology - Science Stream'),
('History', 'HIST101', 'History - Arts Stream'),
('Geography', 'GEO101', 'Geography'),
('Economics', 'ECON101', 'Economics - Commerce Stream'),
('Business Studies', 'BUS101', 'Business Studies - Commerce Stream'),
('Computer Science', 'CS101', 'Computer Science');


-- Credentials log table (for tracking created user credentials)
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
