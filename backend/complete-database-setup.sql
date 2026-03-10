-- Complete Database Setup for Grade Hub System
-- Run this after the main schema.sql to add all missing tables

-- 3. Create ranking_approvals table
CREATE TABLE IF NOT EXISTS ranking_approvals (
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

-- 4. Create student_registrations table
CREATE TABLE IF NOT EXISTS student_registrations (
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

-- 5. Create course_enrollments table
CREATE TABLE IF NOT EXISTS course_enrollments (
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

-- 6. Create assessment_types table (for flexible assessment configuration)
CREATE TABLE IF NOT EXISTS assessment_types (
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

-- 7. Create assessment_scores table (replaces simple grades table for detailed scoring)
CREATE TABLE IF NOT EXISTS assessment_scores (
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

-- 8. Create academic_year_results table (for archived results)
CREATE TABLE IF NOT EXISTS academic_year_results (
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

-- 9. Create academic_year_summaries table (for student rankings archive)
CREATE TABLE IF NOT EXISTS academic_year_summaries (
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

-- 10. Create teacher_sections table (for section assignments)
CREATE TABLE IF NOT EXISTS teacher_sections (
  id INT PRIMARY KEY AUTO_INCREMENT,
  teacher_id INT NOT NULL,
  section VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_teacher_section (teacher_id, section),
  INDEX idx_teacher_id (teacher_id)
);

-- 11. Create teacher_sub_sections table (for sub-section assignments)
CREATE TABLE IF NOT EXISTS teacher_sub_sections (
  id INT PRIMARY KEY AUTO_INCREMENT,
  teacher_id INT NOT NULL,
  sub_section VARCHAR(10) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_teacher_sub_section (teacher_id, sub_section),
  INDEX idx_teacher_id (teacher_id)
);

-- Update existing subjects with default values
UPDATE subjects SET 
  credit_hours = COALESCE(credit_hours, 3),
  ects = COALESCE(ects, 5),
  stream = COALESCE(stream, 'Common'),
  grade_level = COALESCE(grade_level, 9)
WHERE credit_hours IS NULL OR ects IS NULL;

-- Update specific subjects for streams
UPDATE subjects SET stream = 'Science' WHERE subject_code IN ('PHY101', 'CHEM101', 'BIO101');
UPDATE subjects SET stream = 'Arts' WHERE subject_code IN ('HIST101');
UPDATE subjects SET stream = 'Commerce' WHERE subject_code IN ('ECON101', 'BUS101');
UPDATE subjects SET stream = 'Common' WHERE subject_code IN ('MATH101', 'ENG101', 'GEO101', 'CS101');
