import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useGradeLevels, useStreams, useSections, useSubSections } from "@/contexts/SchoolConfigContext";
import { api } from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Users, GraduationCap, BarChart3, Trophy, Eye,
  Menu, ChevronLeft, ChevronRight, PieChart as PieChartIcon, Medal, Printer, BookOpen, CheckCheck,
  Search, ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import SuccessModal from "@/components/SuccessModal";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line
} from "recharts";

interface UserWithRole {
  user_id: string;
  full_name: string;
  username: string;
  id_number: string;
  is_active: boolean;
  role: string;
  assignedSubjects?: string[];
  assignedGrades?: number[];
}

interface RankingEntry {
  user_id: string;
  full_name: string;
  section: string | null;
  average: number;
  rank: number;
}

interface OverallRankingEntry {
  user_id: string;
  full_name: string;
  grade_level: number;
  section: string | null;
  stream: string | null;
  average: number;
  rank: number;
}

interface StudentProfile {
  user_id: string;
  full_name: string;
  username: string;
  id_number: string;
  grade_level: number | null;
  stream: string | null;
  section: string | null;
  sub_section: string | null;
  gender: string | null;
  is_active: boolean;
}

type DirectorSection = "students" | "teachers" | "rankings" | "top10" | "performance" | "homeroom";

const sidebarItems: { id: DirectorSection; label: string; icon: React.ElementType }[] = [
  { id: "students", label: "Students", icon: GraduationCap },
  { id: "teachers", label: "Teachers", icon: Users },
  { id: "rankings", label: "Rankings", icon: Trophy },
  { id: "top10", label: "Top 10 Overall", icon: Medal },
  { id: "performance", label: "Performance", icon: BarChart3 },
  { id: "homeroom", label: "Homeroom", icon: BookOpen },
];

const CHART_COLORS = [
  "hsl(234, 85%, 60%)", "hsl(262, 80%, 60%)", "hsl(340, 75%, 55%)",
  "hsl(160, 60%, 45%)", "hsl(30, 85%, 55%)", "hsl(200, 70%, 50%)",
];

const GENDER_COLORS = { male: "hsl(220, 70%, 55%)", female: "hsl(340, 70%, 55%)" };

export default function DirectorPortal() {
  const { role } = useAuth();
  const { toast } = useToast();
  const gradeLevels = useGradeLevels();
  const streams = useStreams();
  const sections = useSections();
  const subSections = useSubSections();
  const [teachers, setTeachers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);

  // Students
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [studentFilterGrade, setStudentFilterGrade] = useState("all");
  const [studentFilterStream, setStudentFilterStream] = useState("all");
  const [collapsedGrades, setCollapsedGrades] = useState<Set<string>>(new Set());
  const [collapsedSubSections, setCollapsedSubSections] = useState<Set<string>>(new Set());
  const [activeSection, setActiveSection] = useState<DirectorSection>("teachers");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Assign dialog
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assigningTeacher, setAssigningTeacher] = useState<UserWithRole | null>(null);
  const [allSubjects, setAllSubjects] = useState<{ id: string; subject_name: string; grade_level: number; stream: string | null }[]>([]);
  const [assignedSubjectIds, setAssignedSubjectIds] = useState<string[]>([]);
  const [assignedGradeLevels, setAssignedGradeLevels] = useState<number[]>([]);
  const [assignedSections, setAssignedSections] = useState<string[]>([]);
  const [assignedSubSections, setAssignedSubSections] = useState<string[]>([]);
  const [savingAssignments, setSavingAssignments] = useState(false);

  // Rankings
  const [rankGrade, setRankGrade] = useState("9");
  const [rankTerm, setRankTerm] = useState("Semester 1");
  const [rankStream, setRankStream] = useState("");
  const [rankSection, setRankSection] = useState("");
  const [rankSubSection, setRankSubSection] = useState("");
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [loadingRankings, setLoadingRankings] = useState(false);
  const [rankingsPublished, setRankingsPublished] = useState(false);
  const [publishingRankings, setPublishingRankings] = useState(false);
  const [bulkApproving, setBulkApproving] = useState(false);

  // Top 10 Overall
  const [top10Rankings, setTop10Rankings] = useState<OverallRankingEntry[]>([]);
  const [loadingTop10, setLoadingTop10] = useState(false);

  // Stats
  const [stats, setStats] = useState<{
    totalStudents: number;
    totalTeachers: number;
    subjectAverages: { name: string; average: number }[];
    genderStats: { name: string; value: number }[];
    scoreDistribution: { range: string; count: number }[];
    yearlyTrends: { year: string; average: number }[];
  } | null>(null);

  // Performance filters
  const [perfGrade, setPerfGrade] = useState("all");
  const [perfStream, setPerfStream] = useState("all");

  // Homeroom
  const [homeroomAssignments, setHomeroomAssignments] = useState<any[]>([]);
  const [loadingHomeroom, setLoadingHomeroom] = useState(false);
  const [homeroomDialogOpen, setHomeroomDialogOpen] = useState(false);
  const [selectedHomeroomTeacher, setSelectedHomeroomTeacher] = useState<number | null>(null);
  const [editingAssignmentId, setEditingAssignmentId] = useState<number | null>(null);
  const [homeroomGrade, setHomeroomGrade] = useState<number>(9);
  const [homeroomSection, setHomeroomSection] = useState<string>("all");
  const [homeroomSubSection, setHomeroomSubSection] = useState<string>("all");
  const [homeroomStream, setHomeroomStream] = useState<string>("all");
  const [savingHomeroom, setSavingHomeroom] = useState(false);

  const [successModal, setSuccessModal] = useState<{ title: string; description?: string } | null>(null);

  const fetchStudents = async () => {
    setLoadingStudents(true);
    try {
      const data = await api.getAllUsers();
      const studentProfiles: StudentProfile[] = data
        .filter((u: any) => u.role === 'student')
        .map((u: any) => ({
          user_id: u.user_id,
          full_name: u.full_name,
          username: u.username,
          id_number: u.id_number || u.admission_number || '—',
          grade_level: u.grade_level,
          stream: u.stream,
          section: u.section,
          sub_section: u.sub_section,
          gender: u.gender,
          is_active: u.is_active,
        }));
      setStudents(studentProfiles);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to load students", variant: "destructive" });
    }
    setLoadingStudents(false);
  };

  const fetchTeachers = async () => {
    setLoading(true);
    try {
      const data = await api.getAllUsers();
      const teacherUsers = data.filter((u: any) => u.role === 'teacher');

      // Fetch assignments for all teachers in parallel
      const withAssignments = await Promise.all(
        teacherUsers.map(async (u: any) => {
          try {
            const a = await api.getTeacherAssignments(parseInt(u.user_id));
            return {
              user_id: u.user_id,
              full_name: u.full_name,
              username: u.username,
              id_number: u.id_number || 'N/A',
              is_active: u.is_active,
              role: "teacher",
              _subjectIds: a.subjects || [],
              assignedGrades: a.grades || [],
            };
          } catch {
            return {
              user_id: u.user_id,
              full_name: u.full_name,
              username: u.username,
              id_number: u.id_number || 'N/A',
              is_active: u.is_active,
              role: "teacher",
              _subjectIds: [],
              assignedGrades: [],
            };
          }
        })
      );

      // Fetch all subjects once to resolve names + codes
      const allSubs = await api.getAllSubjects();
      const subjectMap: Record<number, string> = {};
      allSubs.forEach((s: any) => {
        // Show: "Biology (G9)" format so same-name subjects across grades are distinct
        const gradeLabel = s.grade_level ? ` (G${s.grade_level})` : '';
        subjectMap[s.id] = `${s.subject_name}${gradeLabel}`;
      });

      setTeachers(withAssignments.map((t: any) => ({
        ...t,
        // Keep all subject IDs (no dedup by name — each grade is distinct)
        assignedSubjects: [...new Set(t._subjectIds as number[])]
          .map((id: number) => subjectMap[id])
          .filter(Boolean),
      })));
    } catch (error: any) {
      console.error('Failed to fetch teachers:', error);
      toast({ title: "Error", description: "Failed to load teachers", variant: "destructive" });
      setTeachers([]);
    }
    setLoading(false);
  };

  const fetchStats = async () => {
    try {
      const filters: any = {};
      if (perfGrade !== 'all') filters.grade_level = perfGrade;
      if (perfStream !== 'all') filters.stream = perfStream;
      
      const statsData = await api.getDashboardStats(filters);

      setStats({
        totalStudents: statsData.totalStudents || 0,
        totalTeachers: statsData.totalTeachers || 0,
        subjectAverages: statsData.subjectAverages || [],
        genderStats: statsData.genderStats || [],
        scoreDistribution: statsData.scoreDistribution || [],
        yearlyTrends: statsData.yearlyTrends || [],
      });
    } catch (error: any) {
      console.error('Failed to fetch stats:', error);
      toast({ title: "Error", description: "Failed to load statistics", variant: "destructive" });
    }
  };

  useEffect(() => { fetchTeachers(); }, []);
  useEffect(() => { fetchStats(); }, [perfGrade, perfStream]);
  useEffect(() => {
    if (activeSection === 'homeroom') fetchHomeroomAssignments();
    if (activeSection === 'top10') fetchTop10();
    if (activeSection === 'students') fetchStudents();
  }, [activeSection]);

  const fetchTop10 = async () => {
    setLoadingTop10(true);
    try {
      const data = await api.getTop10Rankings();
      setTop10Rankings(data.rankings || []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to fetch top 10 rankings", variant: "destructive" });
    }
    setLoadingTop10(false);
  };

  const fetchHomeroomAssignments = async () => {
    setLoadingHomeroom(true);
    try {
      // Get current academic year from system settings instead of calculating
      const yearData = await api.getCurrentAcademicYear();
      const currentAcademicYear = yearData?.academic_year || '2018 E.C.';
      const data = await api.getHomeroomAssignments({ academic_year: currentAcademicYear });
      setHomeroomAssignments(data || []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to fetch homeroom assignments", variant: "destructive" });
    }
    setLoadingHomeroom(false);
  };

  const openHomeroomDialog = (teacherId: number) => {
    setSelectedHomeroomTeacher(teacherId);
    setEditingAssignmentId(null); // Reset editing state for new assignment
    setHomeroomGrade(9);
    setHomeroomSection("all");
    setHomeroomSubSection("all");
    setHomeroomStream("all");
    setHomeroomDialogOpen(true);
  };

  const assignHomeroom = async () => {
    if (!selectedHomeroomTeacher) return;
    setSavingHomeroom(true);
    try {
      // Get current academic year from system settings
      const yearData = await api.getCurrentAcademicYear();
      const currentAcademicYear = yearData?.academic_year || '2018 E.C.';
      
      const assignmentData = {
        teacher_id: selectedHomeroomTeacher,
        grade_level: homeroomGrade,
        section: homeroomSection === "all" ? undefined : homeroomSection,
        sub_section: homeroomSubSection === "all" ? undefined : homeroomSubSection,
        stream: homeroomStream === "all" ? undefined : homeroomStream,
        academic_year: currentAcademicYear,
      };

      if (editingAssignmentId) {
        // Update existing assignment
        await api.updateHomeroomAssignment(editingAssignmentId, assignmentData);
        setSuccessModal({ 
          title: "Homeroom Updated", 
          description: "Homeroom assignment has been updated successfully" 
        });
      } else {
        // Create new assignment
        await api.assignHomeroomTeacher(assignmentData);
        setSuccessModal({ 
          title: "Homeroom Assigned", 
          description: "Teacher has been assigned as homeroom teacher" 
        });
      }
      
      setHomeroomDialogOpen(false);
      setEditingAssignmentId(null); // Reset editing state
      await fetchHomeroomAssignments();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to save homeroom assignment", variant: "destructive" });
    }
    setSavingHomeroom(false);
  };

  // Homeroom removal confirmation
  const [removeHomeroomConfirm, setRemoveHomeroomConfirm] = useState<number | null>(null);

  const removeHomeroom = async (assignmentId: number) => {
    try {
      await api.removeHomeroomAssignment(assignmentId);
      setSuccessModal({ title: "Homeroom Removed", description: "Homeroom assignment has been removed" });
      await fetchHomeroomAssignments();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to remove homeroom", variant: "destructive" });
    }
    setRemoveHomeroomConfirm(null);
  };

  const editHomeroom = (assignment: any) => {
    // Pre-fill the dialog with current assignment data
    setSelectedHomeroomTeacher(assignment.teacher_id);
    setEditingAssignmentId(assignment.id); // Set the assignment ID for editing
    setHomeroomGrade(assignment.grade_level);
    setHomeroomSection(assignment.section || "all");
    setHomeroomSubSection(assignment.sub_section || "all");
    setHomeroomStream(assignment.stream || "all");
    setHomeroomDialogOpen(true);
  };

  const printTop10 = () => {
    const rows = top10Rankings.map(r =>
      `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:bold">#${r.rank}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600">${r.full_name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">Grade ${r.grade_level}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-transform:capitalize">${r.section || "—"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-transform:capitalize">${r.stream || "—"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:bold">${r.average}%</td>
      </tr>`
    ).join("");

    const html = `<!DOCTYPE html>
<html><head><title>Top 10 Students Overall</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; color: #1a1a1a; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  p { color: #666; font-size: 13px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; }
  th { padding: 10px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #666; border-bottom: 2px solid #e5e7eb; }
  th:last-child { text-align: right; }
  .footer { margin-top: 32px; font-size: 11px; color: #999; text-align: center; }
  @media print { body { padding: 20px; } }
</style>
</head><body>
  <h1>🏆 Top 10 Students Overall — Grades 9-12</h1>
  <p>Generated on ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
  <table>
    <thead><tr><th>Rank</th><th>Name</th><th>Grade</th><th>Section</th><th>Stream</th><th>Average</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">School Management System — Confidential Report</div>
</body></html>`;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 300);
    }
  };

  if (role !== "director") return <p className="text-destructive">Access denied.</p>;

  const openAssignDialog = async (teacher: UserWithRole) => {
    setAssigningTeacher(teacher);
    try {
      const subjects = await api.getAllSubjects();
      // Normalize IDs to strings to ensure consistent comparison
      setAllSubjects((subjects || []).map((s: any) => ({ ...s, id: s.id.toString() })));
      
      // Load existing assignments
      const assignments = await api.getTeacherAssignments(parseInt(teacher.user_id));
      // Deduplicate subject IDs (same subject may appear for multiple grades)
      const uniqueSubjectIds = [...new Set((assignments.subjects as number[]).map((id: number) => id.toString()))];
      setAssignedSubjectIds(uniqueSubjectIds);
      setAssignedGradeLevels(assignments.grades || []);
      setAssignedSections(assignments.sections || []);
      setAssignedSubSections(assignments.subSections || []);
      
      setAssignDialogOpen(true);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to load assignments", variant: "destructive" });
    }
  };

  const toggleSubjectAssignment = (id: string) => setAssignedSubjectIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const toggleGradeAssignment = (g: number) => setAssignedGradeLevels(prev => prev.includes(g) ? prev.filter(i => i !== g) : [...prev, g]);
  const toggleSectionAssignment = (s: string) => setAssignedSections(prev => prev.includes(s) ? prev.filter(i => i !== s) : [...prev, s]);
  const toggleSubSectionAssignment = (s: string) => setAssignedSubSections(prev => prev.includes(s) ? prev.filter(i => i !== s) : [...prev, s]);

  const saveAssignments = async () => {
    if (!assigningTeacher) return;
    setSavingAssignments(true);
    try {
      await api.saveTeacherAssignments(parseInt(assigningTeacher.user_id), {
        subjects: assignedSubjectIds.map(id => parseInt(id)),
        grades: assignedGradeLevels,
        sections: assignedSections,
        subSections: assignedSubSections
      });
      
      setSuccessModal({ 
        title: "Assignments Saved", 
        description: `Updated assignments for ${assigningTeacher.full_name}` 
      });
      setAssignDialogOpen(false);
      await fetchTeachers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to save assignments", variant: "destructive" });
    }
    setSavingAssignments(false);
  };

  const fetchRankings = async () => {
    // Validate stream requirement for Grade 11/12
    if (needsStream && !rankStream) {
      toast({ title: "Error", description: "Please select a stream for Grade 11/12", variant: "destructive" });
      return;
    }

    setLoadingRankings(true);
    try {
      const filters: any = {
        grade_level: parseInt(rankGrade),
        term: rankTerm,
      };
      if (rankStream) filters.stream = rankStream;
      if (rankSection && rankSection !== "all") filters.section = rankSection;
      if (rankSubSection && rankSubSection !== "all") filters.sub_section = rankSubSection;
      
      const response = await api.getRankings(filters);
      // Backend returns { approved: true, rankings: [...] }
      const rankingsData = response.rankings || [];
      // Map average_score to average for frontend compatibility
      const mappedRankings = rankingsData.map((r: any) => ({
        ...r,
        average: r.average_score || r.average
      }));
      setRankings(mappedRankings);

      const approvalStatus = await api.getRankingApprovalStatus(filters);
      setRankingsPublished(approvalStatus?.approved || false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to fetch rankings", variant: "destructive" });
    }
    setLoadingRankings(false);
  };

  const togglePublishRankings = async () => {
    // Validate stream requirement for Grade 11/12
    if (needsStream && !rankStream) {
      toast({ title: "Error", description: "Please select a stream for Grade 11/12", variant: "destructive" });
      return;
    }

    setPublishingRankings(true);
    try {
      const yearData = await api.getCurrentAcademicYear();
      const academicYear = yearData?.academic_year || '2018 E.C.';
      const term = yearData?.term || 'Semester 1';

      const filters: any = {
        grade_level: parseInt(rankGrade),
        stream: rankStream || undefined,
        term: rankTerm,
        academic_year: academicYear,
      };
      
      if (rankSection && rankSection !== "all") filters.section = rankSection;
      if (rankSubSection && rankSubSection !== "all") filters.sub_section = rankSubSection;

      if (rankingsPublished) {
        await api.unpublishRankings(filters);
        setRankingsPublished(false);
        setSuccessModal({ title: "Rankings Unpublished", description: "Students can no longer see their ranks for this group." });
      } else {
        await api.approveRankings(filters);
        setRankingsPublished(true);
        setSuccessModal({ title: "Rankings Published", description: "Students can now see their ranks." });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to update rankings", variant: "destructive" });
    }
    setPublishingRankings(false);
  };

  const approveAllRankings = async () => {
    setBulkApproving(true);
    try {
      const yearData = await api.getCurrentAcademicYear();
      const academicYear = yearData?.academic_year || '2018 E.C.';
      const term = yearData?.term || 'Semester 1';

      const data = await api.approveAllRankings({ term, academic_year: academicYear });
      setSuccessModal({
        title: "All Rankings Published",
        description: `Approved ${data.approvedCount} grade group(s). ${data.skippedCount > 0 ? `${data.skippedCount} already approved.` : ''} Students can now see their ranks.`
      });
      // Refresh current view if rankings are loaded
      if (rankings.length > 0) {
        const yearData2 = await api.getCurrentAcademicYear();
        const statusData = await api.getRankingApprovalStatus({
          grade_level: parseInt(rankGrade),
          stream: rankStream || undefined,
          term: yearData2?.term,
          academic_year: yearData2?.academic_year,
        });
        setRankingsPublished(statusData?.approved || false);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to approve all rankings", variant: "destructive" });
    }
    setBulkApproving(false);
  };

  const needsStream = rankGrade === "11" || rankGrade === "12";

  const handleNavClick = (id: DirectorSection) => { setActiveSection(id); setMobileSidebarOpen(false); };

  const getBadgeCount = (id: DirectorSection) => {
    if (id === "teachers") return teachers.length;
    if (id === "students") return students.length || null;
    return null;
  };

  const renderContent = () => {
    switch (activeSection) {
      case "students": {
        // Filter and sort: grade → stream → sub-section → section → name
        const filteredStudents = students
          .filter(s => {
            const q = studentSearch.toLowerCase();
            if (q && !s.full_name.toLowerCase().includes(q) && !s.id_number.toLowerCase().includes(q)) return false;
            if (studentFilterGrade !== "all" && s.grade_level?.toString() !== studentFilterGrade) return false;
            if (studentFilterStream !== "all" && s.stream !== studentFilterStream) return false;
            return true;
          })
          .sort((a, b) => {
            const gA = a.grade_level || 0, gB = b.grade_level || 0;
            if (gA !== gB) return gA - gB;
            const stA = a.stream || '', stB = b.stream || '';
            if (stA !== stB) return stA.localeCompare(stB);
            // sub-section BEFORE section so A/B/C groups correctly
            const subA = a.sub_section || '', subB = b.sub_section || '';
            if (subA !== subB) {
              if (!subA) return 1;
              if (!subB) return -1;
              return subA.localeCompare(subB, undefined, { numeric: true });
            }
            const secA = a.section || '', secB = b.section || '';
            if (secA !== secB) return secA.localeCompare(secB);
            return (a.full_name || '').localeCompare(b.full_name || '');
          });

        // Build grade groups, each containing sub-section subgroups
        // gradeGroupMap: gradeKey → subKey → students[]
        const gradeGroupMap = new Map<string, { label: string; subMap: Map<string, StudentProfile[]> }>();
        filteredStudents.forEach(s => {
          const grade = s.grade_level ? `Grade ${s.grade_level}` : 'Unassigned';
          const stream = (s.grade_level && s.grade_level >= 11 && s.stream)
            ? ` · ${s.stream.charAt(0).toUpperCase() + s.stream.slice(1)}`
            : '';
          const gradeKey = `${grade}${stream}`;
          const subKey = s.sub_section || '—';
          if (!gradeGroupMap.has(gradeKey)) gradeGroupMap.set(gradeKey, { label: `${grade}${stream}`, subMap: new Map() });
          const entry = gradeGroupMap.get(gradeKey)!;
          if (!entry.subMap.has(subKey)) entry.subMap.set(subKey, []);
          entry.subMap.get(subKey)!.push(s);
        });

        const toggleGrade = (k: string) => setCollapsedGrades(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });
        const toggleSub = (k: string) => setCollapsedSubSections(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });

        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-bold text-foreground">Students</h2>
                <p className="text-sm text-muted-foreground">{students.length} total students</p>
              </div>
              <Button onClick={fetchStudents} disabled={loadingStudents} variant="outline" className="rounded-xl text-xs">
                {loadingStudents ? "Loading..." : "Refresh"}
              </Button>
            </div>

            {/* Filters */}
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or ID..."
                      value={studentSearch}
                      onChange={e => setStudentSearch(e.target.value)}
                      className="pl-9 rounded-xl h-9 text-sm"
                    />
                  </div>
                  <Select value={studentFilterGrade} onValueChange={setStudentFilterGrade}>
                    <SelectTrigger className="rounded-xl w-32 h-9"><SelectValue placeholder="Grade" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Grades</SelectItem>
                      {gradeLevels.map(g => <SelectItem key={g} value={String(g)}>Grade {g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={studentFilterStream} onValueChange={setStudentFilterStream}>
                    <SelectTrigger className="rounded-xl w-32 h-9"><SelectValue placeholder="Stream" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Streams</SelectItem>
                      {streams.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {loadingStudents ? (
              <p className="text-center text-muted-foreground py-8">Loading students...</p>
            ) : filteredStudents.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-10 text-center text-muted-foreground">No students found</CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {Array.from(gradeGroupMap.entries())
                  .sort(([a], [b]) => {
                    const na = parseInt(a.replace(/[^\d]/g, '')) || 0;
                    const nb = parseInt(b.replace(/[^\d]/g, '')) || 0;
                    return na - nb;
                  })
                  .map(([gradeKey, { label, subMap }]) => {
                    const isGradeCollapsed = collapsedGrades.has(gradeKey);
                    const totalInGrade = Array.from(subMap.values()).reduce((s, arr) => s + arr.length, 0);
                    return (
                      <Card key={gradeKey} className="border-0 shadow-sm overflow-hidden">
                        {/* Grade header */}
                        <button
                          className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors border-b border-border/50"
                          onClick={() => toggleGrade(gradeKey)}
                        >
                          <div className="flex items-center gap-2">
                            <GraduationCap className="h-4 w-4 text-primary" />
                            <span className="font-semibold text-sm text-foreground">{label}</span>
                            <Badge variant="secondary" className="text-xs">{totalInGrade} students</Badge>
                          </div>
                          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isGradeCollapsed && "-rotate-90")} />
                        </button>

                        {!isGradeCollapsed && (
                          <div className="divide-y divide-border/30">
                            {Array.from(subMap.entries())
                              .sort(([a], [b]) => {
                                if (a === '—') return 1;
                                if (b === '—') return -1;
                                return a.localeCompare(b, undefined, { numeric: true });
                              })
                              .map(([subLabel, subStudents]) => {
                                const subKey = `${gradeKey}__${subLabel}`;
                                const isSubCollapsed = collapsedSubSections.has(subKey);
                                return (
                                  <div key={subLabel}>
                                    {/* Sub-section header */}
                                    <button
                                      className="w-full flex items-center justify-between px-5 py-2 bg-primary/5 hover:bg-primary/10 transition-colors"
                                      onClick={() => toggleSub(subKey)}
                                    >
                                      <div className="flex items-center gap-2">
                                        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", isSubCollapsed && "-rotate-90")} />
                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                          {subLabel === '—' ? 'No Sub-Section' : `Sub-Section ${subLabel}`}
                                        </span>
                                        <Badge variant="outline" className="text-xs">{subStudents.length}</Badge>
                                      </div>
                                    </button>

                                    {!isSubCollapsed && (
                                      <div className="overflow-x-auto">
                                        <Table>
                                          <TableHeader>
                                            <TableRow className="bg-muted/20">
                                              <TableHead>#</TableHead>
                                              <TableHead>Name</TableHead>
                                              <TableHead>ID</TableHead>
                                              <TableHead>Grade</TableHead>
                                              <TableHead>Stream</TableHead>
                                              <TableHead>Section</TableHead>
                                              <TableHead>Sub-Section</TableHead>
                                              <TableHead>Gender</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {subStudents.map((s, idx) => (
                                              <TableRow key={s.user_id} className="hover:bg-muted/30">
                                                <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                                                <TableCell>
                                                  <p className="font-semibold text-sm">{s.full_name}</p>
                                                  <p className="text-xs text-muted-foreground font-mono">{s.username}</p>
                                                </TableCell>
                                                <TableCell className="font-mono text-sm">{s.id_number}</TableCell>
                                                <TableCell className="text-sm">{s.grade_level ? `Grade ${s.grade_level}` : '—'}</TableCell>
                                                <TableCell className="capitalize text-sm">{s.stream || '—'}</TableCell>
                                                <TableCell className="capitalize text-sm">{s.section || '—'}</TableCell>
                                                <TableCell className="text-sm">{s.sub_section || '—'}</TableCell>
                                                <TableCell className="capitalize text-sm">{s.gender || '—'}</TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </Card>
                    );
                  })}
              </div>
            )}
          </div>
        );
      }

      case "teachers":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Teachers</h2>
              <p className="text-sm text-muted-foreground">{teachers.length} total teachers</p>
            </div>

            {stats && (
              <div className="grid gap-4 grid-cols-2">
                <Card className="border-0 shadow-md">
                  <CardContent className="pt-6 pb-5 flex items-center gap-4">
                    <div className="gradient-primary rounded-xl p-3 shadow-lg"><GraduationCap className="h-5 w-5 text-white" /></div>
                    <div><p className="text-xs font-medium text-muted-foreground uppercase">Students</p><p className="text-2xl font-extrabold text-foreground">{stats.totalStudents}</p></div>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-md">
                  <CardContent className="pt-6 pb-5 flex items-center gap-4">
                    <div className="gradient-accent rounded-xl p-3 shadow-lg"><Users className="h-5 w-5 text-white" /></div>
                    <div><p className="text-xs font-medium text-muted-foreground uppercase">Teachers</p><p className="text-2xl font-extrabold text-foreground">{stats.totalTeachers}</p></div>
                  </CardContent>
                </Card>
              </div>
            )}

            <Card className="border-0 shadow-sm overflow-hidden">
              <CardContent className="p-0">
                {loading ? <p className="p-6 text-center text-muted-foreground">Loading...</p> : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/20">
                          <TableHead>Name</TableHead>
                          <TableHead>ID</TableHead>
                          <TableHead>Grades</TableHead>
                          <TableHead>Subjects</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teachers.map(t => (
                          <TableRow key={t.user_id} className="hover:bg-muted/30">
                            <TableCell>
                              <p className="font-semibold">{t.full_name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{t.username}</p>
                            </TableCell>
                            <TableCell className="font-mono text-sm">{t.id_number}</TableCell>
                            <TableCell>
                              {t.assignedGrades && t.assignedGrades.length > 0
                                ? <div className="flex flex-wrap gap-1">{t.assignedGrades.sort().map(g => <Badge key={g} variant="outline" className="text-xs">G{g}</Badge>)}</div>
                                : <span className="text-xs text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="max-w-[200px]">
                              {t.assignedSubjects && t.assignedSubjects.length > 0
                                ? <div className="flex flex-wrap gap-1">{t.assignedSubjects.map(s => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}</div>
                                : <span className="text-xs text-muted-foreground">None assigned</span>}
                            </TableCell>
                            <TableCell>
                              <Badge variant={t.is_active ? "default" : "destructive"} className={cn("text-xs", t.is_active && "gradient-accent border-0 text-white")}>
                                {t.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button size="sm" className="rounded-lg text-xs gradient-primary border-0 text-white" onClick={() => openAssignDialog(t)}>
                                {(t.assignedSubjects && t.assignedSubjects.length > 0) || (t.assignedGrades && t.assignedGrades.length > 0) ? "Edit" : "Assign"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {teachers.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No teachers</TableCell></TableRow>}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );

      case "rankings":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Student Rankings</h2>
              <p className="text-sm text-muted-foreground">View student rankings by grade and stream</p>
            </div>
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-6 space-y-4">

                {/* Bulk Approve All */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div>
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Publish All Grade Rankings at Once</p>
                    <p className="text-xs text-muted-foreground">Approve rankings for all grade levels — students will see their ranks immediately</p>
                  </div>
                  <Button
                    onClick={approveAllRankings}
                    disabled={bulkApproving}
                    className="rounded-xl gradient-accent border-0 text-white text-xs shrink-0 ml-4"
                  >
                    <CheckCheck className="h-3.5 w-3.5 mr-1.5" />
                    {bulkApproving ? "Approving..." : "Approve All Grades"}
                  </Button>
                </div>

                <div className="relative flex items-center gap-2">
                  <div className="flex-1 border-t border-border/50" />
                  <span className="text-xs text-muted-foreground px-2">or approve by grade</span>
                  <div className="flex-1 border-t border-border/50" />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Select value={rankGrade} onValueChange={v => { setRankGrade(v); setRankStream(""); }}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Grade" /></SelectTrigger>
                    <SelectContent>{gradeLevels.map(g => <SelectItem key={g} value={String(g)}>Grade {g}</SelectItem>)}</SelectContent>
                  </Select>
                  {needsStream && (
                    <Select value={rankStream} onValueChange={setRankStream}>
                      <SelectTrigger className="rounded-xl"><SelectValue placeholder="Stream" /></SelectTrigger>
                      <SelectContent>
                        {streams.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                  <Select value={rankTerm} onValueChange={v => { setRankTerm(v); }}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Term" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Semester 1">Semester 1</SelectItem>
                      <SelectItem value="Semester 2">Semester 2</SelectItem>
                      <SelectItem value="overall">Overall (Both Semesters)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={rankSection} onValueChange={setRankSection}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Section" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sections</SelectItem>
                      <SelectItem value="oromo">Oromo</SelectItem>
                      <SelectItem value="amharic">Amharic</SelectItem>
                      <SelectItem value="somali">Somali</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={rankSubSection} onValueChange={setRankSubSection}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Sub-Section" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {subSections.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button onClick={fetchRankings} disabled={loadingRankings} className="rounded-xl gradient-primary border-0 text-white">
                    {loadingRankings ? "Loading..." : "View Rankings"}
                  </Button>
                </div>

                {rankings.length > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {rankTerm === "overall" ? "Overall — Both Semesters Combined" : rankTerm}
                      </Badge>
                      <Badge variant="outline" className={cn("text-xs", rankingsPublished ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" : "bg-amber-500/10 text-amber-600 border-amber-500/30")}>
                        {rankingsPublished ? "Published — Students can see ranks" : "Unpublished — Students cannot see ranks"}
                      </Badge>
                    </div>
                    <Button
                      onClick={togglePublishRankings}
                      disabled={publishingRankings}
                      variant={rankingsPublished ? "outline" : "default"}
                      className={cn("rounded-xl text-xs", !rankingsPublished && "gradient-accent border-0 text-white")}
                    >
                      <Eye className="h-3.5 w-3.5 mr-1.5" />
                      {publishingRankings ? "..." : rankingsPublished ? "Unpublish Rankings" : "Publish Rankings"}
                    </Button>
                  </div>
                )}

                {rankings.length > 0 && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/20">
                          <TableHead className="w-16">Rank</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Section</TableHead>
                          <TableHead className="text-right">Average</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rankings.map(r => (
                          <TableRow key={r.user_id} className="hover:bg-muted/30">
                            <TableCell className="font-bold text-primary">#{r.rank}</TableCell>
                            <TableCell className="font-semibold">{r.full_name}</TableCell>
                            <TableCell className="capitalize text-muted-foreground">{r.section || "—"}</TableCell>
                            <TableCell className="text-right">
                              <Badge className={cn("text-xs", r.average >= 50 ? "gradient-accent border-0 text-white" : "bg-destructive text-destructive-foreground")}>
                                {r.average}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {rankings.length === 0 && !loadingRankings && (
                  <p className="text-center text-muted-foreground py-6">Select filters and click "View Rankings"</p>
                )}
              </CardContent>
            </Card>
          </div>
        );

      case "top10":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-bold text-foreground">Top 10 Students Overall</h2>
                <p className="text-sm text-muted-foreground">Highest performing students across all grades (9-12)</p>
              </div>
              <div className="flex items-center gap-2">
                {top10Rankings.length > 0 && (
                  <Button variant="outline" onClick={printTop10} className="rounded-xl text-xs">
                    <Printer className="h-3.5 w-3.5 mr-1.5" />
                    Print / PDF
                  </Button>
                )}
                <Button onClick={fetchTop10} disabled={loadingTop10} className="rounded-xl gradient-primary border-0 text-white">
                  {loadingTop10 ? "Loading..." : "Calculate Rankings"}
                </Button>
              </div>
            </div>

            {top10Rankings.length > 0 && (
              <Card className="border-0 shadow-md overflow-hidden">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/20">
                          <TableHead className="w-16">Rank</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Grade</TableHead>
                          <TableHead>Section</TableHead>
                          <TableHead>Stream</TableHead>
                          <TableHead className="text-right">Average</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {top10Rankings.map(r => (
                          <TableRow key={r.user_id} className="hover:bg-muted/30">
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                {r.rank <= 3 ? (
                                  <Trophy className={cn("h-4 w-4", r.rank === 1 ? "text-yellow-500" : r.rank === 2 ? "text-gray-400" : "text-amber-600")} />
                                ) : null}
                                <span className="font-bold text-primary">#{r.rank}</span>
                              </div>
                            </TableCell>
                            <TableCell className="font-semibold">{r.full_name}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">G{r.grade_level}</Badge></TableCell>
                            <TableCell className="capitalize text-muted-foreground">{r.section || "—"}</TableCell>
                            <TableCell className="capitalize text-muted-foreground">{r.stream || "—"}</TableCell>
                            <TableCell className="text-right">
                              <Badge className={cn("text-xs", r.average >= 50 ? "gradient-accent border-0 text-white" : "bg-destructive text-destructive-foreground")}>
                                {r.average}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
            {top10Rankings.length === 0 && !loadingTop10 && (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-10 text-center text-muted-foreground">
                  Click "Calculate Rankings" to see the top 10 students across all grades
                </CardContent>
              </Card>
            )}
          </div>
        );

      case "performance":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Academic Performance Dashboard</h2>
              <p className="text-sm text-muted-foreground">Comprehensive analytics across subjects, gender, and trends</p>
            </div>

            {/* Filters */}
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm font-semibold text-foreground">Filters:</span>
                  <Select value={perfGrade} onValueChange={setPerfGrade}>
                    <SelectTrigger className="rounded-xl w-32"><SelectValue placeholder="Grade" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Grades</SelectItem>
                      {gradeLevels.map(g => <SelectItem key={g} value={String(g)}>Grade {g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={perfStream} onValueChange={setPerfStream}>
                    <SelectTrigger className="rounded-xl w-32"><SelectValue placeholder="Stream" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Streams</SelectItem>
                      {streams.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {stats ? (
              <div className="space-y-6">
                {/* Top: Average Score Bar Chart */}
                {stats.subjectAverages.length > 0 && (
                  <Card className="border-0 shadow-md">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <div className="gradient-primary rounded-lg p-1.5"><BarChart3 className="h-4 w-4 text-white" /></div>
                        Average Score per Subject
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={stats.subjectAverages} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="name" angle={-35} textAnchor="end" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                            <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                            <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.75rem" }} formatter={(v: number) => [`${v}%`, "Average"]} />
                            <Bar dataKey="average" radius={[6, 6, 0, 0]}>
                              {stats.subjectAverages.map((_, i) => (
                                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Middle: Score Distribution + Gender Stats */}
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Score Distribution Pie */}
                  {stats.scoreDistribution.some(d => d.count > 0) && (
                    <Card className="border-0 shadow-md">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <div className="gradient-accent rounded-lg p-1.5"><PieChartIcon className="h-4 w-4 text-white" /></div>
                          Score Distribution
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-52">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={stats.scoreDistribution.filter(d => d.count > 0)}
                                cx="50%" cy="50%"
                                innerRadius={45} outerRadius={75}
                                paddingAngle={3}
                                dataKey="count"
                                nameKey="range"
                              >
                                {stats.scoreDistribution.filter(d => d.count > 0).map((_, i) => (
                                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.75rem" }} />
                              <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Gender Stats */}
                  {stats.genderStats.length > 0 && (
                    <Card className="border-0 shadow-md">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <div className="gradient-warm rounded-lg p-1.5"><Users className="h-4 w-4 text-white" /></div>
                          Gender Distribution
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-40">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={stats.genderStats}
                                cx="50%" cy="50%"
                                innerRadius={30} outerRadius={55}
                                paddingAngle={3}
                                dataKey="value"
                                nameKey="name"
                              >
                                {stats.genderStats.map((entry, i) => (
                                  <Cell
                                    key={i}
                                    fill={
                                      entry.name === "Male" ? GENDER_COLORS.male :
                                      entry.name === "Female" ? GENDER_COLORS.female :
                                      "hsl(var(--muted-foreground))"
                                    }
                                  />
                                ))}
                              </Pie>
                              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.75rem" }} />
                              <Legend verticalAlign="bottom" height={20} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        {/* Summary counts */}
                        <div className="flex justify-center gap-6 mt-1">
                          {stats.genderStats.map(g => (
                            <div key={g.name} className="text-center">
                              <p className="text-xl font-extrabold text-foreground">{g.value}</p>
                              <p className="text-xs text-muted-foreground font-medium">{g.name}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Bottom: Yearly Trends Line Chart */}
                {stats.yearlyTrends.length > 0 && (
                  <Card className="border-0 shadow-md">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <div className="gradient-primary rounded-lg p-1.5"><BarChart3 className="h-4 w-4 text-white" /></div>
                        Yearly Average Trends
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={stats.yearlyTrends} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="year" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                            <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                            <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.75rem" }} formatter={(v: number) => [`${v}%`, "Average"]} />
                            <Line type="monotone" dataKey="average" stroke="hsl(234, 85%, 60%)" strokeWidth={3} dot={{ r: 5, fill: "hsl(234, 85%, 60%)" }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* No data fallback */}
                {stats.subjectAverages.length === 0 && stats.genderStats.length === 0 && (
                  <Card className="border-0 shadow-md">
                    <CardContent className="py-10 text-center text-muted-foreground">No data available for the selected filters</CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <Card className="border-0 shadow-md"><CardContent className="py-10 text-center text-muted-foreground">Loading analytics...</CardContent></Card>
            )}
          </div>
        );
      
      case "homeroom":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-bold text-foreground">Homeroom Management</h2>
                <p className="text-sm text-muted-foreground">Assign homeroom teachers to classes</p>
              </div>
              <Button onClick={fetchHomeroomAssignments} disabled={loadingHomeroom} className="rounded-xl gradient-primary border-0 text-white">
                {loadingHomeroom ? "Loading..." : "Refresh"}
              </Button>
            </div>

            {loadingHomeroom ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-10 text-center text-muted-foreground">Loading homeroom assignments...</CardContent>
              </Card>
            ) : (
              <Card className="border-0 shadow-md overflow-hidden">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/20">
                          <TableHead>Teacher</TableHead>
                          <TableHead>Grade</TableHead>
                          <TableHead>Section</TableHead>
                          <TableHead>Sub-Section</TableHead>
                          <TableHead>Stream</TableHead>
                          <TableHead className="text-center">Students</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {homeroomAssignments.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                              <BookOpen className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                              <p>No homeroom assignments yet</p>
                              <p className="text-xs mt-1">Assign teachers from the Teachers tab</p>
                            </TableCell>
                          </TableRow>
                        ) : (
                          homeroomAssignments.map((assignment) => (
                            <TableRow key={assignment.id} className="hover:bg-muted/30">
                              <TableCell>
                                <div>
                                  <p className="font-semibold">{assignment.teacher_name}</p>
                                  <p className="text-xs text-muted-foreground font-mono">{assignment.teacher_username}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">Grade {assignment.grade_level}</Badge>
                              </TableCell>
                              <TableCell className="capitalize">{assignment.section || "—"}</TableCell>
                              <TableCell>{assignment.sub_section || "—"}</TableCell>
                              <TableCell className="capitalize">{assignment.stream || "—"}</TableCell>
                              <TableCell className="text-center">
                                <Badge className="gradient-accent border-0 text-white text-xs">
                                  {assignment.student_count} students
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex gap-2 justify-end">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="rounded-lg text-xs"
                                    onClick={() => editHomeroom(assignment)}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="rounded-lg text-xs"
                                    onClick={() => setRemoveHomeroomConfirm(assignment.id)}
                                  >
                                    Remove
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Teachers List with Assign Button */}
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="text-lg">Assign Homeroom Teachers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {teachers.map((teacher) => {
                    const hasHomeroom = homeroomAssignments.some(a => a.teacher_id === parseInt(teacher.user_id));
                    return (
                      <div key={teacher.user_id} className="flex items-center justify-between p-3 rounded-xl border border-border/50 hover:bg-muted/30 transition-colors">
                        <div>
                          <p className="font-semibold">{teacher.full_name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{teacher.id_number}</p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => openHomeroomDialog(parseInt(teacher.user_id))}
                          className={cn(
                            "rounded-lg text-xs",
                            hasHomeroom ? "gradient-accent border-0 text-white" : "gradient-primary border-0 text-white"
                          )}
                        >
                          {hasHomeroom ? "Reassign" : "Assign Homeroom"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col -mx-4 sm:-mx-6 -mt-8 min-h-[calc(100vh-4rem)]">
      <div className="flex items-center gap-3 p-4 border-b lg:hidden">
        <button onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)} className="p-2 rounded-xl bg-muted hover:bg-muted/80 transition-colors">
          <Menu className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-primary" />
          <span className="font-bold text-sm text-foreground">{sidebarItems.find(i => i.id === activeSection)?.label}</span>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {mobileSidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileSidebarOpen(false)} />}

        {/* Desktop sidebar */}
        <aside className={cn("shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex-col transition-all duration-300 hidden lg:flex", sidebarCollapsed ? "w-[68px]" : "w-60")}>
          <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
            {!sidebarCollapsed && <div className="flex items-center gap-2"><Eye className="h-5 w-5 text-sidebar-primary" /><span className="font-bold text-sm">Director</span></div>}
            <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="p-1.5 rounded-lg hover:bg-sidebar-accent transition-colors text-sidebar-foreground/60">
              {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>
          <nav className="flex-1 p-3 space-y-1">
            {sidebarItems.map(({ id, label, icon: Icon }) => {
              const count = getBadgeCount(id);
              return (
                <button key={id} onClick={() => handleNavClick(id)} className={cn("w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all", activeSection === id ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground")}>
                  <Icon className="h-4 w-4 shrink-0" />
                  {!sidebarCollapsed && <><span className="flex-1 text-left">{label}</span>{count !== null && <span className={cn("text-xs font-bold min-w-[20px] text-center rounded-full px-1.5 py-0.5", activeSection === id ? "bg-white/20" : "bg-sidebar-accent")}>{count}</span>}</>}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Mobile sidebar */}
        <aside className={cn("fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col transition-transform duration-300 lg:hidden", mobileSidebarOpen ? "translate-x-0" : "-translate-x-full")}>
          <div className="flex items-center gap-2 p-4 border-b border-sidebar-border"><Eye className="h-5 w-5 text-sidebar-primary" /><span className="font-bold text-sm">Director</span></div>
          <nav className="flex-1 p-3 space-y-1">
            {sidebarItems.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => handleNavClick(id)} className={cn("w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all", activeSection === id ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md" : "text-sidebar-foreground/70 hover:bg-sidebar-accent")}>
                <Icon className="h-4 w-4 shrink-0" /><span className="flex-1 text-left">{label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 min-w-0 p-6 lg:p-8">{renderContent()}</main>
      </div>

      {/* Assign Subjects Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign to {assigningTeacher?.full_name}</DialogTitle>
            <p className="text-xs text-muted-foreground">Configure grades, sections, and subjects</p>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-5 pr-1">
            <div className="space-y-2">
              <p className="text-sm font-semibold">Grade Levels</p>
              <div className="grid grid-cols-4 gap-2">
                {gradeLevels.map(g => (
                  <label key={g} className={cn("flex items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all", assignedGradeLevels.includes(g) ? "border-primary bg-primary/10 text-primary font-semibold" : "border-border hover:border-primary/40")}>
                    <Checkbox checked={assignedGradeLevels.includes(g)} onCheckedChange={() => toggleGradeAssignment(g)} className="sr-only" />
                    <span className="text-sm">G{g}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold">Sections</p>
              <div className="grid grid-cols-3 gap-2">
                {sections.map(s => (
                  <label key={s} className={cn("flex items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all capitalize", assignedSections.includes(s) ? "border-primary bg-primary/10 text-primary font-semibold" : "border-border hover:border-primary/40")}>
                    <Checkbox checked={assignedSections.includes(s)} onCheckedChange={() => toggleSectionAssignment(s)} className="sr-only" />
                    <span className="text-sm">{s}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold">Sub-Sections</p>
              <div className="grid grid-cols-4 gap-2">
                {subSections.map(s => (
                  <label key={s} className={cn("flex items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all", assignedSubSections.includes(s) ? "border-primary bg-primary/10 text-primary font-semibold" : "border-border hover:border-primary/40")}>
                    <Checkbox checked={assignedSubSections.includes(s)} onCheckedChange={() => toggleSubSectionAssignment(s)} className="sr-only" />
                    <span className="text-sm">{s}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold">Subjects</p>
              {assignedGradeLevels.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Select grade levels first</p>
              ) : (
                [...assignedGradeLevels].sort().map(grade => {
                  const subs = allSubjects.filter(s => s.grade_level === grade);
                  if (subs.length === 0) return null;
                  const allSelected = subs.every(s => assignedSubjectIds.includes(s.id));
                  return (
                    <div key={grade} className="rounded-xl border overflow-hidden">
                      <button type="button" onClick={() => {
                        if (allSelected) setAssignedSubjectIds(prev => prev.filter(id => !subs.map(s => s.id).includes(id)));
                        else setAssignedSubjectIds(prev => [...new Set([...prev, ...subs.map(s => s.id)])]);
                      }} className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/40 hover:bg-muted/60 transition-colors">
                        <span className="text-xs font-bold text-primary">Grade {grade}</span>
                        <span className="text-xs text-muted-foreground">{allSelected ? "Deselect all" : "Select all"}</span>
                      </button>
                      <div className="divide-y divide-border/50">
                        {subs.map(s => (
                          <label key={s.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/30 cursor-pointer">
                            <Checkbox checked={assignedSubjectIds.includes(s.id)} onCheckedChange={() => toggleSubjectAssignment(s.id)} />
                            <span className="text-sm font-medium flex-1">{s.subject_name}</span>
                            {s.grade_level && <Badge variant="outline" className="text-[10px]">G{s.grade_level}</Badge>}
                            {s.stream && <Badge variant="outline" className="text-[10px] capitalize">{s.stream}</Badge>}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground bg-muted/30 rounded-xl px-3 py-2.5">
            <span><strong className="text-foreground">{assignedGradeLevels.length}</strong> grades</span>
            <span>·</span>
            <span><strong className="text-foreground">{assignedSections.length}</strong> sections</span>
            <span>·</span>
            <span><strong className="text-foreground">{assignedSubSections.length}</strong> sub-sections</span>
            <span>·</span>
            <span><strong className="text-foreground">{assignedSubjectIds.length}</strong> subjects</span>
          </div>
          <div className="flex gap-3">
            <DialogClose asChild><Button variant="outline" className="flex-1 rounded-xl">Cancel</Button></DialogClose>
            <Button onClick={saveAssignments} disabled={savingAssignments} className="flex-1 rounded-xl gradient-primary border-0 text-white">
              {savingAssignments ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Homeroom Assignment Dialog */}
      <Dialog open={homeroomDialogOpen} onOpenChange={(open) => {
        setHomeroomDialogOpen(open);
        if (!open) {
          setEditingAssignmentId(null); // Reset editing state when dialog closes
        }
      }}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingAssignmentId ? "Edit Homeroom Assignment" : "Assign Homeroom Teacher"}
            </DialogTitle>
            <p className="text-xs text-muted-foreground">Select the class for this homeroom teacher</p>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Grade Level</Label>
              <Select value={String(homeroomGrade)} onValueChange={(v) => setHomeroomGrade(parseInt(v))}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[9, 10, 11, 12].map((g) => (
                    <SelectItem key={g} value={String(g)}>Grade {g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Section (Optional)</Label>
              <Select value={homeroomSection} onValueChange={setHomeroomSection}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select section" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sections</SelectItem>
                  <SelectItem value="oromo">Oromo</SelectItem>
                  <SelectItem value="amharic">Amharic</SelectItem>
                  <SelectItem value="somali">Somali</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sub-Section (Optional)</Label>
              <Select value={homeroomSubSection} onValueChange={setHomeroomSubSection}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select sub-section" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sub-Sections</SelectItem>
                  {["A", "B", "C", "D", "E", "F", "G", "H"].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(homeroomGrade === 11 || homeroomGrade === 12) && (
              <div className="space-y-2">
                <Label>Stream (Optional)</Label>
                <Select value={homeroomStream} onValueChange={setHomeroomStream}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select stream" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Streams</SelectItem>
                    {streams.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="flex gap-3 mt-4">
            <DialogClose asChild>
              <Button variant="outline" className="flex-1 rounded-xl">Cancel</Button>
            </DialogClose>
            <Button
              onClick={assignHomeroom}
              disabled={savingHomeroom}
              className="flex-1 rounded-xl gradient-primary border-0 text-white"
            >
              {savingHomeroom ? "Saving..." : (editingAssignmentId ? "Update Assignment" : "Assign Teacher")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <SuccessModal open={!!successModal} onClose={() => setSuccessModal(null)} title={successModal?.title || ""} description={successModal?.description} />

      {/* Homeroom Removal Confirmation */}
      <AlertDialog open={!!removeHomeroomConfirm} onOpenChange={() => setRemoveHomeroomConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Homeroom Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this homeroom assignment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => removeHomeroomConfirm && removeHomeroom(removeHomeroomConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove Assignment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
