import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
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
import { UserPlus, Users, Search, Camera, Link2, History, Menu, ChevronLeft, ChevronRight, ClipboardList, CheckSquare, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import SuccessModal from "@/components/SuccessModal";

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

type RegistrarSection = "students" | "register" | "academic";

const sidebarItems: { id: RegistrarSection; label: string; icon: React.ElementType }[] = [
  { id: "students", label: "Students", icon: Users },
  { id: "register", label: "Register", icon: UserPlus },
  { id: "academic", label: "Academic Year", icon: History },
];

export default function RegistrarPortal() {
  const { role } = useAuth();
  const { toast } = useToast();
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

  // Bulk sub-section assignment
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [bulkSubSection, setBulkSubSection] = useState("");
  const [bulkAssigning, setBulkAssigning] = useState(false);

  // Current academic year
  const [currentAcademicYear, setCurrentAcademicYear] = useState<string | null>(null);
  const [currentTerm, setCurrentTerm] = useState<string | null>(null);
  const [settingYear, setSettingYear] = useState("");
  const [settingTerm, setSettingTerm] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    api.getCurrentAcademicYear().then((d: any) => {
      if (d?.academic_year) { setCurrentAcademicYear(d.academic_year); setSettingYear(d.academic_year.replace('-', '/')); }
      if (d?.term) { setCurrentTerm(d.term); setSettingTerm(d.term); }
    }).catch(() => {});
  }, []);

  const handleSaveSettings = async () => {
    if (!settingYear || !/^\d{4}\/\d{4}$/.test(settingYear)) {
      toast({ title: "Error", description: "Enter a valid year (e.g., 2025/2026)", variant: "destructive" }); return;
    }
    setSavingSettings(true);
    try {
      const formatted = settingYear.replace('/', '-');
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
      // Convert format from 2025/2026 to 2025-2026
      const formattedYear = archiveYear.replace('/', '-');
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
  }, [activeSection]);

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
        const num = parseInt(data.nextId.replace('MJ', ''), 10);
        setNextStudentNum(num);
        setUserRows([{ fullName: "", idNumber: String(num).padStart(3, '0'), gender: "" }]);
      }).catch(() => {});
    }
  }, [activeSection]);

  if (role !== "registrar") return <p className="text-destructive">Access denied.</p>;

  const filtered = students.filter(s => {
    const q = searchQuery.toLowerCase();
    if (q && !s.full_name.toLowerCase().includes(q) && !s.id_number.toLowerCase().includes(q)) return false;
    if (filterGrade !== "all" && s.grade_level?.toString() !== filterGrade) return false;
    if (filterStream !== "all" && s.stream !== filterStream) return false;
    return true;
  });

  const addUserRow = () => {
    const nextNum = nextStudentNum + userRows.length;
    setUserRows([...userRows, { fullName: "", idNumber: String(nextNum).padStart(3, '0'), gender: "" }]);
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
      const email = `${nameHash}.${timestamp}.${i}.${randomSuffix}@school.com`;
      
      try {
        const result = await api.createUser({
          email,
          full_name: row.fullName.trim(),
          role: "student",
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
        title: `${creds.length} Student(s) Created!`, 
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

  const handleBulkAssignSubSection = async () => {
    if (selectedStudents.size === 0 || !bulkSubSection) return;
    setBulkAssigning(true);
    
    try {
      // Update each selected student
      const updatePromises = Array.from(selectedStudents).map(studentId => 
        api.updateStudent(studentId, { 
          sub_section: bulkSubSection === "none" ? null : bulkSubSection 
        })
      );
      
      await Promise.all(updatePromises);
      
      toast({ 
        title: "Success", 
        description: `Updated ${selectedStudents.size} student(s)` 
      });
      
      setSelectedStudents(new Set());
      setBulkSubSection("");
      fetchStudents(); // Refresh the list
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
              <p className="text-sm text-muted-foreground">{students.length} total students</p>
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
                  {[9,10,11,12].map(g => <SelectItem key={g} value={String(g)}>Grade {g}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterStream} onValueChange={setFilterStream}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Stream" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Streams</SelectItem>
                  <SelectItem value="natural">Natural</SelectItem>
                  <SelectItem value="social">Social</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Card className="border-0 shadow-sm overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                  <p className="text-sm text-muted-foreground">{filtered.length} student(s)</p>
                  {selectedStudents.size > 0 && (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">{selectedStudents.size} selected</Badge>
                      <Select value={bulkSubSection} onValueChange={setBulkSubSection}>
                        <SelectTrigger className="rounded-xl w-32 h-8 text-xs"><SelectValue placeholder="Sub-Section" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {["A","B","C","D","E","F","G","H"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button size="sm" disabled={!bulkSubSection || bulkAssigning} onClick={handleBulkAssignSubSection} className="rounded-lg text-xs gradient-primary border-0 text-white">
                        <CheckSquare className="h-3 w-3 mr-1" />{bulkAssigning ? "Assigning..." : "Assign"}
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
                        {filtered.map(s => (
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
                        ))}
                        {filtered.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No students found</TableCell></TableRow>}
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
              <p className="text-sm text-muted-foreground">Bulk create student accounts</p>
            </div>
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-6 space-y-5">
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Students</Label>
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
                          <span className="bg-muted px-2.5 py-2 rounded-l-xl border border-r-0 border-input text-sm font-mono font-semibold text-muted-foreground">MJ</span>
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
                  {creating ? "Creating..." : `Create ${userRows.filter(r => r.fullName.trim()).length} Student(s)`}
                </Button>
                <p className="text-xs text-muted-foreground text-center">Credentials auto-generated: Username = firstname.lastname.id, Password = pass + ID</p>
              </CardContent>
            </Card>
          </div>
        );

      case "academic":
        return (
          <div className="space-y-6 max-w-lg">
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

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Year (e.g., 2025/2026)</Label>
                    <Input value={settingYear} onChange={e => setSettingYear(e.target.value)} placeholder="2025/2026" className="h-10 rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Term</Label>
                    <Select value={settingTerm} onValueChange={setSettingTerm}>
                      <SelectTrigger className="rounded-xl h-10"><SelectValue placeholder="Select term" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Term 1">Term 1</SelectItem>
                        <SelectItem value="Term 2">Term 2</SelectItem>
                        <SelectItem value="Term 3">Term 3</SelectItem>
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
                  <Label className="text-xs">Academic Year (e.g., 2025/2026)</Label>
                  <Input value={archiveYear} onChange={(e) => setArchiveYear(e.target.value)} placeholder="2025/2026" className="h-10 rounded-xl" />
                </div>
                <Button
                  onClick={() => {
                    if (!archiveYear || !/^\d{4}\/\d{4}$/.test(archiveYear)) { toast({ title: "Error", description: "Enter a valid academic year (e.g., 2025/2026)", variant: "destructive" }); return; }
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
    </div>
  );
}
