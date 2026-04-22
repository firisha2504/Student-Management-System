import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useGradeLevels, useStreams, useSections, useSubSections, useIdPrefixes, useSchoolConfig } from "@/contexts/SchoolConfigContext";
import { api } from "@/services/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Users, Search, Camera, Link2, History, Menu, ChevronLeft, ChevronRight, ClipboardList, CheckSquare, Trash2, ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import SuccessModal from "@/components/SuccessModal";
import { SimpleAcademicYearSelect } from "@/components/ConfigurableSelects";

interface StudentProfile {
  user_id: string;
  full_name: string;
  username: string;
  id_number: string;
  grade_level: number | null;
  stream: string | null;
  section: string | null;
  sub_section: string | null;
  is_active: boolean;
  profile_image: string | null;
  gender: string | null;
  parent_count: number;
}

type RegistrarSection = "students" | "register" | "registration-period" | "academic";

const sidebarItems: { id: RegistrarSection; label: string; icon: React.ElementType }[] = [
  { id: "students", label: "Students", icon: Users },
  { id: "register", label: "Register", icon: UserPlus },
  { id: "registration-period", label: "Registration Period", icon: ClipboardList },
  { id: "academic", label: "Academic Year", icon: History },
];

export default function RegistrarPortal() {
  const { role } = useAuth();
  const { toast } = useToast();
  const gradeLevels = useGradeLevels();
  const streams = useStreams();
  const sections = useSections();
  const subSections = useSubSections();
  const idPrefixes = useIdPrefixes();
  const { config } = useSchoolConfig();
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterGrade, setFilterGrade] = useState("all");
  const [filterStream, setFilterStream] = useState("all");
  const [activeSection, setActiveSection] = useState<RegistrarSection>("students");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Create student form
  const [userRows, setUserRows] = useState<{ fullName: string; idNumber: string; gender: string }[]>([{ fullName: "", idNumber: "", gender: "" }]);
  const [nextStudentNum, setNextStudentNum] = useState<number>(1);
  const [creating, setCreating] = useState(false);
  
  // Registration settings
  const [registrationGrade, setRegistrationGrade] = useState<string>("9");
  const [registrationStream, setRegistrationStream] = useState<string>("");
  const [registrationSection, setRegistrationSection] = useState<string>("");
  const [registrationSubSection, setRegistrationSubSection] = useState<string>("");
  const [autoAssignClass, setAutoAssignClass] = useState<boolean>(true);
  const [bulkInputOpen, setBulkInputOpen] = useState<boolean>(false);
  const [bulkNames, setBulkNames] = useState<string>("");
  const [successModal, setSuccessModal] = useState<{ title: string; description?: string; credentials?: { name: string; username: string; password: string }[] } | null>(null);

  // Edit student dialog
  const [editStudent, setEditStudent] = useState<StudentProfile | null>(null);
  const [editGrade, setEditGrade] = useState("");
  const [editStream, setEditStream] = useState("");
  const [editSection, setEditSection] = useState("");
  const [editSubSection, setEditSubSection] = useState("");
  const [editGender, setEditGender] = useState("");
  const [saving, setSaving] = useState(false);

  // Parent linking
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkStudent, setLinkStudent] = useState<StudentProfile | null>(null);
  const [parents, setParents] = useState<{ user_id: string; full_name: string }[]>([]);
  const [linkedParents, setLinkedParents] = useState<{ parent_id: string; full_name: string }[]>([]);

  // Image upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageTargetStudent, setImageTargetStudent] = useState<string | null>(null);

  // Academic year management
  const [archiveYear, setArchiveYear] = useState("");
  const [archiving, setArchiving] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [archivedYears, setArchivedYears] = useState<any[]>([]);
  const [loadingArchived, setLoadingArchived] = useState(false);
  const [deleteYearConfirm, setDeleteYearConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Bulk assignment (enhanced)
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [bulkGrade, setBulkGrade] = useState("");
  const [bulkStream, setBulkStream] = useState("");
  const [bulkSection, setBulkSection] = useState("");
  const [bulkSubSection, setBulkSubSection] = useState("");
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  // Grade collapse state
  const [collapsedGrades, setCollapsedGrades] = useState<Set<number>>(new Set());

  // Current academic year
  const [currentAcademicYear, setCurrentAcademicYear] = useState<string | null>(null);
  const [currentTerm, setCurrentTerm] = useState<string | null>(null);
  const [settingYear, setSettingYear] = useState("");
  const [settingTerm, setSettingTerm] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  // Registration period management
  const [registrationSettings, setRegistrationSettings] = useState<any>(null);
  const [loadingRegistrationSettings, setLoadingRegistrationSettings] = useState(false);
  const [savingRegistrationSettings, setSavingRegistrationSettings] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [registrationStartDate, setRegistrationStartDate] = useState("");
  const [registrationEndDate, setRegistrationEndDate] = useState("");
  const [registrationAcademicYear, setRegistrationAcademicYear] = useState("");

  useEffect(() => {
    api.getCurrentAcademicYear().then((d: any) => {
      if (d?.academic_year) { setCurrentAcademicYear(d.academic_year); setSettingYear(d.academic_year.replace('-', '/')); }
      if (d?.term) { setCurrentTerm(d.term); setSettingTerm(d.term); }
    }).catch(() => {});
  }, []);

  const handleSaveSettings = async () => {
    // Trim the year to remove extra spaces
    const trimmedYear = settingYear.trim();
    if (!trimmedYear || !/^\d{4}[\/\-]\d{4}(\s*E\.C\.?)?$/i.test(trimmedYear)) {
      toast({ title: "Error", description: "Enter a valid year (e.g., 2025/2026 or 2018-2019 E.C.)", variant: "destructive" }); return;
    }
    setSavingSettings(true);
    try {
      const formatted = trimmedYear.replace('/', '-');
      await api.setCurrentAcademicYear({ academic_year: formatted, term: settingTerm || undefined });
      setCurrentAcademicYear(formatted);
      setCurrentTerm(settingTerm || null);
      toast({ title: "Saved", description: `Active year set to ${settingYear}` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setSavingSettings(false);
  };

  const handleArchiveYear = async () => {
    setArchiving(true);
    setArchiveConfirmOpen(false);
    try {
      // Convert format from 2025/2026 to 2025-2026, trim extra spaces
      const formattedYear = archiveYear.trim().replace('/', '-');
      const result = await api.archiveAcademicYear(formattedYear);
      toast({ 
        title: "Success", 
        description: `Archived ${result.archived_students} student(s) with ${result.archived_subjects} subject(s)` 
      });
      setArchiveYear("");
      fetchArchivedYears(); // Refresh the list
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setArchiving(false);
  };

  const fetchArchivedYears = async () => {
    setLoadingArchived(true);
    try {
      const data = await api.getArchivedYears();
      setArchivedYears(data || []);
    } catch (error: any) {
      console.error('Failed to fetch archived years:', error);
    }
    setLoadingArchived(false);
  };

  const handleDeleteYear = async (academicYear: string) => {
    setDeleting(true);
    setDeleteYearConfirm(null);
    try {
      await api.deleteArchivedYear(academicYear);
      toast({ title: "Success", description: "Archived year deleted successfully" });
      fetchArchivedYears(); // Refresh the list
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    setDeleting(false);
  };

  useEffect(() => {
    if (activeSection === 'academic') {
      fetchArchivedYears();
    }
    if (activeSection === 'registration-period') {
      fetchRegistrationSettings();
    }
  }, [activeSection]);

  const fetchRegistrationSettings = async () => {
    setLoadingRegistrationSettings(true);
    try {
      const settings = await api.getRegistrationPeriodSettings();
      setRegistrationSettings(settings);
      setRegistrationOpen(settings.registration_open === 'true');
      setRegistrationStartDate(settings.registration_start_date || '');
      setRegistrationEndDate(settings.registration_end_date || '');
      setRegistrationAcademicYear(settings.registration_academic_year || '');
    } catch (error: any) {
      console.error('Failed to fetch registration settings:', error);
      toast({ title: "Error", description: "Failed to load registration settings", variant: "destructive" });
    }
    setLoadingRegistrationSettings(false);
  };

  const handleUpdateRegistrationSettings = async () => {
    setSavingRegistrationSettings(true);
    try {
      const settings = {
        registration_open: registrationOpen,
        registration_start_date: registrationStartDate,
        registration_end_date: registrationEndDate,
        registration_academic_year: registrationAcademicYear,
      };
      
      await api.updateRegistrationPeriodSettings(settings);
      toast({ 
        title: "Success", 
        description: `Registration ${registrationOpen ? 'opened' : 'closed'} successfully` 
      });
      await fetchRegistrationSettings(); // Refresh settings
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to update registration settings", variant: "destructive" });
    }
    setSavingRegistrationSettings(false);
  };

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const data = await api.getAllUsers();
      const studentProfiles = data
        .filter((u: any) => u.role === "student")
        .map((u: any) => ({
          user_id: u.user_id,
          full_name: u.full_name,
          username: u.username,
          id_number: u.id_number,
          grade_level: u.grade_level,
          stream: u.stream,
          section: u.section,
          sub_section: u.sub_section,
          is_active: u.is_active,
          profile_image: u.profile_image,
          gender: u.gender,
          parent_count: u.parent_count || 0,
        }));
      setStudents(studentProfiles);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to fetch students", variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => { fetchStudents(); }, []);

  useEffect(() => {
    if (activeSection === 'register') {
      api.getNextId('student').then(data => {
        const num = parseInt(data.nextId.replace('MJS', ''), 10);
        setNextStudentNum(num);
        setUserRows([{ fullName: "", idNumber: String(num).padStart(3, '0'), gender: "" }]);
      }).catch(() => {});
    }
  }, [activeSection]);

  if (role !== "registrar") return <p className="text-destructive">Access denied.</p>;

  const filtered = students
    .filter(s => {
      const q = searchQuery.toLowerCase();
      if (q && !s.full_name.toLowerCase().includes(q) && !s.id_number.toLowerCase().includes(q)) return false;
      if (filterGrade !== "all" && s.grade_level?.toString() !== filterGrade) return false;
      if (filterStream !== "all" && s.stream !== filterStream) return false;
      return true;
    })
    .sort((a, b) => {
      // Primary sort: by grade level (ascending: 9, 10, 11, 12)
      const gradeA = a.grade_level || 0;
      const gradeB = b.grade_level || 0;
      if (gradeA !== gradeB) {
        return gradeA - gradeB;
      }
      
      // Secondary sort: by stream (natural before social)
      const streamA = a.stream || '';
      const streamB = b.stream || '';
      if (streamA !== streamB) {
        if (streamA === 'natural' && streamB === 'social') return -1;
        if (streamA === 'social' && streamB === 'natural') return 1;
        return streamA.localeCompare(streamB);
      }
      
      // Tertiary sort: by section (alphabetical)
      const sectionA = a.section || '';
      const sectionB = b.section || '';
      if (sectionA !== sectionB) {
        return sectionA.localeCompare(sectionB);
      }
      
      // Quaternary sort: by sub-section (alphabetical)
      const subSectionA = a.sub_section || '';
      const subSectionB = b.sub_section || '';
      if (subSectionA !== subSectionB) {
        return subSectionA.localeCompare(subSectionB);
      }
      
      // Final sort: by ID number (ascending)
      const idA = a.id_number || '';
      const idB = b.id_number || '';
      return idA.localeCompare(idB, undefined, { numeric: true });
    });

  const addUserRow = () => {
    const nextNum = nextStudentNum + userRows.length;
    setUserRows([...userRows, { fullName: "", idNumber: String(nextNum).padStart(3, '0'), gender: "" }]);
  };

  const addMultipleRows = (count: number) => {
    const newRows = [];
    for (let i = 0; i < count; i++) {
      const nextNum = nextStudentNum + userRows.length + i;
      newRows.push({ fullName: "", idNumber: String(nextNum).padStart(3, '0'), gender: "" });
    }
    setUserRows([...userRows, ...newRows]);
  };

  const processBulkNames = () => {
    const names = bulkNames
      .split('\n')
      .map(name => name.trim())
      .filter(name => name.length > 0);
    
    if (names.length === 0) {
      toast({ title: "Error", description: "Please enter at least one name", variant: "destructive" });
      return;
    }
    
    const newRows = names.map((name, index) => {
      const nextNum = nextStudentNum + userRows.length + index;
      
      // Check for gender prefix and extract actual name
      let actualName = name;
      let detectedGender = "";
      
      // Check if name starts with "M " or "F " (case insensitive)
      const malePrefix = /^M\s+(.+)$/i;
      const femalePrefix = /^F\s+(.+)$/i;
      
      if (malePrefix.test(name)) {
        actualName = name.replace(malePrefix, '$1').trim();
        detectedGender = "male";
      } else if (femalePrefix.test(name)) {
        actualName = name.replace(femalePrefix, '$1').trim();
        detectedGender = "female";
      }
      
      return {
        fullName: actualName,
        idNumber: String(nextNum).padStart(3, '0'),
        gender: detectedGender
      };
    });
    
    setUserRows([...userRows, ...newRows]);
    setBulkNames("");
    setBulkInputOpen(false);
    
    // Count how many had gender detected
    const withGender = newRows.filter(row => row.gender).length;
    const genderInfo = withGender > 0 ? ` (${withGender} with auto-detected gender)` : "";
    
    toast({ 
      title: "Success", 
      description: `Added ${names.length} students to the registration form${genderInfo}` 
    });
  };

  const removeUserRow = (i: number) => setUserRows(userRows.filter((_, idx) => idx !== i));
  const updateUserRow = (i: number, field: "fullName" | "idNumber" | "gender", value: string) => {
    const updated = [...userRows]; updated[i][field] = value; setUserRows(updated);
  };

  const handleCreateStudents = async () => {
    const validRows = userRows.filter(r => r.fullName.trim());
    if (validRows.length === 0) { 
      toast({ title: "Error", description: "Fill at least one student's name and ID.", variant: "destructive" }); 
      return; 
    }
    setCreating(true);
    const creds: { name: string; username: string; password: string }[] = [];
    const errors: string[] = [];
    
    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      // Generate truly unique email using multiple factors
      const timestamp = Date.now();
      const randomSuffix = Math.floor(Math.random() * 100000);
      const nameHash = row.fullName.toLowerCase().replace(/\s+/g, '');
      const email = `${nameHash}.${timestamp}.${i}.${randomSuffix}@${config.system?.emailDomain || 'school.com'}`;
      
      try {
        const result = await api.createUser({
          email,
          full_name: row.fullName.trim(),
          role: "student",
          gender: row.gender || undefined
        });
        
        // Auto-assign grade level and class if enabled
        if (autoAssignClass && registrationGrade) {
          const updateData: any = {
            grade_level: parseInt(registrationGrade)
          };
          
          // Add stream for grades 11-12
          if (registrationGrade === "11" || registrationGrade === "12") {
            if (registrationStream && registrationStream !== "none") {
              updateData.stream = registrationStream;
            } else {
              updateData.stream = null;
            }
          }
          
          // Add section if specified
          if (registrationSection && registrationSection !== "none") {
            updateData.section = registrationSection;
          } else if (registrationSection === "none") {
            updateData.section = null;
          }
          
          // Add sub-section if specified
          if (registrationSubSection && registrationSubSection !== "none") {
            updateData.sub_section = registrationSubSection;
          } else if (registrationSubSection === "none") {
            updateData.sub_section = null;
          }
          
          try {
            await api.updateStudent(result.user_id, updateData);
          } catch (updateErr: any) {
            console.warn(`Failed to auto-assign class for ${row.fullName}:`, updateErr);
          }
        }
        
        creds.push({ 
          name: row.fullName.trim(), 
          username: result.username, 
          password: result.credentials.password
        });
        
        // Delay between requests to ensure unique timestamps
        if (i < validRows.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      } catch (err: any) { 
        errors.push(`${row.fullName}: ${err.message}`); 
      }
    }
    
    if (creds.length > 0) {
      const gradeInfo = autoAssignClass && registrationGrade ? ` (Grade ${registrationGrade}${registrationStream ? ` - ${registrationStream}` : ''}${registrationSection ? ` - ${registrationSection}` : ''}${registrationSubSection ? ` - ${registrationSubSection}` : ''})` : '';
      setSuccessModal({ 
        title: `${creds.length} Student(s) Created!${gradeInfo}`, 
        description: "Share these credentials with the students", 
        credentials: creds 
      });
      setUserRows([{ fullName: "", idNumber: "", gender: "" }]); 
      fetchStudents();
    }
    
    if (errors.length > 0) toast({ title: "Some errors", description: errors.join("; "), variant: "destructive" });
    setCreating(false);
  };

  const openEditDialog = (student: StudentProfile) => {
    setEditStudent(student); 
    setEditGrade(student.grade_level?.toString() || ""); 
    setEditStream(student.stream || ""); 
    setEditSection(student.section || ""); 
    setEditSubSection(student.sub_section || ""); 
    setEditGender(student.gender || "");
  };

  const handleSaveEdit = async () => {
    if (!editStudent) return;
    setSaving(true);
    const needsStream = editGrade === "11" || editGrade === "12";
    const updates: Record<string, unknown> = {};
    if (editGrade) updates.grade_level = parseInt(editGrade);
    if (needsStream && editStream) updates.stream = editStream;
    else if (!needsStream) updates.stream = null;
    if (editSection) updates.section = editSection;
    updates.sub_section = (editSubSection && editSubSection !== "none") ? editSubSection : null;
    if (editGender) updates.gender = editGender;
    
    try {
      await api.updateStudent(editStudent.user_id, updates);
      toast({ title: "Success", description: "Student profile updated successfully" });
      setEditStudent(null);
      fetchStudents(); // Refresh the list
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !imageTargetStudent) return;
    if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) { 
      toast({ title: "Error", description: "Image must be under 2MB.", variant: "destructive" }); 
      return; 
    }
    
    try {
      await api.uploadProfileImage(file);
      setSuccessModal({ title: "Photo Updated" }); 
      fetchStudents();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    
    setImageTargetStudent(null);
  };

  const fetchLinkedParents = async (studentId: string) => {
    try {
      const linked = await api.getLinkedParents(studentId);
      setLinkedParents(linked.map((p: any) => ({ parent_id: p.parent_id, full_name: p.full_name })));
    } catch (error: any) {
      console.error('Failed to fetch linked parents:', error);
    }
  };

  const openLinkDialog = async (student: StudentProfile) => {
    setLinkStudent(student); 
    setLinkDialogOpen(true);
    
    try {
      const allUsers = await api.getAllUsers();
      const parentProfiles = allUsers.filter((u: any) => u.role === "parent");
      setParents(parentProfiles.map((p: any) => ({ user_id: p.user_id, full_name: p.full_name })));
      
      await fetchLinkedParents(student.user_id);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const linkParent = async (parentId: string) => {
    if (!linkStudent) return;
    
    try {
      await api.linkParentToStudent({
        parent_id: parseInt(parentId),
        student_id: parseInt(linkStudent.user_id),
        relationship: 'parent'
      });
      toast({ title: "Success", description: "Parent linked successfully" });
      await fetchLinkedParents(linkStudent.user_id);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const unlinkParent = async (parentId: string) => {
    if (!linkStudent) return;
    
    try {
      await api.unlinkParentFromStudent({
        parent_id: parseInt(parentId),
        student_id: parseInt(linkStudent.user_id)
      });
      toast({ title: "Success", description: "Parent unlinked successfully" });
      await fetchLinkedParents(linkStudent.user_id);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const needsStream = editGrade === "11" || editGrade === "12";

  const handleNavClick = (id: RegistrarSection) => { setActiveSection(id); setMobileSidebarOpen(false); };

  const toggleGradeCollapse = (grade: number | null) => {
    const gradeKey = grade ?? 0; // Use 0 for null grades consistently
    setCollapsedGrades(prev => {
      const next = new Set(prev);
      if (next.has(gradeKey)) {
        next.delete(gradeKey);
      } else {
        next.add(gradeKey);
      }
      return next;
    });
  };

  const toggleStudentSelection = (userId: string) => {
    setSelectedStudents(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedStudents.size === filtered.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(filtered.map(s => s.user_id)));
    }
  };

  const handleBulkAssignment = async () => {
    if (selectedStudents.size === 0) return;
    
    // Check if at least one field is selected
    if (!bulkGrade && !bulkStream && !bulkSection && !bulkSubSection) {
      toast({ title: "Error", description: "Please select at least one field to update", variant: "destructive" });
      return;
    }
    
    // Confirmation for large operations
    if (selectedStudents.size > 20) {
      setBulkConfirmOpen(true);
      return;
    }
    
    await performBulkAssignment();
  };

  const performBulkAssignment = async () => {
    setBulkAssigning(true);
    setBulkConfirmOpen(false);
    
    try {
      // Prepare update data - only include fields that have values
      const updateData: any = {};
      if (bulkGrade) updateData.grade_level = bulkGrade === "none" ? null : parseInt(bulkGrade);
      if (bulkStream) updateData.stream = bulkStream === "none" ? null : bulkStream;
      if (bulkSection) updateData.section = bulkSection === "none" ? null : bulkSection;
      if (bulkSubSection) updateData.sub_section = bulkSubSection === "none" ? null : bulkSubSection;
      
      // Update each selected student with progress tracking
      const studentIds = Array.from(selectedStudents);
      const batchSize = 10; // Process in batches to avoid overwhelming the server
      
      for (let i = 0; i < studentIds.length; i += batchSize) {
        const batch = studentIds.slice(i, i + batchSize);
        const updatePromises = batch.map(studentId => 
          api.updateStudent(studentId, updateData)
        );
        
        await Promise.all(updatePromises);
        
        // Show progress for large operations
        if (selectedStudents.size > 20) {
          const progress = Math.min(i + batchSize, studentIds.length);
          toast({ 
            title: "Progress", 
            description: `Updated ${progress}/${studentIds.length} students...`,
            duration: 1000
          });
        }
      }
      
      // Build success message with details
      const updates: string[] = [];
      if (bulkGrade) updates.push(`Grade: ${bulkGrade === "none" ? "Removed" : `Grade ${bulkGrade}`}`);
      if (bulkStream) updates.push(`Stream: ${bulkStream === "none" ? "Removed" : bulkStream}`);
      if (bulkSection) updates.push(`Section: ${bulkSection === "none" ? "Removed" : bulkSection}`);
      if (bulkSubSection) updates.push(`Sub-Section: ${bulkSubSection === "none" ? "Removed" : bulkSubSection}`);
      
      toast({ 
        title: "Bulk Assignment Complete", 
        description: `Updated ${selectedStudents.size} student(s) with: ${updates.join(", ")}`,
        duration: 5000
      });
      
      // Reset state
      setSelectedStudents(new Set());
      setBulkGrade("");
      setBulkStream("");
      setBulkSection("");
      setBulkSubSection("");
      setBulkDialogOpen(false);
      fetchStudents(); // Refresh the list
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to update students", variant: "destructive" });
    }
    
    setBulkAssigning(false);
  };

  const getBadgeCount = (id: RegistrarSection) => {
    if (id === "students") return students.length;
    return null;
  };

  const renderContent = () => {
    switch (activeSection) {
      case "students":
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-foreground">Students</h2>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{students.length} total students</span>
                {(() => {
                  const gradeCounts = students.reduce((acc, student) => {
                    const grade = student.grade_level || 0;
                    acc[grade] = (acc[grade] || 0) + 1;
                    return acc;
                  }, {} as Record<number, number>);
                  
                  return Object.entries(gradeCounts)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([grade, count]) => (
                      <span key={grade} className="text-xs">
                        {grade === '0' ? 'Unassigned' : `Grade ${grade}`}: {count}
                      </span>
                    ));
                })()}
              </div>
            </div>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search name or ID..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 rounded-xl" />
              </div>
              <Select value={filterGrade} onValueChange={setFilterGrade}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Grade" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Grades</SelectItem>
                  {gradeLevels.map(g => <SelectItem key={g} value={String(g)}>Grade {g}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterStream} onValueChange={setFilterStream}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Stream" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Streams</SelectItem>
                  {streams.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            
            {/* Quick Selection Actions */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground">Quick Selection</h3>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {selectedStudents.size} selected
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setCollapsedGrades(new Set())}
                      className="rounded-lg text-xs h-6 px-2"
                    >
                      Expand All
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const allGrades = new Set(filtered.map(s => s.grade_level ?? 0));
                        setCollapsedGrades(allGrades);
                      }}
                      className="rounded-lg text-xs h-6 px-2"
                    >
                      Collapse All
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedStudents(new Set(filtered.filter(s => !s.grade_level).map(s => s.user_id)))}
                    className="rounded-lg text-xs"
                  >
                    Unassigned Grade ({filtered.filter(s => !s.grade_level).length})
                  </Button>
                  {[9, 10, 11, 12].map(grade => {
                    const gradeStudents = filtered.filter(s => s.grade_level === grade);
                    return (
                      <Button
                        key={grade}
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedStudents(new Set(gradeStudents.map(s => s.user_id)))}
                        className="rounded-lg text-xs"
                      >
                        Grade {grade} ({gradeStudents.length})
                      </Button>
                    );
                  })}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedStudents(new Set(filtered.filter(s => !s.section).map(s => s.user_id)))}
                    className="rounded-lg text-xs"
                  >
                    No Section ({filtered.filter(s => !s.section).length})
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedStudents(new Set(filtered.filter(s => !s.sub_section).map(s => s.user_id)))}
                    className="rounded-lg text-xs"
                  >
                    No Sub-Section ({filtered.filter(s => !s.sub_section).length})
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setSelectedStudents(new Set())}
                    className="rounded-lg text-xs"
                  >
                    Clear Selection
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-sm overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                  <p className="text-sm text-muted-foreground">{filtered.length} student(s)</p>
                  {selectedStudents.size > 0 && (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">{selectedStudents.size} selected</Badge>
                      <Button 
                        size="sm" 
                        onClick={() => setBulkDialogOpen(true)} 
                        className="rounded-lg text-xs gradient-primary border-0 text-white"
                      >
                        <CheckSquare className="h-3 w-3 mr-1" />
                        Bulk Assign
                      </Button>
                    </div>
                  )}
                </div>
                {loading ? <p className="p-6 text-center text-muted-foreground">Loading...</p> : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/20">
                          <TableHead className="w-10">
                            <Checkbox
                              checked={filtered.length > 0 && selectedStudents.size === filtered.length}
                              onCheckedChange={toggleSelectAll}
                            />
                          </TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>ID</TableHead>
                          <TableHead>Grade</TableHead>
                          <TableHead>Stream</TableHead>
                          <TableHead>Section</TableHead>
                          <TableHead>Sub-Section</TableHead>
                          <TableHead>Parent</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          let currentGrade: number | null = null;
                          const rows: React.ReactNode[] = [];
                          
                          filtered.forEach((s, index) => {
                            // Add grade level header when grade changes
                            if (s.grade_level !== currentGrade) {
                              currentGrade = s.grade_level;
                              const gradeKey = currentGrade ?? 0; // Use consistent key
                              const gradeStudentsCount = filtered.filter(student => student.grade_level === currentGrade).length;
                              const isCollapsed = collapsedGrades.has(gradeKey);
                              
                              // Capture the grade value in a closure to avoid stale closure issues
                              const gradeForClosure = currentGrade;
                              
                              rows.push(
                                <TableRow key={`grade-${currentGrade}`} className="bg-muted/50 hover:bg-muted/70 cursor-pointer transition-colors">
                                  <TableCell 
                                    colSpan={9} 
                                    className="font-bold text-primary py-3"
                                    onClick={() => toggleGradeCollapse(gradeForClosure)}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        {isCollapsed ? (
                                          <ChevronRight className="h-4 w-4 transition-transform" />
                                        ) : (
                                          <ChevronDown className="h-4 w-4 transition-transform" />
                                        )}
                                        <span>
                                          {gradeForClosure ? `Grade ${gradeForClosure}` : 'No Grade Assigned'}
                                        </span>
                                        {isCollapsed && (
                                          <span className="text-xs text-muted-foreground ml-2">
                                            (Click to expand)
                                          </span>
                                        )}
                                      </div>
                                      <Badge variant="outline" className="text-xs">
                                        {gradeStudentsCount} student{gradeStudentsCount !== 1 ? 's' : ''}
                                      </Badge>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            }
                            
                            // Add student row only if grade is not collapsed
                            const gradeKey = s.grade_level ?? 0; // Use consistent key
                            if (!collapsedGrades.has(gradeKey)) {
                              rows.push(
                                <TableRow key={s.user_id} className={cn("hover:bg-muted/30", selectedStudents.has(s.user_id) && "bg-primary/5")}>
                                  <TableCell>
                                    <Checkbox
                                      checked={selectedStudents.has(s.user_id)}
                                      onCheckedChange={() => toggleStudentSelection(s.user_id)}
                                    />
                                  </TableCell>
                                  <TableCell className="font-semibold">{s.full_name}</TableCell>
                                  <TableCell className="font-mono text-sm">{s.id_number}</TableCell>
                                  <TableCell>{s.grade_level || "—"}</TableCell>
                                  <TableCell className="capitalize">{s.stream || "—"}</TableCell>
                                  <TableCell className="capitalize">{s.section || "—"}</TableCell>
                                  <TableCell className="uppercase font-semibold">{s.sub_section || "—"}</TableCell>
                                  <TableCell className="text-sm">
                                    {s.parent_count > 0
                                      ? <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs">
                                          Parent ({s.parent_count})
                                        </Badge>
                                      : <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-xs">
                                          No Parent
                                        </Badge>}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex gap-2">
                                      <Button size="sm" variant="outline" className="rounded-lg text-xs" onClick={() => openEditDialog(s)}>Edit</Button>
                                      <Button size="sm" variant="outline" className="rounded-lg text-xs" onClick={() => { setImageTargetStudent(s.user_id); fileInputRef.current?.click(); }}>
                                        <Camera className="h-3 w-3" />
                                      </Button>
                                      <Button size="sm" variant="outline" className="rounded-lg text-xs" onClick={() => openLinkDialog(s)}>
                                        <Link2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            }
                          });
                          
                          if (filtered.length === 0) {
                            rows.push(
                              <TableRow key="no-students">
                                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">No students found</TableCell>
                              </TableRow>
                            );
                          }
                          
                          return rows;
                        })()}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );

      case "register":
        return (
          <div className="space-y-6 max-w-2xl">
            <div>
              <h2 className="text-xl font-bold text-foreground">Register New Students</h2>
              <p className="text-sm text-muted-foreground">Bulk create student accounts with automatic grade assignment</p>
            </div>
            
            {/* Grade Level & Class Assignment Settings */}
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Registration Settings</Label>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      checked={autoAssignClass} 
                      onCheckedChange={(checked) => setAutoAssignClass(checked === true)}
                      id="auto-assign"
                    />
                    <Label htmlFor="auto-assign" className="text-xs cursor-pointer">
                      Auto-assign grade & class
                    </Label>
                  </div>
                </div>
                
                {/* Quick Presets */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Quick Presets</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setAutoAssignClass(true);
                        setRegistrationGrade("9");
                        setRegistrationStream("");
                        setRegistrationSection("oromo");
                        setRegistrationSubSection("A");
                      }}
                      className="rounded-lg text-xs h-7"
                    >
                      Grade 9 - Oromo A
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setAutoAssignClass(true);
                        setRegistrationGrade("10");
                        setRegistrationStream("");
                        setRegistrationSection("amharic");
                        setRegistrationSubSection("A");
                      }}
                      className="rounded-lg text-xs h-7"
                    >
                      Grade 10 - Amharic A
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setAutoAssignClass(true);
                        setRegistrationGrade("11");
                        setRegistrationStream("natural");
                        setRegistrationSection("oromo");
                        setRegistrationSubSection("A");
                      }}
                      className="rounded-lg text-xs h-7"
                    >
                      Grade 11 - Natural
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setAutoAssignClass(true);
                        setRegistrationGrade("12");
                        setRegistrationStream("social");
                        setRegistrationSection("somali");
                        setRegistrationSubSection("A");
                      }}
                      className="rounded-lg text-xs h-7"
                    >
                      Grade 12 - Social
                    </Button>
                  </div>
                </div>
                
                {autoAssignClass && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Grade Level</Label>
                      <Select value={registrationGrade} onValueChange={setRegistrationGrade}>
                        <SelectTrigger className="rounded-xl h-8">
                          <SelectValue placeholder="Select grade" />
                        </SelectTrigger>
                        <SelectContent>
                          {gradeLevels.map((g) => (
                            <SelectItem key={g} value={String(g)}>Grade {g}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {(registrationGrade === "11" || registrationGrade === "12") && (
                      <div className="space-y-1">
                        <Label className="text-xs">Stream</Label>
                        <Select value={registrationStream} onValueChange={setRegistrationStream}>
                          <SelectTrigger className="rounded-xl h-8">
                            <SelectValue placeholder="Select stream" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Stream</SelectItem>
                            {streams.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    
                    <div className="space-y-1">
                      <Label className="text-xs">Section (Optional)</Label>
                      <Select value={registrationSection} onValueChange={setRegistrationSection}>
                        <SelectTrigger className="rounded-xl h-8">
                          <SelectValue placeholder="Select section" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Section</SelectItem>
                          {sections.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-1">
                      <Label className="text-xs">Sub-Section (Optional)</Label>
                      <Select value={registrationSubSection} onValueChange={setRegistrationSubSection}>
                        <SelectTrigger className="rounded-xl h-8">
                          <SelectValue placeholder="Select sub-section" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Sub-Section</SelectItem>
                          {subSections.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                
                {autoAssignClass && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-xs text-blue-700">
                      <strong>Auto-Assignment:</strong> All students will be registered for{' '}
                      <strong>Grade {registrationGrade}</strong>
                      {registrationStream && <span> - {registrationStream}</span>}
                      {registrationSection && <span> - {registrationSection}</span>}
                      {registrationSubSection && <span> - {registrationSubSection}</span>}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-6 space-y-5">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Students</Label>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setBulkInputOpen(true)}
                      className="rounded-lg text-xs h-7"
                    >
                      Bulk Input
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => addMultipleRows(5)}
                      className="rounded-lg text-xs h-7"
                    >
                      +5 Students
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => addMultipleRows(10)}
                      className="rounded-lg text-xs h-7"
                    >
                      +10 Students
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => addMultipleRows(20)}
                      className="rounded-lg text-xs h-7"
                    >
                      +20 Students
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {userRows.map((row, i) => (
                    <div key={i} className="space-y-2 p-3 rounded-xl border border-border/50 bg-muted/20">
                      <Input value={row.fullName} onChange={e => updateUserRow(i, "fullName", e.target.value)} placeholder={`Full Name ${i + 1}`} className="rounded-xl w-full" />
                      <div className="flex gap-2 items-center">
                        <Select value={row.gender} onValueChange={v => updateUserRow(i, "gender", v)}>
                          <SelectTrigger className="rounded-xl flex-1"><SelectValue placeholder="Gender" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex items-center flex-1">
                          <span className="bg-muted px-2.5 py-2 rounded-l-xl border border-r-0 border-input text-sm font-mono font-semibold text-muted-foreground">{idPrefixes.student}</span>
                          <Input value={row.idNumber} readOnly placeholder="001" className="rounded-l-none rounded-r-xl font-mono bg-muted/50 cursor-not-allowed" />
                        </div>
                        {userRows.length > 1 && <Button variant="ghost" size="icon" onClick={() => removeUserRow(i)} className="shrink-0 text-destructive rounded-xl">✕</Button>}
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addUserRow} className="w-full rounded-xl">+ Add Another Student</Button>
                </div>
                <Button onClick={handleCreateStudents} disabled={creating} className="w-full rounded-xl gradient-primary border-0 text-white h-11 font-semibold">
                  <UserPlus className="h-4 w-4 mr-2" />
                  {creating ? "Creating..." : `Create ${userRows.filter(r => r.fullName.trim()).length} Student(s)${autoAssignClass ? ` for Grade ${registrationGrade}` : ''}`}
                </Button>
                <p className="text-xs text-muted-foreground text-center">Credentials auto-generated: Username = firstname.lastname.id, Password = pass + ID</p>
              </CardContent>
            </Card>
          </div>
        );

      case "registration-period":
        return (
          <div className="space-y-6 max-w-2xl">
            <div>
              <h2 className="text-xl font-bold text-foreground">Registration Period Management</h2>
              <p className="text-sm text-muted-foreground">Control when students can register for courses</p>
            </div>

            {loadingRegistrationSettings ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">Loading registration settings...</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Registration Status */}
                <Card className="border-0 shadow-sm">
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`rounded-xl p-2.5 ${registrationOpen ? 'gradient-primary' : 'bg-muted'}`}>
                          <ClipboardList className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">Registration Status</p>
                          <p className="text-xs text-muted-foreground">
                            {registrationOpen ? 'Students can register for courses' : 'Registration is closed'}
                          </p>
                        </div>
                      </div>
                      <Badge 
                        className={cn(
                          "text-xs font-bold",
                          registrationOpen 
                            ? "gradient-primary border-0 text-white" 
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {registrationOpen ? 'OPEN' : 'CLOSED'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Registration Settings */}
                <Card className="border-0 shadow-sm">
                  <CardContent className="pt-6 space-y-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold">Enable Registration</Label>
                        <Checkbox 
                          checked={registrationOpen}
                          onCheckedChange={(checked) => setRegistrationOpen(checked === true)}
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold">Start Date</Label>
                          <Input
                            type="date"
                            value={registrationStartDate}
                            onChange={(e) => setRegistrationStartDate(e.target.value)}
                            className="rounded-xl"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold">End Date</Label>
                          <Input
                            type="date"
                            value={registrationEndDate}
                            onChange={(e) => setRegistrationEndDate(e.target.value)}
                            className="rounded-xl"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">Academic Year for Registration</Label>
                        <SimpleAcademicYearSelect
                          value={registrationAcademicYear}
                          onValueChange={setRegistrationAcademicYear}
                          placeholder="Select academic year for registration"
                          className="rounded-xl"
                        />
                        <p className="text-xs text-muted-foreground">
                          The academic year students will be registering for
                        </p>
                      </div>
                    </div>

                    <Button 
                      onClick={handleUpdateRegistrationSettings}
                      disabled={savingRegistrationSettings}
                      className="w-full rounded-xl gradient-primary border-0 text-white"
                    >
                      {savingRegistrationSettings ? "Saving..." : "Update Registration Settings"}
                    </Button>
                  </CardContent>
                </Card>

                {/* Registration Statistics */}
                <Card className="border-0 shadow-sm">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="gradient-accent rounded-xl p-2.5">
                        <CheckSquare className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">Student Account Statistics</p>
                        <p className="text-xs text-muted-foreground">Current student account overview</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="space-y-1">
                        <p className="text-2xl font-bold text-emerald-600">
                          {students.filter(s => s.is_active).length}
                        </p>
                        <p className="text-xs text-muted-foreground">Active Students</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-2xl font-bold text-amber-600">
                          {students.filter(s => !s.grade_level).length}
                        </p>
                        <p className="text-xs text-muted-foreground">Unassigned Grade</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-2xl font-bold text-foreground">
                          {students.length}
                        </p>
                        <p className="text-xs text-muted-foreground">Total Students</p>
                      </div>
                    </div>
                    
                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Grade Distribution:</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-center">
                        {[9, 10, 11, 12].map(grade => {
                          const count = students.filter(s => s.grade_level === grade).length;
                          return (
                            <div key={grade} className="bg-muted/30 rounded-lg p-2">
                              <p className="text-sm font-bold text-foreground">{count}</p>
                              <p className="text-xs text-muted-foreground">Grade {grade}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        );

      case "academic":
        return (
          <div className="space-y-6 w-full max-w-lg sm:max-w-2xl">
            <div>
              <h2 className="text-xl font-bold text-foreground">Academic Year</h2>
              <p className="text-sm text-muted-foreground">Manage the active academic year and archive results</p>
            </div>

            {/* Set Current Academic Year */}
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="gradient-accent rounded-xl p-2.5"><History className="h-5 w-5 text-white" /></div>
                    <div>
                      <p className="font-semibold text-foreground">Current Academic Year</p>
                      <p className="text-xs text-muted-foreground">Shown to teachers and registrar</p>
                    </div>
                  </div>
                  {currentAcademicYear && (
                    <div className="flex items-center gap-2">
                      <Badge className="gradient-accent border-0 text-white font-mono text-xs px-3 py-1">
                        {currentAcademicYear.replace('-', '/')}
                        {currentTerm ? ` · ${currentTerm}` : ''}
                      </Badge>
                      <Button
                        size="sm" variant="ghost"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg"
                        onClick={async () => {
                          try {
                            await api.setCurrentAcademicYear({ academic_year: '', term: '' });
                            setCurrentAcademicYear(null); setCurrentTerm(null);
                            setSettingYear(''); setSettingTerm('');
                            toast({ title: "Cleared", description: "Active academic year removed" });
                          } catch (e: any) {
                            toast({ title: "Error", description: e.message, variant: "destructive" });
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Academic Year</Label>
                    <SimpleAcademicYearSelect
                      value={settingYear.replace(/\//g, '-')}
                      onValueChange={(value) => setSettingYear(value.replace(/-/g, '/'))}
                      placeholder="Select academic year"
                      className="h-10 rounded-xl"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Semester</Label>
                    <Select value={settingTerm} onValueChange={setSettingTerm}>
                      <SelectTrigger className="rounded-xl h-10"><SelectValue placeholder="Select semester" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Semester 1">Semester 1</SelectItem>
                        <SelectItem value="Semester 2">Semester 2</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={handleSaveSettings} disabled={savingSettings} className="w-full rounded-xl gradient-accent border-0 text-white h-10 font-semibold">
                  {savingSettings ? "Saving..." : currentAcademicYear ? "Update Active Year" : "Set as Active Year"}
                </Button>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="bg-muted rounded-xl p-2.5"><History className="h-5 w-5 text-muted-foreground" /></div>
                  <div><p className="font-semibold text-foreground">Archive Academic Year</p><p className="text-sm text-muted-foreground">Permanently store all student results for an academic year</p></div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Academic Year to Archive</Label>
                  <SimpleAcademicYearSelect
                    value={archiveYear.replace('/', '-')}
                    onValueChange={(value) => setArchiveYear(value.replace('-', '/'))}
                    placeholder="Select year to archive"
                    className="h-10 rounded-xl"
                  />
                </div>
                <Button
                  onClick={() => {
                    const trimmedYear = archiveYear.trim();
                    if (!trimmedYear || !/^\d{4}[\/\-]\d{4}(\s*E\.C\.?)?$/i.test(trimmedYear)) { toast({ title: "Error", description: "Please enter a valid academic year (e.g., 2025-2026 or 2018-2019 E.C.)", variant: "destructive" }); return; }
                    setArchiveConfirmOpen(true);
                  }}
                  disabled={archiving}
                  className="w-full rounded-xl gradient-primary border-0 text-white h-11 font-semibold"
                >
                  <History className="h-4 w-4 mr-2" />{archiving ? "Archiving..." : "Archive Academic Year"}
                </Button>
              </CardContent>
            </Card>

            {/* Archived Years List */}
            <Card className="border-0 shadow-sm mt-6">
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-4">Archived Academic Years</h3>
                {loadingArchived ? (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                ) : archivedYears.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No archived years yet</p>
                ) : (
                  <div className="space-y-2">
                    {archivedYears.map((year) => (
                      <div key={year.academic_year} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="font-medium">{year.academic_year.replace('-', '/')}</p>
                          <p className="text-sm text-muted-foreground">{year.student_count} student(s) archived</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-xs text-muted-foreground">
                            {new Date(year.archived_at).toLocaleDateString()}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteYearConfirm(year.academic_year)}
                            disabled={deleting}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col -mx-4 sm:-mx-6 -mt-8 min-h-[calc(100vh-4rem)]">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

      <div className="flex items-center gap-3 p-4 border-b lg:hidden">
        <button onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)} className="p-2 rounded-xl bg-muted hover:bg-muted/80 transition-colors">
          <Menu className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          <span className="font-bold text-sm text-foreground">{sidebarItems.find(i => i.id === activeSection)?.label}</span>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {mobileSidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileSidebarOpen(false)} />}

        {/* Desktop sidebar */}
        <aside className={cn("shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex-col transition-all duration-300 hidden lg:flex", sidebarCollapsed ? "w-[68px]" : "w-60")}>
          <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
            {!sidebarCollapsed && <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-sidebar-primary" />
              <span className="font-bold text-sm">Registrar</span>
            </div>}
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
                  {!sidebarCollapsed && <>
                    <span className="flex-1 text-left">{label}</span>
                    {count !== null && <span className={cn("text-xs font-bold min-w-[20px] text-center rounded-full px-1.5 py-0.5", activeSection === id ? "bg-white/20" : "bg-sidebar-accent")}>{count}</span>}
                  </>}
                </button>
              );
            })}
          </nav>
          {!sidebarCollapsed && currentAcademicYear && (
            <div className="px-4 py-3 border-t border-sidebar-border">
              <p className="text-xs text-sidebar-foreground/50 uppercase tracking-wide mb-1">Academic Year</p>
              <p className="text-xs font-semibold text-sidebar-foreground">{currentAcademicYear}</p>
              {currentTerm && <p className="text-xs text-sidebar-foreground/60">{currentTerm}</p>}
            </div>
          )}
        </aside>

        {/* Mobile sidebar */}
        <aside className={cn("fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col transition-transform duration-300 lg:hidden", mobileSidebarOpen ? "translate-x-0" : "-translate-x-full")}>
          <div className="flex items-center gap-2 p-4 border-b border-sidebar-border">
            <ClipboardList className="h-5 w-5 text-sidebar-primary" />
            <span className="font-bold text-sm">Registrar</span>
          </div>
          <nav className="flex-1 p-3 space-y-1">
            {sidebarItems.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => handleNavClick(id)} className={cn("w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all", activeSection === id ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md" : "text-sidebar-foreground/70 hover:bg-sidebar-accent")}>
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">{label}</span>
              </button>
            ))}
          </nav>
          {currentAcademicYear && (
            <div className="px-4 py-3 border-t border-sidebar-border">
              <p className="text-xs text-sidebar-foreground/50 uppercase tracking-wide mb-1">Academic Year</p>
              <p className="text-xs font-semibold text-sidebar-foreground">{currentAcademicYear}</p>
              {currentTerm && <p className="text-xs text-sidebar-foreground/60">{currentTerm}</p>}
            </div>
          )}
        </aside>

        <main className="flex-1 min-w-0 p-6 lg:p-8">{renderContent()}</main>
      </div>

      {/* Edit Student Dialog */}
      <Dialog open={!!editStudent} onOpenChange={(open) => !open && setEditStudent(null)}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Student: {editStudent?.full_name}</DialogTitle>
          </DialogHeader>
          {editStudent && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select value={editGender} onValueChange={setEditGender}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select gender" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Grade Level</Label>
                <Select value={editGrade} onValueChange={v => { setEditGrade(v); if (v !== "11" && v !== "12") setEditStream(""); }}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select grade" /></SelectTrigger>
                  <SelectContent>
                    {[9,10,11,12].map(g => <SelectItem key={g} value={String(g)}>Grade {g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {needsStream && (
                <div className="space-y-2">
                  <Label>Stream</Label>
                  <Select value={editStream} onValueChange={setEditStream}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select stream" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="natural">Natural</SelectItem>
                      <SelectItem value="social">Social</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Section</Label>
                <Select value={editSection} onValueChange={setEditSection}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select section" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="oromo">Oromo</SelectItem>
                    <SelectItem value="amharic">Amharic</SelectItem>
                    <SelectItem value="somali">Somali</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sub-Section</Label>
                <Select value={editSubSection} onValueChange={setEditSubSection}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select sub-section" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {["A","B","C","D","E","F","G","H"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3">
                <DialogClose asChild>
                  <Button variant="outline" className="flex-1 rounded-xl">Cancel</Button>
                </DialogClose>
                <Button onClick={handleSaveEdit} disabled={saving} className="flex-1 rounded-xl gradient-primary border-0 text-white">
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Parent Linking Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link Parent to {linkStudent?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {linkedParents.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground">Current Linked Parent</Label>
                {linkedParents.map(lp => (
                  <div key={lp.parent_id} className="flex items-center justify-between bg-muted/30 rounded-xl px-3 py-2">
                    <span className="text-sm font-medium">{lp.full_name}</span>
                    <Button size="sm" variant="ghost" className="text-destructive text-xs" onClick={() => unlinkParent(lp.parent_id)}>Unlink</Button>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">{linkedParents.length > 0 ? "Replace with" : "Available Parents"}</Label>
              {parents.filter(p => !linkedParents.some(lp => lp.parent_id === p.user_id)).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No parent accounts available. Create parent accounts from the Admin panel first.</p>
              ) : (
                parents.filter(p => !linkedParents.some(lp => lp.parent_id === p.user_id)).map(p => (
                  <div key={p.user_id} className="flex items-center justify-between bg-muted/30 rounded-xl px-3 py-2">
                    <span className="text-sm font-medium">{p.full_name}</span>
                    <Button size="sm" className="text-xs gradient-accent border-0 text-white rounded-lg" onClick={() => linkParent(p.user_id)}>
                      {linkedParents.length > 0 ? "Replace" : "Link"}
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <SuccessModal open={!!successModal} onClose={() => setSuccessModal(null)} title={successModal?.title || ""} description={successModal?.description} credentials={successModal?.credentials} />

      <AlertDialog open={archiveConfirmOpen} onOpenChange={setArchiveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Academic Year</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently archive all student results for <strong>{archiveYear}</strong>. This action cannot be undone and the year cannot be re-archived.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchiveYear} disabled={archiving} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {archiving ? "Archiving..." : "Archive Year"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteYearConfirm} onOpenChange={() => setDeleteYearConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Archived Year</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the archived data for <strong>{deleteYearConfirm?.replace('-', '/')}</strong>? This will permanently remove all archived student results for this year. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteYearConfirm && handleDeleteYear(deleteYearConfirm)} 
              disabled={deleting} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete Year"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Assignment Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Assign Students</DialogTitle>
            <p className="text-xs text-muted-foreground">
              Update {selectedStudents.size} selected student(s). Leave fields empty to keep current values.
            </p>
          </DialogHeader>
          
          {/* Quick Presets */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Quick Presets</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setBulkGrade("9");
                  setBulkStream("");
                  setBulkSection("oromo");
                  setBulkSubSection("A");
                }}
                className="rounded-lg text-[10px] h-7"
              >
                Grade 9 - Oromo A
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setBulkGrade("10");
                  setBulkStream("");
                  setBulkSection("amharic");
                  setBulkSubSection("A");
                }}
                className="rounded-lg text-[10px] h-7"
              >
                Grade 10 - Amharic A
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setBulkGrade("11");
                  setBulkStream("natural");
                  setBulkSection("oromo");
                  setBulkSubSection("A");
                }}
                className="rounded-lg text-[10px] h-7"
              >
                Grade 11 - Natural
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setBulkGrade("12");
                  setBulkStream("social");
                  setBulkSection("somali");
                  setBulkSubSection("A");
                }}
                className="rounded-lg text-[10px] h-7"
              >
                Grade 12 - Social
              </Button>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setBulkGrade("");
                setBulkStream("");
                setBulkSection("");
                setBulkSubSection("");
              }}
              className="rounded-lg text-xs w-full h-7"
            >
              Clear All Fields
            </Button>
          </div>
          
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Grade Level</Label>
              <Select value={bulkGrade} onValueChange={setBulkGrade}>
                <SelectTrigger className="rounded-xl h-8">
                  <SelectValue placeholder="Keep current grade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Remove Grade</SelectItem>
                  {[9, 10, 11, 12].map((g) => (
                    <SelectItem key={g} value={String(g)}>Grade {g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1">
              <Label className="text-xs">Stream</Label>
              <Select value={bulkStream} onValueChange={setBulkStream}>
                <SelectTrigger className="rounded-xl h-8">
                  <SelectValue placeholder="Keep current stream" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Remove Stream</SelectItem>
                  <SelectItem value="natural">Natural</SelectItem>
                  <SelectItem value="social">Social</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1">
              <Label className="text-xs">Section</Label>
              <Select value={bulkSection} onValueChange={setBulkSection}>
                <SelectTrigger className="rounded-xl h-8">
                  <SelectValue placeholder="Keep current section" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Remove Section</SelectItem>
                  <SelectItem value="oromo">Oromo</SelectItem>
                  <SelectItem value="amharic">Amharic</SelectItem>
                  <SelectItem value="somali">Somali</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1">
              <Label className="text-xs">Sub-Section</Label>
              <Select value={bulkSubSection} onValueChange={setBulkSubSection}>
                <SelectTrigger className="rounded-xl h-8">
                  <SelectValue placeholder="Keep current sub-section" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Remove Sub-Section</SelectItem>
                  {["A", "B", "C", "D", "E", "F", "G", "H"].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex gap-2 pt-2">
            <DialogClose asChild>
              <Button variant="outline" className="flex-1 rounded-xl h-8 text-xs">Cancel</Button>
            </DialogClose>
            <Button
              onClick={handleBulkAssignment}
              disabled={bulkAssigning}
              className="flex-1 rounded-xl gradient-primary border-0 text-white h-8 text-xs"
            >
              {bulkAssigning ? "Updating..." : "Update Students"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Assignment Confirmation Dialog */}
      <AlertDialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Bulk Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to update <strong>{selectedStudents.size} students</strong>. This operation cannot be undone. 
              {(() => {
                const updates: string[] = [];
                if (bulkGrade) updates.push(`Grade: ${bulkGrade === "none" ? "Remove" : `Grade ${bulkGrade}`}`);
                if (bulkStream) updates.push(`Stream: ${bulkStream === "none" ? "Remove" : bulkStream}`);
                if (bulkSection) updates.push(`Section: ${bulkSection === "none" ? "Remove" : bulkSection}`);
                if (bulkSubSection) updates.push(`Sub-Section: ${bulkSubSection === "none" ? "Remove" : bulkSubSection}`);
                return updates.length > 0 ? ` The following will be updated: ${updates.join(", ")}.` : "";
              })()}
              <br /><br />
              Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkAssigning}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={performBulkAssignment}
              disabled={bulkAssigning}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {bulkAssigning ? "Updating..." : "Update Students"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Names Input Dialog */}
      <Dialog open={bulkInputOpen} onOpenChange={setBulkInputOpen}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Name Input</DialogTitle>
            <p className="text-xs text-muted-foreground">
              Enter student names, one per line. They will be added to the registration form.
            </p>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">Student Names</Label>
              <textarea
                value={bulkNames}
                onChange={(e) => setBulkNames(e.target.value)}
                placeholder="John Doe&#10;M Ahmed Ali&#10;F Sara Mohamed&#10;Bob Johnson&#10;..."
                className="w-full h-32 p-3 text-sm border border-input rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  Enter one name per line. Empty lines will be ignored.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                  <p className="text-xs text-blue-700 font-medium mb-1">💡 Gender Auto-Detection:</p>
                  <p className="text-xs text-blue-600">
                    • Start with <strong>"M "</strong> for male students: <code>M John Doe</code><br/>
                    • Start with <strong>"F "</strong> for female students: <code>F Jane Smith</code><br/>
                    • The prefix will be removed and gender auto-assigned
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <DialogClose asChild>
              <Button variant="outline" className="flex-1 rounded-xl">Cancel</Button>
            </DialogClose>
            <Button
              onClick={processBulkNames}
              className="flex-1 rounded-xl gradient-primary border-0 text-white"
            >
              Add Names
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
