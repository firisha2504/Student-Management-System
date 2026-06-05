import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api, getAssetUrl } from "@/services/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useIdPrefixes, useSchoolConfig } from "@/contexts/SchoolConfigContext";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  Shield, UserPlus, Lock, Users, Search,
  ChevronLeft, ChevronRight, ChevronDown, Settings, Menu, ImageIcon, Upload, Key, Copy, Check, ArrowUpCircle, ClipboardList, Trash2, BookOpen, Edit, Plus
} from "lucide-react";
import { cn } from "@/lib/utils";
import SuccessModal from "@/components/SuccessModal";
import TeacherRequests from "@/components/admin/TeacherRequests";

interface UserWithRole {
  user_id: string;
  full_name: string;
  username: string;
  id_number: string;
  is_active: boolean;
  role: string;
  grade_level: number | null;
  stream: string | null;
  section: string | null;
  sub_section: string | null;
}

type AdminSection = "users" | "create" | "requests" | "credentials" | "subjects" | "settings";

const sidebarItems: { id: AdminSection; label: string; icon: React.ElementType }[] = [
  { id: "users", label: "All Users", icon: Users },
  { id: "create", label: "Create Account", icon: UserPlus },
  { id: "requests", label: "Teacher Requests", icon: ClipboardList },
  { id: "credentials", label: "Credentials", icon: Key },
  { id: "subjects", label: "Subjects", icon: BookOpen },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function Admin() {
  const { role } = useAuth();
  const { toast } = useToast();
  const idPrefixes = useIdPrefixes();
  const { config } = useSchoolConfig();


  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [systemLocked, setSystemLocked] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [activeSection, setActiveSection] = useState<AdminSection>("users");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Create user form
  const [createRole, setCreateRole] = useState<string>("registrar");
  const [creating, setCreating] = useState(false);
  const [userRows, setUserRows] = useState<{ fullName: string; idNumber: string; gender: string }[]>([
    { fullName: "", idNumber: "", gender: "" }
  ]);

  // School logo
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Success modal
  const [successModal, setSuccessModal] = useState<{
    title: string;
    description?: string;
    credentials?: { name: string; username: string; password: string }[]
  } | null>(null);

  // Delete user state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserWithRole | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Year-end promotion
  const [promoting, setPromoting] = useState(false);
  const [promotionResults, setPromotionResults] = useState<any>(null);
  const [promotionConfirmOpen, setPromotionConfirmOpen] = useState(false);
  // Rollback
  const [rollingBack, setRollingBack] = useState(false);
  const [rollbackYear, setRollbackYear] = useState("");
  const [rollbackConfirmOpen, setRollbackConfirmOpen] = useState(false);
  const [rollbackResults, setRollbackResults] = useState<any>(null);

  // Credentials log
  const [credentialsLog, setCredentialsLog] = useState<{
    id: string;
    full_name: string;
    username: string;
    password: string;
    role: string;
    created_at: string;
  }[]>([]);
  const [loadingCredentials, setLoadingCredentials] = useState(false);
  const [copiedCredId, setCopiedCredId] = useState<string | null>(null);
  const [collapsedCredGrades, setCollapsedCredGrades] = useState<Set<string>>(new Set());
  const [collapsedCredSubSections, setCollapsedCredSubSections] = useState<Set<string>>(new Set());
  // User list collapse state (grade → sub-section for students)
  const [collapsedUserGrades, setCollapsedUserGrades] = useState<Set<string>>(new Set());
  const [collapsedUserSubs, setCollapsedUserSubs] = useState<Set<string>>(new Set());

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all");

  // Subjects management
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [subjectForm, setSubjectForm] = useState({
    subject_name: "",
    subject_code: "",
    description: "",
    credit_hours: 3,
    ects: 5,
    grade_level: 9,
    stream: ""
  });
  const [editingSubject, setEditingSubject] = useState<any>(null);
  const [showSubjectForm, setShowSubjectForm] = useState(false);
  const [showBulkSubjectForm, setShowBulkSubjectForm] = useState(false);
  const [bulkSubjects, setBulkSubjects] = useState<typeof subjectForm[]>([]);
  const [credFilterRole, setCredFilterRole] = useState("all");
  const [deleteSubjectConfirmOpen, setDeleteSubjectConfirmOpen] = useState(false);
  const [subjectToDelete, setSubjectToDelete] = useState<any>(null);
  const [deletingSubject, setDeletingSubject] = useState(false);

  const showSuccess = (title: string, description?: string) => setSuccessModal({ title, description });


  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const data = await api.getAllUsers();
      setUsers(data);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to fetch users", variant: "destructive" });
    }
    setLoadingUsers(false);
  };

  const fetchSystemLock = async () => {
    try {
      const settings = await api.getSystemSettings();
      setSystemLocked(settings.system_locked === 'true');
      if (settings.school_logo) {
        const logoUrl = getAssetUrl(settings.school_logo);
        console.log('Logo from DB:', settings.school_logo);
        console.log('Full logo URL:', logoUrl);
        setSchoolLogo(logoUrl);
      }
    } catch (error: any) {
      console.error('Failed to fetch system settings:', error);
    }
  };

  const fetchCredentialsLog = async () => {
    setLoadingCredentials(true);
    try {
      const data = await api.getCredentialsLog();
      setCredentialsLog(data);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to fetch credentials", variant: "destructive" });
    }
    setLoadingCredentials(false);
  };

  useEffect(() => {
    fetchUsers();
    fetchSystemLock();
    fetchCredentialsLog();
  }, []);

  useEffect(() => {
    if (activeSection === "credentials") fetchCredentialsLog();
  }, [activeSection]);

  useEffect(() => {
    console.log('schoolLogo state changed:', schoolLogo);
  }, [schoolLogo]);

  if (role !== "admin") return <p className="text-destructive">Access denied.</p>;

  const toggleSystemLock = async () => {
    const newValue = !systemLocked;
    try {
      await api.updateSystemLock(newValue);
      setSystemLocked(newValue);
      showSuccess(newValue ? "System Locked" : "System Unlocked");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const toggleUserActive = async (userId: string, currentActive: boolean) => {
    try {
      await api.toggleUserStatus(userId, !currentActive);
      fetchUsers();
      showSuccess(currentActive ? "User Deactivated" : "User Activated");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const confirmDeleteUser = (user: UserWithRole) => {
    setUserToDelete(user);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setDeleting(true);
    try {
      await api.deleteUser(userToDelete.user_id);
      showSuccess("User Deleted", `${userToDelete.full_name} has been removed.`);
      fetchUsers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    setDeleting(false);
    setDeleteConfirmOpen(false);
    setUserToDelete(null);
  };

  const addUserRow = () => setUserRows(prev => [...prev, { fullName: "", idNumber: "", gender: "" }]);
  const removeUserRow = (i: number) => setUserRows(prev => prev.filter((_, idx) => idx !== i));
  const updateUserRow = (i: number, field: "fullName" | "idNumber" | "gender", value: string) => {
    setUserRows(prev => {
      const u = [...prev];
      u[i] = { ...u[i], [field]: value };
      return u;
    });
  };


  const handleCreateUsers = async () => {
    const validRows = userRows.filter(r => r.fullName.trim() && r.idNumber.trim());
    if (validRows.length === 0) {
      toast({ title: "Error", description: "Fill at least one name and ID.", variant: "destructive" });
      return;
    }
    setCreating(true);
    
    const creds: { name: string; username: string; password: string }[] = [];
    const errors: string[] = [];

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      
      // Generate unique email using multiple factors
      const timestamp = Date.now();
      const randomSuffix = Math.floor(Math.random() * 100000);
      const nameHash = row.fullName.toLowerCase().replace(/\s+/g, '');
      const email = `${nameHash}.${timestamp}.${i}.${randomSuffix}@${config.system?.emailDomain || 'school.com'}`;

      try {
        const result = await api.createUser({
          email,
          full_name: row.fullName.trim(),
          role: createRole,
          gender: row.gender || undefined
        });
        
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
      setSuccessModal({
        title: `${creds.length} ${createRole.charAt(0).toUpperCase() + createRole.slice(1)} Account(s) Created!`,
        description: "Share these credentials",
        credentials: creds,
      });
      setUserRows([{ fullName: "", idNumber: "", gender: "" }]);
      fetchUsers();
      fetchCredentialsLog();
    }
    
    if (errors.length > 0) {
      toast({ title: "Some errors", description: errors.join("; "), variant: "destructive" });
    }
    
    setCreating(false);
  };

  const handlePromoteStudents = async () => {
    setPromoting(true);
    setPromotionConfirmOpen(false);
    try {
      const data = await api.promoteStudents();
      setPromotionResults(data);
      showSuccess("Year-End Promotion Complete", `${data.summary.promoted} promoted, ${data.summary.retained} retained, ${data.summary.graduated} graduated`);
      fetchUsers();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setPromoting(false);
  };

  const handleRollbackPromotion = async () => {
    if (!rollbackYear.trim()) return;
    setRollingBack(true);
    setRollbackConfirmOpen(false);
    try {
      const formatted = rollbackYear.trim().replace('/', '-');
      const data = await api.rollbackPromotion(formatted);
      setRollbackResults(data);
      showSuccess("Rollback Complete", `Restored ${data.restored} student(s), reactivated ${data.reactivated} graduated student(s).`);
      fetchUsers();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setRollingBack(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Error", description: "Please select an image file.", variant: "destructive" });
      if (logoInputRef.current) logoInputRef.current.value = '';
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Error", description: "Image must be less than 2MB.", variant: "destructive" });
      if (logoInputRef.current) logoInputRef.current.value = '';
      return;
    }

    setUploadingLogo(true);
    try {
      const result = await api.uploadSchoolLogo(file);
      setSchoolLogo(getAssetUrl(result.logoUrl));
      showSuccess("Logo Uploaded", "School logo has been updated successfully");
      if (logoInputRef.current) logoInputRef.current.value = '';
    } catch (error: any) {
      console.error('Logo upload error:', error);
      toast({ title: "Error", description: error.message || "Failed to upload logo", variant: "destructive" });
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
    setUploadingLogo(false);
  };

  const handleRemoveLogo = async () => {
    try {
      await api.deleteSchoolLogo();
      setSchoolLogo(null);
      showSuccess("Logo Removed");
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to remove logo", variant: "destructive" });
    }
  };

  const copyCredential = (cred: { id: string; username: string; password: string }) => {
    navigator.clipboard.writeText(`Username: ${cred.username}\nPassword: ${cred.password}`);
    setCopiedCredId(cred.id);
    setTimeout(() => setCopiedCredId(null), 2000);
  };

  // Subject Management Functions
  const fetchSubjects = async () => {
    setLoadingSubjects(true);
    try {
      const data = await api.getAllSubjects();
      // Sort subjects by grade level, then by subject name
      const sortedData = data.sort((a: any, b: any) => {
        if (a.grade_level !== b.grade_level) {
          return (a.grade_level || 0) - (b.grade_level || 0);
        }
        return a.subject_name.localeCompare(b.subject_name);
      });
      setSubjects(sortedData);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to fetch subjects", variant: "destructive" });
    }
    setLoadingSubjects(false);
  };

  useEffect(() => {
    if (activeSection === "subjects") {
      fetchSubjects();
    }
  }, [activeSection]);

  const handleCreateSubject = async () => {
    if (!subjectForm.subject_name) {
      toast({ title: "Error", description: "Subject name is required", variant: "destructive" });
      return;
    }

    // Validate stream for Grade 11-12
    if (subjectForm.grade_level >= 11 && !subjectForm.stream) {
      toast({ title: "Error", description: "Stream is required for Grade 11 and 12", variant: "destructive" });
      return;
    }

    try {
      // Auto-generate subject code with grade level and timestamp for uniqueness
      const timestamp = Date.now().toString().slice(-4);
      const subjectCode = subjectForm.subject_name
        .toLowerCase()
        .replace(/\s+/g, '')
        .substring(0, 6) + subjectForm.grade_level + timestamp;

      // Prepare data - ensure stream is null for grades 9-10
      const dataToSend = {
        subject_name: subjectForm.subject_name,
        subject_code: subjectCode,
        description: subjectForm.description || '',
        credit_hours: 3,
        ects: 5,
        grade_level: subjectForm.grade_level,
        stream: subjectForm.grade_level >= 11 ? subjectForm.stream : null
      };
      
      await api.createSubject(dataToSend);
      showSuccess("Subject Created", `${subjectForm.subject_name} has been added`);
      setSubjectForm({
        subject_name: "",
        subject_code: "",
        description: "",
        credit_hours: 3,
        ects: 5,
        grade_level: 9,
        stream: ""
      });
      setShowSubjectForm(false);
      fetchSubjects();
    } catch (error: any) {
      console.error('Create subject error:', error);
      toast({ title: "Error", description: error.message || "Failed to create subject", variant: "destructive" });
    }
  };

  const handleBulkCreateSubjects = async () => {
    // Validate all subjects
    const validSubjects = bulkSubjects.filter(s => s.subject_name);
    
    if (validSubjects.length === 0) {
      toast({ title: "Error", description: "At least one subject with name is required", variant: "destructive" });
      return;
    }

    try {
      let successCount = 0;
      let errorCount = 0;
      
      for (const subject of validSubjects) {
        try {
          // Auto-generate subject code with grade level and timestamp for uniqueness
          const timestamp = Date.now().toString().slice(-4);
          const subjectCode = subject.subject_name
            .toLowerCase()
            .replace(/\s+/g, '')
            .substring(0, 6) + subject.grade_level + timestamp;

          const dataToSend = {
            subject_name: subject.subject_name,
            subject_code: subjectCode,
            description: subject.description || '',
            credit_hours: 3,
            ects: 5,
            grade_level: subject.grade_level,
            stream: subject.grade_level >= 11 ? subject.stream : null
          };

          await api.createSubject(dataToSend);
          successCount++;
          
          // Small delay to ensure unique timestamps
          await new Promise(resolve => setTimeout(resolve, 10));
        } catch (error) {
          errorCount++;
        }
      }
      
      if (successCount > 0) {
        showSuccess(
          "Subjects Created", 
          `${successCount} subject${successCount > 1 ? 's' : ''} created successfully${errorCount > 0 ? `, ${errorCount} failed` : ''}`
        );
      }
      
      setShowBulkSubjectForm(false);
      setBulkSubjects([]);
      fetchSubjects();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleUpdateSubject = async () => {
    if (!editingSubject) return;

    try {
      await api.updateSubject(editingSubject.id, subjectForm);
      showSuccess("Subject Updated", `${subjectForm.subject_name} has been updated`);
      setEditingSubject(null);
      setShowSubjectForm(false);
      fetchSubjects();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const confirmDeleteSubject = (subject: any) => {
    setSubjectToDelete(subject);
    setDeleteSubjectConfirmOpen(true);
  };

  const handleDeleteSubject = async () => {
    if (!subjectToDelete) return;
    setDeletingSubject(true);
    try {
      await api.deleteSubject(subjectToDelete.id);
      showSuccess("Subject Deleted", `${subjectToDelete.subject_name} has been removed.`);
      fetchSubjects();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    setDeletingSubject(false);
    setDeleteSubjectConfirmOpen(false);
    setSubjectToDelete(null);
  };

  const startEditSubject = (subject: any) => {
    setEditingSubject(subject);
    setSubjectForm({
      subject_name: subject.subject_name,
      subject_code: subject.subject_code,
      description: subject.description || "",
      credit_hours: subject.credit_hours,
      ects: subject.ects,
      grade_level: subject.grade_level || 9,
      stream: subject.stream || "Common"
    });
    setShowSubjectForm(true);
  };


  const filteredUsers = users
    .filter(u => {
      const q = searchQuery.toLowerCase();
      if (q && !u.full_name.toLowerCase().includes(q) && !u.id_number.toLowerCase().includes(q) && !u.username.toLowerCase().includes(q)) return false;
      if (filterRole !== "all" && u.role !== filterRole) return false;
      return true;
    })
    .sort((a, b) => {
      // Students: sort by grade → stream → sub-section → name
      if (a.role === 'student' && b.role === 'student') {
        const gA = a.grade_level || 0, gB = b.grade_level || 0;
        if (gA !== gB) return gA - gB;
        const stA = a.stream || '', stB = b.stream || '';
        if (stA !== stB) return stA.localeCompare(stB);
        const subA = a.sub_section || '—', subB = b.sub_section || '—';
        if (subA !== subB) return subA.localeCompare(subB);
        return (a.full_name || '').localeCompare(b.full_name || '');
      }
      // Others: sort by ID
      const idA = parseInt(a.id_number) || 0;
      const idB = parseInt(b.id_number) || 0;
      return idA - idB;
    });

  const roleCounts = {
    student: users.filter(u => u.role === "student").length,
    teacher: users.filter(u => u.role === "teacher").length,
    registrar: users.filter(u => u.role === "registrar").length,
    director: users.filter(u => u.role === "director").length,
    parent: users.filter(u => u.role === "parent").length,
    admin: users.filter(u => u.role === "admin").length,
  };

  const handleNavClick = (id: AdminSection) => {
    setActiveSection(id);
    setMobileSidebarOpen(false);
  };


  const renderContent = () => {
    switch (activeSection) {
      case "users": {
        const isStudentFilter = filterRole === "student";

        // Build grade → sub_section groups for student view
        const userGradeMap = new Map<string, Map<string, UserWithRole[]>>();
        if (isStudentFilter) {
          filteredUsers.forEach(u => {
            const gradeKey = u.grade_level ? `Grade ${u.grade_level}` : "Unassigned";
            const subKey = u.sub_section || "—";
            if (!userGradeMap.has(gradeKey)) userGradeMap.set(gradeKey, new Map());
            const subMap = userGradeMap.get(gradeKey)!;
            if (!subMap.has(subKey)) subMap.set(subKey, []);
            subMap.get(subKey)!.push(u);
          });
        }

        const toggleUG = (k: string) => setCollapsedUserGrades(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });
        const toggleUS = (k: string) => setCollapsedUserSubs(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });

        const userRow = (u: UserWithRole, idx?: number) => (
          <TableRow key={u.user_id} className="hover:bg-muted/30">
            {idx !== undefined && <TableCell className="text-xs text-muted-foreground w-8">{idx + 1}</TableCell>}
            <TableCell className="font-semibold">{u.full_name}</TableCell>
            <TableCell className="text-muted-foreground text-sm">{u.username}</TableCell>
            <TableCell className="font-mono text-sm">{u.id_number}</TableCell>
            <TableCell>
              <Badge variant="outline" className="text-xs capitalize">{u.role}</Badge>
            </TableCell>
            <TableCell>
              <Badge variant={u.is_active ? "default" : "destructive"} className={cn("text-xs", u.is_active && "gradient-accent border-0 text-white")}>
                {u.is_active ? "Active" : "Inactive"}
              </Badge>
            </TableCell>
            <TableCell>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="rounded-lg text-xs" onClick={() => toggleUserActive(u.user_id, u.is_active)}>
                  {u.is_active ? "Deactivate" : "Activate"}
                </Button>
                {u.role !== "admin" && (
                  <Button size="sm" variant="outline" className="rounded-lg text-xs text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => confirmDeleteUser(u)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        );

        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">All Users</h2>
              <p className="text-sm text-muted-foreground">{users.length} total accounts</p>
            </div>

            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
              {(["student", "teacher", "registrar", "director", "parent", "admin"] as const).map(r => (
                <Card key={r} className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterRole(filterRole === r ? "all" : r)}>
                  <CardContent className="pt-4 pb-3 text-center">
                    <p className="text-xl font-extrabold text-foreground">{roleCounts[r]}</p>
                    <p className="text-xs text-muted-foreground font-medium capitalize">{r}s</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search name, username, or ID..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 rounded-xl" />
              </div>
              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Filter by role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="student">Students</SelectItem>
                  <SelectItem value="teacher">Teachers</SelectItem>
                  <SelectItem value="registrar">Registrars</SelectItem>
                  <SelectItem value="director">Directors</SelectItem>
                  <SelectItem value="parent">Parents</SelectItem>
                  <SelectItem value="admin">Admins</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Collapse controls for student view */}
            {isStudentFilter && filteredUsers.length > 0 && (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="rounded-lg text-xs h-7 px-2" onClick={() => setCollapsedUserGrades(new Set())}>Expand All</Button>
                <Button size="sm" variant="outline" className="rounded-lg text-xs h-7 px-2" onClick={() => setCollapsedUserGrades(new Set(Array.from(userGradeMap.keys())))}>Collapse All</Button>
              </div>
            )}

            <p className="text-sm text-muted-foreground">{filteredUsers.length} user(s)</p>

            {loadingUsers ? (
              <p className="p-6 text-center text-muted-foreground">Loading...</p>
            ) : isStudentFilter ? (
              // Students: Grade → Sub-Section → rows
              <div className="space-y-3">
                {Array.from(userGradeMap.entries())
                  .sort(([a], [b]) => (parseInt(a.replace("Grade ", "")) || 999) - (parseInt(b.replace("Grade ", "")) || 999))
                  .map(([gradeLabel, subMap]) => {
                    const gradeTotal = Array.from(subMap.values()).reduce((s, arr) => s + arr.length, 0);
                    const gradeCollapsed = collapsedUserGrades.has(gradeLabel);
                    return (
                      <Card key={gradeLabel} className="border-0 shadow-sm overflow-hidden">
                        <button className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors border-b border-border/50" onClick={() => toggleUG(gradeLabel)}>
                          <div className="flex items-center gap-2">
                            <ChevronDown className={cn("h-4 w-4 text-primary transition-transform", gradeCollapsed && "-rotate-90")} />
                            <span className="font-bold text-sm text-foreground">{gradeLabel}</span>
                            <Badge className="text-xs gradient-primary border-0 text-white">{gradeTotal} students</Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">{subMap.size} sub-section{subMap.size !== 1 ? "s" : ""}</span>
                        </button>
                        {!gradeCollapsed && (
                          <div className="divide-y divide-border/30">
                            {Array.from(subMap.entries())
                              .sort(([a], [b]) => a.localeCompare(b))
                              .map(([subLabel, subUsers]) => {
                                const subKey = `${gradeLabel}__${subLabel}`;
                                const subCollapsed = collapsedUserSubs.has(subKey);
                                return (
                                  <div key={subLabel}>
                                    <button className="w-full flex items-center justify-between px-5 py-2 bg-muted/20 hover:bg-muted/40 transition-colors" onClick={() => toggleUS(subKey)}>
                                      <div className="flex items-center gap-2">
                                        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", subCollapsed && "-rotate-90")} />
                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                          {subLabel === "—" ? "No Sub-Section" : `Sub-Section ${subLabel}`}
                                        </span>
                                        <Badge variant="outline" className="text-xs">{subUsers.length}</Badge>
                                      </div>
                                    </button>
                                    {!subCollapsed && (
                                      <div className="overflow-x-auto">
                                        <Table>
                                          <TableHeader>
                                            <TableRow className="bg-muted/10">
                                              <TableHead className="w-8">#</TableHead>
                                              <TableHead>Name</TableHead>
                                              <TableHead>Username</TableHead>
                                              <TableHead>ID</TableHead>
                                              <TableHead>Role</TableHead>
                                              <TableHead>Status</TableHead>
                                              <TableHead>Action</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {subUsers.map((u, i) => userRow(u, i))}
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
                {filteredUsers.length === 0 && (
                  <Card className="border-0 shadow-sm"><CardContent className="py-8 text-center text-muted-foreground">No students match filters</CardContent></Card>
                )}
              </div>
            ) : (
              // Non-student: flat table
              <Card className="border-0 shadow-sm overflow-hidden">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/20">
                          <TableHead>Name</TableHead>
                          <TableHead>Username</TableHead>
                          <TableHead>ID</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.map(u => userRow(u))}
                        {filteredUsers.length === 0 && (
                          <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No users match filters</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        );
      }


      case "create":
        return (
          <div className="space-y-6 max-w-2xl">
            <div>
              <h2 className="text-xl font-bold text-foreground">Create Accounts</h2>
              <p className="text-sm text-muted-foreground">
                Create accounts for Teacher, Registrar, Director, or Parent. Students are registered by the Registrar.
              </p>
            </div>

            <Card className="border-0 shadow-sm">
              <CardContent className="pt-6 space-y-5">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Role</Label>
                  <Select value={createRole} onValueChange={(v) => { setCreateRole(v); setUserRows([{ fullName: "", idNumber: "", gender: "" }]); }}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="registrar">Registrar</SelectItem>
                      <SelectItem value="director">Director</SelectItem>
                      <SelectItem value="parent">Parent</SelectItem>
                      <SelectItem value="teacher">Teacher</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Users</Label>
                  {userRows.map((row, i) => (
                    <div key={i} className="space-y-2 p-3 rounded-xl border border-border/50 bg-muted/20">
                      <Input 
                        value={row.fullName} 
                        onChange={e => updateUserRow(i, "fullName", e.target.value)} 
                        placeholder={`Full Name ${i + 1}`} 
                        className="rounded-xl w-full" 
                      />
                      <div className="flex gap-2 items-center">
                        <Select value={row.gender} onValueChange={v => updateUserRow(i, "gender", v)}>
                          <SelectTrigger className="rounded-xl flex-1">
                            <SelectValue placeholder="Gender" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex items-center flex-1">
                          <span className="bg-muted px-2.5 py-2 rounded-l-xl border border-r-0 border-input text-sm font-mono font-semibold text-muted-foreground">
                            {idPrefixes[createRole as keyof typeof idPrefixes] || idPrefixes.student}
                          </span>
                          <Input 
                            value={row.idNumber} 
                            onChange={e => updateUserRow(i, "idNumber", e.target.value.replace(/\D/g, ""))} 
                            placeholder="001" 
                            className="rounded-l-none rounded-r-xl font-mono" 
                          />
                        </div>
                        {userRows.length > 1 && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => removeUserRow(i)} 
                            className="shrink-0 text-destructive rounded-xl"
                          >
                            ✕
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addUserRow} className="w-full rounded-xl">
                    + Add Another
                  </Button>
                </div>

                <Button 
                  onClick={handleCreateUsers} 
                  disabled={creating} 
                  className="w-full rounded-xl gradient-primary border-0 text-white h-11 font-semibold"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  {creating ? "Creating..." : `Create ${userRows.filter(r => r.fullName.trim() && r.idNumber.trim()).length} Account(s)`}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Credentials auto-generated: Username = firstname.lastname.id, Password = pass + ID
                </p>
              </CardContent>
            </Card>
          </div>
        );


      case "requests":
        return <TeacherRequests onUserCreated={fetchUsers} />;

      case "credentials": {
        const credRoles = ["all", "student", "teacher", "registrar", "director", "parent"] as const;
        const filteredCreds = credFilterRole === "all" ? credentialsLog : credentialsLog.filter(c => c.role === credFilterRole);

        const isStudentView = credFilterRole === "student";

        // Build two-level hierarchy: grade → sub_section → students
        // Each entry sorted: grade asc, sub_section asc, name asc
        type CredEntry = typeof credentialsLog[0] & { grade_level?: number; sub_section?: string };
        const gradeMap = new Map<string, Map<string, CredEntry[]>>();
        if (isStudentView) {
          const sorted = [...filteredCreds as CredEntry[]].sort((a, b) => {
            const gA = a.grade_level || 0, gB = b.grade_level || 0;
            if (gA !== gB) return gA - gB;
            return (a.sub_section || "—").localeCompare(b.sub_section || "—");
          });
          sorted.forEach((c) => {
            const gradeKey = c.grade_level ? `Grade ${c.grade_level}` : "Unassigned";
            const subKey = c.sub_section || "—";
            if (!gradeMap.has(gradeKey)) gradeMap.set(gradeKey, new Map());
            const subMap = gradeMap.get(gradeKey)!;
            if (!subMap.has(subKey)) subMap.set(subKey, []);
            subMap.get(subKey)!.push(c);
          });
        }

        const toggleGrade = (key: string) => setCollapsedCredGrades(prev => {
          const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next;
        });
        const toggleSub = (key: string) => setCollapsedCredSubSections(prev => {
          const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next;
        });

        const credTable = (creds: CredEntry[], showRole = false) => (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/20">
                  <TableHead>#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Password</TableHead>
                  {showRole && <TableHead>Role</TableHead>}
                  <TableHead>Created</TableHead>
                  <TableHead>Copy</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {creds.map((cred, idx) => (
                  <TableRow key={cred.id} className="hover:bg-muted/30">
                    <TableCell className="text-xs text-muted-foreground w-8">{idx + 1}</TableCell>
                    <TableCell className="font-semibold">{cred.full_name}</TableCell>
                    <TableCell className="font-mono text-sm">{cred.username}</TableCell>
                    <TableCell className="font-mono text-sm">{cred.password}</TableCell>
                    {showRole && <TableCell><Badge variant="outline" className="text-xs capitalize">{cred.role}</Badge></TableCell>}
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(cred.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyCredential(cred)}>
                        {copiedCredId === cred.id
                          ? <Check className="h-4 w-4 text-accent" />
                          : <Copy className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        );

        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Saved Credentials</h2>
              <p className="text-sm text-muted-foreground">{credentialsLog.length} credentials stored</p>
            </div>

            <Tabs value={credFilterRole} onValueChange={(v) => setCredFilterRole(v)} className="w-full">
              <TabsList className="w-full flex-wrap h-auto gap-1 bg-muted/50 p-1 rounded-xl">
                {credRoles.map(r => (
                  <TabsTrigger key={r} value={r} className="capitalize text-xs rounded-lg data-[state=active]:shadow-sm">
                    {r === "all" ? `All (${credentialsLog.length})` : `${r}s (${credentialsLog.filter(c => c.role === r).length})`}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {/* Collapse controls for student view */}
            {isStudentView && filteredCreds.length > 0 && (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="rounded-lg text-xs h-7 px-2"
                  onClick={() => setCollapsedCredGrades(new Set())}>
                  Expand All
                </Button>
                <Button size="sm" variant="outline" className="rounded-lg text-xs h-7 px-2"
                  onClick={() => setCollapsedCredGrades(new Set(Array.from(gradeMap.keys())))}>
                  Collapse All
                </Button>
              </div>
            )}

            {loadingCredentials ? (
              <p className="text-center text-muted-foreground">Loading...</p>
            ) : filteredCreds.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-6 text-center text-muted-foreground">No credentials for this role</CardContent>
              </Card>
            ) : isStudentView ? (
              // Students: Grade → Sub-Section → table
              <div className="space-y-3">
                {Array.from(gradeMap.entries())
                  .sort(([a], [b]) => (parseInt(a.replace("Grade ", "")) || 999) - (parseInt(b.replace("Grade ", "")) || 999))
                  .map(([gradeLabel, subMap]) => {
                    const gradeTotal = Array.from(subMap.values()).reduce((s, arr) => s + arr.length, 0);
                    const gradeCollapsed = collapsedCredGrades.has(gradeLabel);
                    return (
                      <Card key={gradeLabel} className="border-0 shadow-sm overflow-hidden">
                        {/* Grade header — clickable to collapse/expand */}
                        <button
                          className="w-full flex items-center justify-between px-4 py-3 bg-primary/8 hover:bg-primary/12 transition-colors border-b border-border/50"
                          onClick={() => toggleGrade(gradeLabel)}
                        >
                          <div className="flex items-center gap-2">
                            <ChevronDown className={cn("h-4 w-4 text-primary transition-transform", gradeCollapsed && "-rotate-90")} />
                            <span className="font-bold text-sm text-foreground">{gradeLabel}</span>
                            <Badge className="text-xs gradient-primary border-0 text-white">{gradeTotal} students</Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">{subMap.size} sub-section{subMap.size !== 1 ? "s" : ""}</span>
                        </button>

                        {!gradeCollapsed && (
                          <div className="divide-y divide-border/30">
                            {Array.from(subMap.entries())
                              .sort(([a], [b]) => a.localeCompare(b))
                              .map(([subLabel, subCreds]) => {
                                const subKey = `${gradeLabel}__${subLabel}`;
                                const subCollapsed = collapsedCredSubSections.has(subKey);
                                return (
                                  <div key={subLabel}>
                                    {/* Sub-section header */}
                                    <button
                                      className="w-full flex items-center justify-between px-5 py-2 bg-muted/30 hover:bg-muted/50 transition-colors"
                                      onClick={() => toggleSub(subKey)}
                                    >
                                      <div className="flex items-center gap-2">
                                        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", subCollapsed && "-rotate-90")} />
                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                          Sub-Section {subLabel}
                                        </span>
                                        <Badge variant="outline" className="text-xs">{subCreds.length}</Badge>
                                      </div>
                                    </button>
                                    {!subCollapsed && credTable(subCreds)}
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </Card>
                    );
                  })}
              </div>
            ) : (
              // Non-student roles: flat table
              <Card className="border-0 shadow-sm overflow-hidden">
                <CardContent className="p-0">
                  {credTable(filteredCreds as CredEntry[], true)}
                </CardContent>
              </Card>
            )}
          </div>
        );
      }


      case "settings":
        return (
          <div className="space-y-6 max-w-lg">
            <div>
              <h2 className="text-xl font-bold text-foreground">System Settings</h2>
              <p className="text-sm text-muted-foreground">Manage global system configuration</p>
            </div>

            <Card className="border-0 shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={cn("rounded-xl p-2.5", systemLocked ? "bg-destructive/10" : "bg-muted")}>
                      <Lock className={cn("h-5 w-5", systemLocked ? "text-destructive" : "text-muted-foreground")} />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">System Lock</p>
                      <p className="text-sm text-muted-foreground">
                        {systemLocked ? "System is LOCKED — no one can log in" : "System is active and accessible"}
                      </p>
                    </div>
                  </div>
                  <Switch checked={systemLocked} onCheckedChange={toggleSystemLock} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="bg-muted rounded-xl p-2.5">
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">School Logo</p>
                    <p className="text-sm text-muted-foreground">Upload or change the school logo</p>
                  </div>
                </div>

                {schoolLogo && (
                  <div className="flex items-center gap-4 p-4 bg-muted rounded-xl">
                    <div className="relative">
                      <img 
                        src={schoolLogo} 
                        alt="School Logo" 
                        className="h-16 w-16 object-contain rounded-lg border-2 border-primary" 
                        onError={(e) => {
                          console.error('Image failed to load:', schoolLogo);
                          console.error('Error event:', e);
                        }}
                        onLoad={() => console.log('Image loaded successfully:', schoolLogo)}
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Current Logo</p>
                      <p className="text-xs text-muted-foreground mt-1">{schoolLogo}</p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={handleRemoveLogo} 
                      className="text-destructive hover:bg-destructive/10 rounded-xl"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {!schoolLogo && (
                  <div className="p-4 bg-muted/50 rounded-xl">
                    <p className="text-sm text-muted-foreground">No logo uploaded yet</p>
                  </div>
                )}

                <input 
                  ref={logoInputRef} 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleLogoUpload} 
                />
                <Button 
                  onClick={() => logoInputRef.current?.click()} 
                  disabled={uploadingLogo} 
                  variant="outline" 
                  className="w-full rounded-xl h-11"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploadingLogo ? "Uploading..." : schoolLogo ? "Change Logo" : "Upload Logo"}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="bg-muted rounded-xl p-2.5">
                    <ArrowUpCircle className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Year-End Promotion</p>
                    <p className="text-sm text-muted-foreground">Promote or retain students (≥50% = pass)</p>
                  </div>
                </div>

                {promotionResults && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-green-50 dark:bg-green-950/30 rounded-xl p-3 text-center">
                      <p className="text-xl font-extrabold text-green-600">{promotionResults.summary.promoted}</p>
                      <p className="text-xs text-green-600/70 font-medium">Promoted</p>
                    </div>
                    <div className="bg-red-50 dark:bg-red-950/30 rounded-xl p-3 text-center">
                      <p className="text-xl font-extrabold text-destructive">{promotionResults.summary.retained}</p>
                      <p className="text-xs text-destructive/70 font-medium">Retained</p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3 text-center">
                      <p className="text-xl font-extrabold text-blue-600">{promotionResults.summary.graduated}</p>
                      <p className="text-xs text-blue-600/70 font-medium">Graduated</p>
                    </div>
                  </div>
                )}

                <Button 
                  onClick={() => setPromotionConfirmOpen(true)} 
                  disabled={promoting} 
                  className="w-full rounded-xl gradient-accent border-0 text-white h-11 font-semibold"
                >
                  <ArrowUpCircle className="h-4 w-4 mr-2" />
                  {promoting ? "Processing..." : "Run Year-End Promotion"}
                </Button>
              </CardContent>
            </Card>

            {/* Rollback Promotion */}
            <Card className="border-0 shadow-sm border-l-4 border-l-destructive/40">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="bg-destructive/10 rounded-xl p-2.5">
                    <ArrowUpCircle className="h-5 w-5 text-destructive rotate-180" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Rollback Promotion</p>
                    <p className="text-sm text-muted-foreground">Undo a year-end promotion — restores student grades to their archived state</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Academic Year to Rollback (e.g. 2018-2019 E.C.)</label>
                  <input
                    type="text"
                    value={rollbackYear}
                    onChange={e => setRollbackYear(e.target.value)}
                    placeholder="2018-2019 E.C."
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                {rollbackResults && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl p-3 text-center">
                      <p className="text-xl font-extrabold text-amber-600">{rollbackResults.restored}</p>
                      <p className="text-xs text-amber-600/70 font-medium">Grades Restored</p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3 text-center">
                      <p className="text-xl font-extrabold text-blue-600">{rollbackResults.reactivated}</p>
                      <p className="text-xs text-blue-600/70 font-medium">Re-activated</p>
                    </div>
                  </div>
                )}

                <Button
                  onClick={() => { if (rollbackYear.trim()) setRollbackConfirmOpen(true); else toast({ title: "Enter academic year", variant: "destructive" }); }}
                  disabled={rollingBack || !rollbackYear.trim()}
                  variant="outline"
                  className="w-full rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10 h-11 font-semibold"
                >
                  <ArrowUpCircle className="h-4 w-4 mr-2 rotate-180" />
                  {rollingBack ? "Rolling back..." : "Rollback Promotion"}
                </Button>
              </CardContent>
            </Card>
          </div>
        );

      case "subjects":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground">Subject Management</h2>
                <p className="text-sm text-muted-foreground">Create and manage subjects with credit hours and ECTS</p>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={() => {
                    setShowBulkSubjectForm(true);
                    setBulkSubjects([
                      { subject_name: "", subject_code: "", description: "", credit_hours: 3, ects: 5, grade_level: 9, stream: "" }
                    ]);
                  }}
                  variant="outline"
                  className="rounded-xl"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Bulk Add
                </Button>
                <Button 
                  onClick={() => {
                    setShowSubjectForm(true);
                    setEditingSubject(null);
                    setSubjectForm({
                      subject_name: "",
                      subject_code: "",
                      description: "",
                      credit_hours: 3,
                      ects: 5,
                      grade_level: 9,
                      stream: ""
                    });
                  }}
                  className="gradient-primary border-0 text-white rounded-xl"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Subject
                </Button>
              </div>
            </div>

            {showSubjectForm && (
              <Card className="border-0 shadow-sm">
                <CardContent className="pt-6 space-y-4">
                  <h3 className="font-semibold text-lg">{editingSubject ? "Edit Subject" : "Create New Subject"}</h3>
                  
                  <div className="space-y-2">
                    <Label>Subject Name</Label>
                    <Input 
                      value={subjectForm.subject_name}
                      onChange={e => setSubjectForm({...subjectForm, subject_name: e.target.value})}
                      placeholder="e.g., Mathematics"
                      className="rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Grade Level</Label>
                    <Select 
                      value={subjectForm.grade_level.toString()}
                      onValueChange={v => {
                        const grade = parseInt(v);
                        setSubjectForm({
                          ...subjectForm, 
                          grade_level: grade,
                          stream: grade <= 10 ? "" : "natural"
                        });
                      }}
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="9">Grade 9</SelectItem>
                        <SelectItem value="10">Grade 10</SelectItem>
                        <SelectItem value="11">Grade 11</SelectItem>
                        <SelectItem value="12">Grade 12</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {subjectForm.grade_level >= 11 && (
                    <div className="space-y-2">
                      <Label>Stream (Required for Grade 11-12) <span className="text-destructive">*</span></Label>
                      <Select 
                        value={subjectForm.stream}
                        onValueChange={v => setSubjectForm({...subjectForm, stream: v})}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Select stream..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="natural">Natural Science</SelectItem>
                          <SelectItem value="social">Social Science</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button 
                      onClick={editingSubject ? handleUpdateSubject : handleCreateSubject}
                      className="gradient-primary border-0 text-white rounded-xl"
                    >
                      {editingSubject ? "Update Subject" : "Create Subject"}
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setShowSubjectForm(false);
                        setEditingSubject(null);
                      }}
                      className="rounded-xl"
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {showBulkSubjectForm && (
              <Card className="border-0 shadow-sm">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg">Bulk Create Subjects</h3>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setBulkSubjects([...bulkSubjects, {
                          subject_name: "",
                          subject_code: "",
                          description: "",
                          credit_hours: 3,
                          ects: 5,
                          grade_level: 9,
                          stream: ""
                        }]);
                      }}
                      className="rounded-xl"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Row
                    </Button>
                  </div>

                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {bulkSubjects.map((subject, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 items-end p-3 bg-muted/30 rounded-lg">
                        <div className="col-span-3 space-y-1">
                          <Label className="text-xs">Subject Name</Label>
                          <Input
                            value={subject.subject_name}
                            onChange={e => {
                              const updated = [...bulkSubjects];
                              updated[index].subject_name = e.target.value;
                              setBulkSubjects(updated);
                            }}
                            placeholder="e.g., Mathematics"
                            className="rounded-lg h-9"
                          />
                        </div>
                        <div className="col-span-4 space-y-1">
                          <Label className="text-xs">Grade</Label>
                          <Select
                            value={subject.grade_level.toString()}
                            onValueChange={v => {
                              const updated = [...bulkSubjects];
                              const grade = parseInt(v);
                              updated[index].grade_level = grade;
                              updated[index].stream = grade <= 10 ? "" : "natural";
                              setBulkSubjects(updated);
                            }}
                          >
                            <SelectTrigger className="rounded-lg h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="9">Grade 9</SelectItem>
                              <SelectItem value="10">Grade 10</SelectItem>
                              <SelectItem value="11">Grade 11</SelectItem>
                              <SelectItem value="12">Grade 12</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {subject.grade_level >= 11 && (
                          <div className="col-span-4 space-y-1">
                            <Label className="text-xs">Stream</Label>
                            <Select
                              value={subject.stream}
                              onValueChange={v => {
                                const updated = [...bulkSubjects];
                                updated[index].stream = v;
                                setBulkSubjects(updated);
                              }}
                            >
                              <SelectTrigger className="rounded-lg h-9">
                                <SelectValue placeholder="Select stream..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="natural">Natural Science</SelectItem>
                                <SelectItem value="social">Social Science</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        <div className="col-span-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setBulkSubjects(bulkSubjects.filter((_, i) => i !== index));
                            }}
                            className="h-9 w-9 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={handleBulkCreateSubjects}
                      className="gradient-primary border-0 text-white rounded-xl"
                    >
                      Create {bulkSubjects.filter(s => s.subject_name).length} Subject{bulkSubjects.filter(s => s.subject_name).length !== 1 ? 's' : ''}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowBulkSubjectForm(false);
                        setBulkSubjects([]);
                      }}
                      className="rounded-xl"
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="border-0 shadow-sm">
              <CardContent className="pt-6">
                {loadingSubjects ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="text-sm text-muted-foreground mt-2">Loading subjects...</p>
                  </div>
                ) : (
                  <div className="border rounded-xl overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Subject Name</TableHead>
                          <TableHead>Grade</TableHead>
                          <TableHead>Stream</TableHead>
                          <TableHead>Teachers</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {subjects.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                              No subjects found. Click "Add Subject" to create one.
                            </TableCell>
                          </TableRow>
                        ) : (
                          subjects.map(subject => (
                            <TableRow key={subject.id}>
                              <TableCell className="font-medium">{subject.subject_name}</TableCell>
                              <TableCell>Grade {subject.grade_level || "All"}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="rounded-full">
                                  {subject.stream || "Common"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {subject.teachers && subject.teachers.length > 0 ? (
                                  <div className="space-y-1">
                                    {subject.teachers.map((t: any, idx: number) => (
                                      <div key={idx} className="text-xs">
                                        <span className="font-medium">{t.name}</span>
                                        <span className="text-muted-foreground ml-1">(Grade {t.grade_levels})</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-sm">No teacher assigned</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex gap-1 justify-end">
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => startEditSubject(subject)}
                                    className="h-8 w-8 rounded-lg"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => confirmDeleteSubject(subject)}
                                    className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );
    }
  };

  const getBadgeCount = (id: AdminSection) => {
    if (id === "users") return users.length;
    if (id === "credentials") return credentialsLog.length;
    return null;
  };


  return (
    <div className="flex flex-col -mx-4 sm:-mx-6 -mt-8 min-h-[calc(100vh-4rem)]">
      {/* Mobile header */}
      <div className="flex items-center gap-3 p-4 border-b lg:hidden">
        <button 
          onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)} 
          className="p-2 rounded-xl bg-muted hover:bg-muted/80 transition-colors"
        >
          <Menu className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <span className="font-bold text-sm text-foreground">
            {sidebarItems.find(i => i.id === activeSection)?.label}
          </span>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Mobile sidebar overlay */}
        {mobileSidebarOpen && (
          <div 
            className="fixed inset-0 z-40 bg-black/50 lg:hidden" 
            onClick={() => setMobileSidebarOpen(false)} 
          />
        )}

        {/* Desktop sidebar */}
        <aside className={cn(
          "shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex-col transition-all duration-300 hidden lg:flex",
          sidebarCollapsed ? "w-[68px]" : "w-60"
        )}>
          <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
            {!sidebarCollapsed && (
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-sidebar-primary" />
                <span className="font-bold text-sm">Admin Panel</span>
              </div>
            )}
            <button 
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)} 
              className="p-1.5 rounded-lg hover:bg-sidebar-accent transition-colors text-sidebar-foreground/60"
            >
              {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>

          <nav className="flex-1 p-3 space-y-1">
            {sidebarItems.map(({ id, label, icon: Icon }) => {
              const count = getBadgeCount(id);
              return (
                <button 
                  key={id} 
                  onClick={() => handleNavClick(id)} 
                  className={cn(
                    "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                    activeSection === id 
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md" 
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!sidebarCollapsed && (
                    <>
                      <span className="flex-1 text-left">{label}</span>
                      {count !== null && (
                        <span className={cn(
                          "text-xs font-bold min-w-[20px] text-center rounded-full px-1.5 py-0.5",
                          activeSection === id ? "bg-white/20" : "bg-sidebar-accent"
                        )}>
                          {count}
                        </span>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Mobile sidebar */}
        <aside className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col transition-transform duration-300 lg:hidden",
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="flex items-center gap-2 p-4 border-b border-sidebar-border">
            <Shield className="h-5 w-5 text-sidebar-primary" />
            <span className="font-bold text-sm">Admin Panel</span>
          </div>

          <nav className="flex-1 p-3 space-y-1">
            {sidebarItems.map(({ id, label, icon: Icon }) => (
              <button 
                key={id} 
                onClick={() => handleNavClick(id)} 
                className={cn(
                  "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  activeSection === id 
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md" 
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">{label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 p-6 lg:p-8">
          {renderContent()}
        </main>
      </div>

      {/* Modals */}
      <SuccessModal 
        open={!!successModal} 
        onClose={() => setSuccessModal(null)} 
        title={successModal?.title || ""} 
        description={successModal?.description} 
        credentials={successModal?.credentials} 
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <strong>{userToDelete?.full_name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteUser} 
              disabled={deleting} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={promotionConfirmOpen} onOpenChange={setPromotionConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Year-End Promotion</AlertDialogTitle>
            <AlertDialogDescription>
              Students ≥50% average will be promoted. Below 50% will be retained. <strong>This cannot be undone.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={promoting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handlePromoteStudents} 
              disabled={promoting} 
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {promoting ? "Processing..." : "Run Promotion"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={rollbackConfirmOpen} onOpenChange={setRollbackConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rollback Promotion — {rollbackYear}</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore all promoted students back to their grade before the {rollbackYear} promotion, and re-activate any graduated students.
              <br /><br />
              <strong>Only run this if the promotion was done by mistake.</strong> After rollback, fix the issue and run promotion again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rollingBack}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRollbackPromotion}
              disabled={rollingBack}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {rollingBack ? "Rolling back..." : "Yes, Rollback"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteSubjectConfirmOpen} onOpenChange={setDeleteSubjectConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subject</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <strong>{subjectToDelete?.subject_name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingSubject}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteSubject} 
              disabled={deletingSubject} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingSubject ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
