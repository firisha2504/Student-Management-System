// API service for backend communication
const API_BASE_URL = 'http://localhost:5001/api';
const BACKEND_URL = 'http://localhost:5001';

// Get auth token from localStorage
const getAuthToken = () => localStorage.getItem('auth_token');

// Helper to construct full asset URLs
export const getAssetUrl = (path: string | null) => {
  if (!path) return null;
  // If path already includes http, return as is
  if (path.startsWith('http')) return path;
  // Otherwise, prepend backend URL
  return `${BACKEND_URL}${path}`;
};

// API request helper
async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const token = getAuthToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (options.headers) {
    Object.assign(headers, options.headers);
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }
  
  return response.json();
}

export const api = {
  // Auth
  async login(username: string, password: string) {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    
    if (data.token) {
      localStorage.setItem('auth_token', data.token);
    }
    
    return data;
  },
  
  async logout() {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } finally {
      localStorage.removeItem('auth_token');
    }
  },
  
  async getProfile() {
    // Add cache-busting parameter to ensure fresh data
    const timestamp = Date.now();
    return apiRequest(`/auth/me?_t=${timestamp}`);
  },

  // Profile
  async updateProfile(data: { full_name?: string; phone?: string; address?: string; date_of_birth?: string; gender?: string; grade_level?: number; stream?: string; section?: string }) {
    return apiRequest('/profile/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async uploadProfileImage(file: File) {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(`${API_BASE_URL}/profile/me/image`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || 'Upload failed');
    }

    return response.json();
  },

  async deleteProfileImage() {
    return apiRequest('/profile/me/image', {
      method: 'DELETE',
    });
  },

  async changePassword(currentPassword: string, newPassword: string) {
    return apiRequest('/profile/me/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  async changeUsername(newUsername: string) {
    return apiRequest('/profile/me/change-username', {
      method: 'POST',
      body: JSON.stringify({ newUsername }),
    });
  },

  // Admin - Users
  async getNextId(role: string) {
    return apiRequest(`/users/next-id/${role}`);
  },

  async getAllUsers() {
    return apiRequest('/users');
  },

  async createUser(data: { email: string; full_name: string; role: string; phone?: string; address?: string; gender?: string }) {
    return apiRequest('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async toggleUserStatus(userId: string, isActive: boolean) {
    return apiRequest(`/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: isActive }),
    });
  },

  async deleteUser(userId: string) {
    return apiRequest(`/users/${userId}`, {
      method: 'DELETE',
    });
  },

  async getCredentialsLog() {
    return apiRequest('/users/credentials-log');
  },

  // Admin - System
  async getSystemSettings() {
    return apiRequest('/admin/system-settings');
  },

  async updateSystemLock(locked: boolean) {
    return apiRequest('/admin/system-lock', {
      method: 'PATCH',
      body: JSON.stringify({ locked }),
    });
  },

  async promoteStudents(nextAcademicYear?: string) {
    return apiRequest('/admin/promote-students', {
      method: 'POST',
      body: JSON.stringify({ next_academic_year: nextAcademicYear }),
    });
  },

  async rollbackPromotion(academicYear: string) {
    return apiRequest('/admin/rollback-promotion', {
      method: 'POST',
      body: JSON.stringify({ academic_year: academicYear }),
    });
  },

  async getDashboardStats(filters?: { grade_level?: string; stream?: string }) {
    const params = new URLSearchParams();
    if (filters?.grade_level) params.append('grade_level', filters.grade_level);
    if (filters?.stream) params.append('stream', filters.stream);
    
    const queryString = params.toString();
    return apiRequest(`/admin/dashboard-stats${queryString ? '?' + queryString : ''}`);
  },

  // Students
  async getStudentStats() {
    return apiRequest('/students/me/stats');
  },

  async getStudents(filters?: { grade_level?: number; stream?: string; section?: string }) {
    const params = new URLSearchParams();
    if (filters?.grade_level) params.append('grade_level', filters.grade_level.toString());
    if (filters?.stream) params.append('stream', filters.stream);
    if (filters?.section) params.append('section', filters.section);
    
    return apiRequest(`/students?${params.toString()}`);
  },

  async updateStudent(studentId: string, data: { full_name?: string; phone?: string; address?: string; date_of_birth?: string; gender?: string; grade_level?: number; stream?: string; section?: string; sub_section?: string | null }) {
    return apiRequest(`/students/${studentId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Subjects
  async getAllSubjects(filters?: { grade_level?: number; stream?: string }) {
    const params = new URLSearchParams();
    if (filters?.grade_level) params.append('grade_level', filters.grade_level.toString());
    if (filters?.stream) params.append('stream', filters.stream);
    
    return apiRequest(`/subjects?${params.toString()}`);
  },

  async createSubject(data: { subject_name: string; subject_code: string; description?: string; credit_hours: number; ects: number; grade_level?: number; stream?: string | null }) {
    return apiRequest('/subjects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateSubject(subjectId: number, data: { subject_name?: string; subject_code?: string; description?: string; credit_hours?: number; ects?: number; grade_level?: number; stream?: string }) {
    return apiRequest(`/subjects/${subjectId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async deleteSubject(subjectId: number) {
    return apiRequest(`/subjects/${subjectId}`, {
      method: 'DELETE',
    });
  },

  async getAllTeachers() {
    return apiRequest('/subjects/teachers/list');
  },

  async assignTeacherToSubject(data: { teacher_id: number; subject_id: number; grade_level: number; stream?: string }) {
    return apiRequest('/subjects/assign-teacher', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async removeTeacherAssignment(assignmentId: number) {
    return apiRequest(`/subjects/assign-teacher/${assignmentId}`, {
      method: 'DELETE',
    });
  },

  // Registration
  async getRegistrationStatus() {
    return apiRequest('/registration/my-status');
  },

  async getAvailableCourses() {
    return apiRequest('/registration/available-courses');
  },

  async registerCourses(courses: { subject_id: number; credit_hours: number; ects: number; instructor?: string }[]) {
    return apiRequest('/registration/register', {
      method: 'POST',
      body: JSON.stringify({ courses }),
    });
  },

  async getAllRegistrations(filters?: { academic_year?: string; status?: string; grade_level?: number }) {
    const params = new URLSearchParams();
    if (filters?.academic_year) params.append('academic_year', filters.academic_year);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.grade_level) params.append('grade_level', filters.grade_level.toString());
    
    return apiRequest(`/registration/all?${params.toString()}`);
  },

  async approveRegistration(registrationId: number, approved: boolean) {
    return apiRequest(`/registration/${registrationId}/approve`, {
      method: 'PATCH',
      body: JSON.stringify({ approved }),
    });
  },

  // Registration Period Management
  async getRegistrationPeriodSettings() {
    return apiRequest('/registration/period-settings');
  },

  async updateRegistrationPeriodSettings(settings: {
    registration_open: boolean;
    registration_start_date?: string;
    registration_end_date?: string;
    registration_academic_year?: string;
  }) {
    return apiRequest('/registration/period-settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  },

  async isRegistrationOpen() {
    return apiRequest('/registration/is-open');
  },

  async getUnregisteredStudents(academicYear?: string) {
    const params = new URLSearchParams();
    if (academicYear) params.append('academic_year', academicYear);
    
    return apiRequest(`/registration/unregistered?${params.toString()}`);
  },

  // Admin - Logo
  async uploadSchoolLogo(file: File) {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append('logo', file);

    const response = await fetch(`${API_BASE_URL}/admin/upload-logo`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || 'Upload failed');
    }

    return response.json();
  },

  async deleteSchoolLogo() {
    return apiRequest('/admin/delete-logo', {
      method: 'DELETE',
    });
  },

  // Rankings
  async getRankings(filters: { grade_level: number; stream?: string; term?: string; academic_year?: string }) {
    const params = new URLSearchParams();
    params.append('grade_level', filters.grade_level.toString());
    if (filters.stream) params.append('stream', filters.stream);
    if (filters.term) params.append('term', filters.term);
    if (filters.academic_year) params.append('academic_year', filters.academic_year);
    
    return apiRequest(`/rankings/by-grade?${params.toString()}`);
  },

  async approveRankings(data: { grade_level: number; stream?: string; term: string; academic_year: string }) {
    return apiRequest('/rankings/approve', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async approveAllRankings(data: { term: string; academic_year: string }) {
    return apiRequest('/rankings/approve-all', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async unpublishRankings(data: { grade_level: number; stream?: string; term: string; academic_year: string }) {
    return apiRequest('/rankings/approve', {
      method: 'DELETE',
      body: JSON.stringify(data),
    });
  },

  async getRankingApprovalStatus(filters: { grade_level: number; stream?: string; term?: string; academic_year?: string }) {
    const params = new URLSearchParams();
    params.append('grade_level', filters.grade_level.toString());
    if (filters.stream) params.append('stream', filters.stream);
    if (filters.term) params.append('term', filters.term);
    if (filters.academic_year) params.append('academic_year', filters.academic_year);
    
    return apiRequest(`/rankings/approval-status?${params.toString()}`);
  },

  async getTop10Rankings(filters?: { term?: string; academic_year?: string }) {
    const params = new URLSearchParams();
    if (filters?.term) params.append('term', filters.term);
    if (filters?.academic_year) params.append('academic_year', filters.academic_year);
    
    const queryString = params.toString();
    return apiRequest(`/rankings/top10${queryString ? '?' + queryString : ''}`);
  },

  // Assessments
  async getAssessmentTypes(filters: { subject_id: number; grade_level: number; stream?: string; section?: string; sub_section?: string }) {
    const params = new URLSearchParams();
    params.append('subject_id', filters.subject_id.toString());
    params.append('grade_level', filters.grade_level.toString());
    if (filters.stream) params.append('stream', filters.stream);
    if (filters.section) params.append('section', filters.section);
    if (filters.sub_section) params.append('sub_section', filters.sub_section);
    
    return apiRequest(`/assessments/types?${params.toString()}`);
  },

  async createAssessmentType(data: { subject_id: number; grade_level: number; stream?: string; section?: string; sub_section?: string; assessment_name: string; weight: number }) {
    return apiRequest('/assessments/types', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateAssessmentType(typeId: number, data: { assessment_name?: string; weight?: number }) {
    return apiRequest(`/assessments/types/${typeId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async deleteAssessmentType(typeId: number) {
    return apiRequest(`/assessments/types/${typeId}`, {
      method: 'DELETE',
    });
  },

  async getAssessmentScores(filters?: { student_id?: number; assessment_type_id?: number; term?: string; academic_year?: string }) {
    const params = new URLSearchParams();
    if (filters?.student_id) params.append('student_id', filters.student_id.toString());
    if (filters?.assessment_type_id) params.append('assessment_type_id', filters.assessment_type_id.toString());
    if (filters?.term) params.append('term', filters.term);
    if (filters?.academic_year) params.append('academic_year', filters.academic_year);
    
    return apiRequest(`/assessments/scores?${params.toString()}`);
  },

  async uploadAssessmentScore(data: { student_id: number; assessment_type_id: number; score: number; term: string; academic_year: string; remarks?: string; published?: boolean }) {
    return apiRequest('/assessments/scores', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async bulkUploadAssessmentScores(data: { scores: { student_id: number; assessment_type_id: number; score: number; remarks?: string }[]; term: string; academic_year: string }) {
    return apiRequest('/assessments/scores/bulk', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deleteAssessmentScore(scoreId: number) {
    return apiRequest(`/assessments/scores/${scoreId}`, {
      method: 'DELETE',
    });
  },

  // Academic Year
  async archiveAcademicYear(academicYear: string) {
    return apiRequest('/academic-year/archive', {
      method: 'POST',
      body: JSON.stringify({ academic_year: academicYear }),
    });
  },

  async getAcademicHistory(studentId: number) {
    return apiRequest(`/academic-year/history/${studentId}`);
  },

  async getArchivedYears() {
    return apiRequest('/academic-year/archived-years');
  },

  async getCurrentAcademicYear() {
    return apiRequest('/academic-year/current');
  },

  async setCurrentAcademicYear(data: { academic_year?: string; term?: string }) {
    return apiRequest('/academic-year/current', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async deleteArchivedYear(academicYear: string) {
    return apiRequest(`/academic-year/archive/${academicYear}`, {
      method: 'DELETE',
    });
  },

  async promoteStudentsYearEnd(data: { current_year: string; next_year: string }) {
    return apiRequest('/academic-year/promote', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Parents
  async getAllParents() {
    return apiRequest('/parents');
  },

  async getLinkedParents(studentId: string) {
    return apiRequest(`/parents/student/${studentId}`);
  },

  async linkParentToStudent(data: { parent_id: number; student_id: number; relationship?: string }) {
    return apiRequest('/parents/link', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async unlinkParentFromStudent(data: { parent_id: number; student_id: number }) {
    return apiRequest('/parents/unlink', {
      method: 'DELETE',
      body: JSON.stringify(data),
    });
  },

  // Parent Portal (for logged-in parents)
  async getMyChildren() {
    return apiRequest('/parents/me/children');
  },

  async getChildGrades(studentId: string) {
    return apiRequest(`/parents/children/${studentId}/grades`);
  },

  async getChildRanking(studentId: string, filters?: { term?: string; academic_year?: string }) {
    const params = new URLSearchParams();
    if (filters?.term) params.append('term', filters.term);
    if (filters?.academic_year) params.append('academic_year', filters.academic_year);
    
    const queryString = params.toString();
    return apiRequest(`/parents/children/${studentId}/ranking${queryString ? '?' + queryString : ''}`);
  },

  // Teacher Assignments
  async getTeacherAssignments(teacherId: number) {
    return apiRequest(`/teacher-assignments/${teacherId}`);
  },

  async getMyAssignments() {
    return apiRequest('/teacher-assignments/me');
  },

  async saveTeacherAssignments(teacherId: number, data: { subjects: number[]; grades: number[]; sections: string[]; subSections: string[] }) {
    return apiRequest(`/teacher-assignments/${teacherId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Teacher Requests
  async submitTeacherRequest(data: { 
    full_name: string; 
    email: string; 
    phone?: string; 
    subject_specialization?: string; 
    qualifications?: string; 
    experience_years?: number 
  }) {
    return apiRequest('/teacher-requests/submit', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getTeacherRequests(status?: string) {
    const params = status ? `?status=${status}` : '';
    return apiRequest(`/teacher-requests${params}`);
  },

  async approveTeacherRequest(requestId: number) {
    return apiRequest(`/teacher-requests/${requestId}/approve`, {
      method: 'POST',
    });
  },

  async rejectTeacherRequest(requestId: number) {
    return apiRequest(`/teacher-requests/${requestId}/reject`, {
      method: 'POST',
    });
  },

  async deleteTeacherRequest(requestId: number) {
    return apiRequest(`/teacher-requests/${requestId}`, {
      method: 'DELETE',
    });
  },

  // Homeroom
  async getMyHomeroom() {
    return apiRequest('/homeroom/my-homeroom');
  },

  async getMyHomeroomStudents() {
    return apiRequest('/homeroom/my-students');
  },

  async getMyClassRankings(filters?: { term?: string; academic_year?: string }) {
    const params = new URLSearchParams();
    if (filters?.term) params.append('term', filters.term);
    if (filters?.academic_year) params.append('academic_year', filters.academic_year);
    
    const queryString = params.toString();
    return apiRequest(`/homeroom/my-class-rankings${queryString ? '?' + queryString : ''}`);
  },

  async assignHomeroomTeacher(data: { teacher_id: number; grade_level: number; section?: string; sub_section?: string; stream?: string; academic_year: string }) {
    return apiRequest('/homeroom/assign', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateHomeroomAssignment(id: number, data: { teacher_id: number; grade_level: number; section?: string; sub_section?: string; stream?: string; academic_year: string }) {
    return apiRequest(`/homeroom/assign/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async getHomeroomAssignments(filters?: { academic_year?: string }) {
    const params = new URLSearchParams();
    if (filters?.academic_year) params.append('academic_year', filters.academic_year);
    
    const queryString = params.toString();
    return apiRequest(`/homeroom/assignments${queryString ? '?' + queryString : ''}`);
  },

  async removeHomeroomAssignment(id: number) {
    return apiRequest(`/homeroom/assign/${id}`, {
      method: 'DELETE',
    });
  },
};
