// API service for backend communication
const API_BASE_URL = 'http://localhost:5000/api';

// Get auth token from localStorage
const getAuthToken = () => localStorage.getItem('auth_token');

// API request helper
async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const token = getAuthToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
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
    localStorage.removeItem('auth_token');
    return apiRequest('/auth/logout', { method: 'POST' });
  },
  
  async getProfile() {
    return apiRequest('/auth/me');
  },

  // Profile
  async updateProfile(data: { full_name?: string; phone?: string; address?: string; date_of_birth?: string; gender?: string }) {
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
  async getAllUsers() {
    return apiRequest('/users');
  },

  async createUser(data: { email: string; password: string; full_name: string; role: string; phone?: string; address?: string; gender?: string; custom_username?: string }) {
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

  async promoteStudents(academicYear?: string) {
    return apiRequest('/admin/promote-students', {
      method: 'POST',
      body: JSON.stringify({ academic_year: academicYear }),
    });
  },

  async getDashboardStats() {
    return apiRequest('/admin/dashboard-stats');
  },

  // Students
  async getStudentStats() {
    return apiRequest('/students/me/stats');
  },

  // Subjects
  async getAllSubjects(filters?: { grade_level?: number; stream?: string }) {
    const params = new URLSearchParams();
    if (filters?.grade_level) params.append('grade_level', filters.grade_level.toString());
    if (filters?.stream) params.append('stream', filters.stream);
    
    return apiRequest(`/subjects?${params.toString()}`);
  },

  async createSubject(data: { subject_name: string; subject_code: string; description?: string; credit_hours: number; ects: number; grade_level?: number; stream?: string }) {
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
};
