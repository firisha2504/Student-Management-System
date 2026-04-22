import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/services/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Upload, CheckCircle2, Plus, Trash2, AlertCircle,
  ChevronDown, ChevronUp, Zap, Pencil, Save, X, Eye,
  Users, BookOpen, ChevronLeft, ChevronRight, Menu, Trophy
} from "lucide-react";
import SuccessModal from "@/components/SuccessModal";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface Subject { id: number; subject_name: string; grade_level: number; stream: string | null; }
interface StudentProfile { user_id: number; full_name: string; username: string; admission_number?: string; section?: string; sub_section?: string; grade_level?: number; }
interface AssessmentType { id: number; assessment_name: string; weight: number; subject_id: number; teacher_id: number; }
interface SavedScore { id: number; student_id: number; full_name: string; username: string; score: number; }

const FIXED_ASSESSMENTS = ["Mid Exam", "Final Exam"];
type NavSection = "grades" | "students" | "homeroom";
type ScoreTab = "scores" | "view";

export default function TeacherPortal() {
  const { role } = useAuth();
  const { toast } = useToast();

  // Sidebar
  const [activeSection, setActiveSection] = useState<NavSection>("grades");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Assignments
  const [assignments, setAssignments] = useState<{ subjects: number[]; grades: number[]; sections: string[]; subSections: string[] }>({ subjects: [], grades: [], sections: [], subSections: [] });
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);

  // Grade upload form state
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [selectedSubSection, setSelectedSubSection] = useState<string>("");
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Assessment setup
  const [assessmentSetupOpen, setAssessmentSetupOpen] = useState(false);
  const [assessmentTypes, setAssessmentTypes] = useState<AssessmentType[]>([]);
  const [newAssessmentName, setNewAssessmentName] = useState("");
  const [newAssessmentWeight, setNewAssessmentWeight] = useState<number>(20);
  const [applyToAllSubjects, setApplyToAllSubjects] = useState(false);
  const [editingAssessmentId, setEditingAssessmentId] = useState<number | null>(null);
  const [editingAssessmentName, setEditingAssessmentName] = useState("");

  // Scores
  const [scoreTab, setScoreTab] = useState<ScoreTab>("scores");
  const [scores, setScores] = useState<Record<number, Record<number, string>>>({}); // studentId -> assessmentTypeId -> score
  const [savedScores, setSavedScores] = useState<SavedScore[]>([]);
  const [modifiedStudents, setModifiedStudents] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [editingScoreId, setEditingScoreId] = useState<number | null>(null);
  const [editingScoreValue, setEditingScoreValue] = useState<string>("");

  // My Students
  const [allStudents, setAllStudents] = useState<StudentProfile[]>([]);
  const [loadingAllStudents, setLoadingAllStudents] = useState(false);
  const [expandedGrades, setExpandedGrades] = useState<Set<number>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());

  // Homeroom
  const [homeroomStudents, setHomeroomStudents] = useState<StudentProfile[]>([]);
  const [homeroomRankings, setHomeroomRankings] = useState<any[]>([]);
  const [loadingHomeroom, setLoadingHomeroom] = useState(false);
  const [homeroomAssignment, setHomeroomAssignment] = useState<any>(null);

  const [successModal, setSuccessModal] = useState<{ title: string; description?: string } | null>(null);
  const [term, setTerm] = useState("Semester 1");
  const currentYear = new Date().getFullYear();
  const [academicYear, setAcademicYear] = useState(`${currentYear}-${currentYear + 1}`);

  // Load teacher assignments + subjects on mount
  useEffect(() => {
    const load = async () => {
      try {
        const [a, subs, yearData] = await Promise.all([
          api.getMyAssignments(),
          api.getAllSubjects(),
          api.getCurrentAcademicYear(),
        ]);
        setAssignments(a);
        setAllSubjects(subs || []);
        if (yearData?.academic_year) setAcademicYear(yearData.academic_year);
        if (yearData?.term) setTerm(yearData.term);
      } catch (e: any) {
        toast({ title: "Error", description: "Failed to load assignments", variant: "destructive" });
      }
    };
    load();
  }, []);

  // Subjects filtered to teacher's assigned subjects only
  const mySubjects = allSubjects.filter(s => 
    assignments.subjects.includes(s.id) && assignments.grades.includes(s.grade_level)
  );

  // Load students when grade/section/sub-section changes
  useEffect(() => {
    if (!selectedGrade) { setStudents([]); return; }
    const fetch = async () => {
      setLoadingStudents(true);
      try {
        const filters: any = { grade_level: selectedGrade };
        if (selectedSection) filters.section = selectedSection;
        if (selectedSubSection) filters.sub_section = selectedSubSection;
        const data = await api.getStudents(filters);
        setStudents(data || []);
        // Pre-fill scores map
        const map: Record<number, Record<number, string>> = {};
        (data || []).forEach((s: StudentProfile) => { map[s.user_id] = {}; });
        setScores(map);
        setModifiedStudents(new Set());
      } catch {
        toast({ title: "Error", description: "Failed to load students", variant: "destructive" });
      }
      setLoadingStudents(false);
    };
    fetch();
  }, [selectedGrade, selectedSection, selectedSubSection]);

  // Load assessment types when subject+grade changes
  useEffect(() => {
    if (!selectedSubjectId || !selectedGrade) { setAssessmentTypes([]); return; }
    const fetch = async () => {
      try {
        const filters: any = { subject_id: selectedSubjectId, grade_level: selectedGrade };
        if (selectedSection) filters.section = selectedSection;
        if (selectedSubSection) filters.sub_section = selectedSubSection;
        const data = await api.getAssessmentTypes(filters);
        setAssessmentTypes(data || []);
      } catch {
        setAssessmentTypes([]);
      }
    };
    fetch();
  }, [selectedSubjectId, selectedGrade, selectedSection, selectedSubSection]);

  // Load saved scores when viewing
  const loadSavedScores = useCallback(async () => {
    try {
      const data = await api.getAssessmentScores({ term, academic_year: academicYear });
      setSavedScores(data || []);
      // Auto-expand all subjects
      const subjects = [...new Set((data || []).map((sc: any) => sc.subject_name ?? "Unknown Subject"))];
      setExpandedSubjects(new Set(subjects as string[]));
    } catch {
      setSavedScores([]);
    }
  }, [term, academicYear]);

  useEffect(() => {
    if (scoreTab === "view") loadSavedScores();
  }, [scoreTab, loadSavedScores]);

  // Pre-fill existing scores when entering edit tab
  useEffect(() => {
    if (scoreTab !== "scores" || assessmentTypes.length === 0 || students.length === 0) return;
    const prefill = async () => {
      try {
        const data = await api.getAssessmentScores({ term, academic_year: academicYear });
        const map: Record<number, Record<number, string>> = {};
        students.forEach(s => { map[s.user_id] = {}; });
        (data || []).forEach((sc: any) => {
          if (map[sc.student_id]) map[sc.student_id][sc.assessment_type_id] = String(sc.score);
        });
        setScores(map);
      } catch { /* ignore */ }
    };
    prefill();
  }, [scoreTab, assessmentTypes, students]);

  // Load all students for My Students tab
  useEffect(() => {
    if (activeSection !== "students" || assignments.grades.length === 0) return;
    const fetch = async () => {
      setLoadingAllStudents(true);
      try {
        const results = await Promise.all(
          assignments.grades.map(g => api.getStudents({ grade_level: g }))
        );
        const merged: StudentProfile[] = results.flat();
        setAllStudents(merged);
        // Auto-expand all grades
        setExpandedGrades(new Set(assignments.grades));
      } catch {
        toast({ title: "Error", description: "Failed to load students", variant: "destructive" });
      }
      setLoadingAllStudents(false);
    };
    fetch();
  }, [activeSection, assignments.grades]);

  // Load homeroom data
  useEffect(() => {
    if (activeSection !== "homeroom") return;
    const fetchHomeroom = async () => {
      setLoadingHomeroom(true);
      try {
        const [assignment, students, rankings] = await Promise.all([
          api.getMyHomeroom(),
          api.getMyHomeroomStudents(),
          api.getMyClassRankings({ term, academic_year: academicYear }),
        ]);
        setHomeroomAssignment(assignment.length > 0 ? assignment[0] : null);
        setHomeroomStudents(students || []);
        setHomeroomRankings(rankings.rankings || []);
      } catch (error: any) {
        toast({ title: "Error", description: error.message || "Failed to load homeroom data", variant: "destructive" });
      }
      setLoadingHomeroom(false);
    };
    fetchHomeroom();
  }, [activeSection, term, academicYear]);

  const totalWeight = assessmentTypes.reduce((s, a) => s + Number(a.weight), 0);

  const addAssessment = async (name: string, weight: number) => {
    if (!selectedSubjectId || !selectedGrade) return;
    
    // Check if adding this assessment would exceed 100%
    const newTotal = totalWeight + weight;
    if (newTotal > 100) {
      toast({ 
        title: "Cannot Add Assessment", 
        description: `Total weight would be ${newTotal}%. Maximum is 100%. Current total: ${totalWeight}%`, 
        variant: "destructive" 
      });
      return;
    }
    
    try {
      if (applyToAllSubjects && assignments.length > 0) {
        // Bulk create for all teacher's subjects
        let successCount = 0;
        let failCount = 0;
        
        for (const assignment of assignments) {
          try {
            const filters: any = { 
              subject_id: assignment.subject_id, 
              grade_level: assignment.grade_level, 
              assessment_name: name, 
              weight 
            };
            if (assignment.section) filters.section = assignment.section;
            if (assignment.sub_section) filters.sub_section = assignment.sub_section;
            if (assignment.stream) filters.stream = assignment.stream;
            
            await api.createAssessmentType(filters);
            successCount++;
          } catch (e: any) {
            console.error(`Failed to create assessment for subject ${assignment.subject_id}:`, e);
            failCount++;
          }
        }
        
        toast({ 
          title: "Bulk Assessment Created", 
          description: `Created "${name}" for ${successCount} subject(s)${failCount > 0 ? `. Failed for ${failCount} subject(s)` : ''}`,
        });
        
        // Refresh current subject's assessments
        const data = await api.getAssessmentTypes({ subject_id: selectedSubjectId, grade_level: selectedGrade });
        setAssessmentTypes(data || []);
      } else {
        // Single subject creation
        const filters: any = { subject_id: selectedSubjectId, grade_level: selectedGrade, assessment_name: name, weight };
        if (selectedSection) filters.section = selectedSection;
        if (selectedSubSection) filters.sub_section = selectedSubSection;
        await api.createAssessmentType(filters);
        const data = await api.getAssessmentTypes({ subject_id: selectedSubjectId, grade_level: selectedGrade });
        setAssessmentTypes(data || []);
        toast({ title: "Success", description: `Assessment "${name}" created successfully` });
      }
      
      setNewAssessmentName("");
      setNewAssessmentWeight(20);
      setApplyToAllSubjects(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to add assessment", variant: "destructive" });
    }
  };

  const deleteAssessment = async (id: number) => {
    try {
      await api.deleteAssessmentType(id);
      setAssessmentTypes(prev => prev.filter(a => a.id !== id));
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to delete", variant: "destructive" });
    }
  };

  const saveAssessmentName = async (id: number) => {
    try {
      await api.updateAssessmentType(id, { assessment_name: editingAssessmentName });
      setAssessmentTypes(prev => prev.map(a => a.id === id ? { ...a, assessment_name: editingAssessmentName } : a));
      setEditingAssessmentId(null);
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to update", variant: "destructive" });
    }
  };

  const handleScoreChange = (studentId: number, assessmentTypeId: number, value: string) => {
    setScores(prev => ({ ...prev, [studentId]: { ...(prev[studentId] || {}), [assessmentTypeId]: value } }));
    setModifiedStudents(prev => new Set(prev).add(studentId));
  };

  const submitScores = async () => {
    if (!selectedSubjectId || !selectedGrade || assessmentTypes.length === 0) return;
    setSubmitting(true);
    try {
      const scoreEntries: { student_id: number; assessment_type_id: number; score: number }[] = [];
      students.forEach(s => {
        assessmentTypes.forEach(a => {
          const val = scores[s.user_id]?.[a.id];
          if (val !== undefined && val !== "") {
            scoreEntries.push({ student_id: s.user_id, assessment_type_id: a.id, score: parseFloat(val) });
          }
        });
      });
      if (scoreEntries.length === 0) { toast({ title: "No scores to upload", variant: "destructive" }); setSubmitting(false); return; }
      await api.bulkUploadAssessmentScores({ scores: scoreEntries, term, academic_year: academicYear });
      setSuccessModal({ title: "Scores Uploaded", description: `${scoreEntries.length} scores saved successfully.` });
      setModifiedStudents(new Set());
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to upload scores", variant: "destructive" });
    }
    setSubmitting(false);
  };

  const deleteScore = async (scoreId: number) => {
    try {
      await api.deleteAssessmentScore(scoreId);
      setSavedScores(prev => prev.filter(s => s.id !== scoreId));
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to delete score", variant: "destructive" });
    }
  };

  const saveEditedScore = async (scoreId: number) => {
    try {
      // Re-upload via bulk with single entry — find the score entry
      const sc = savedScores.find(s => s.id === scoreId);
      if (!sc) return;
      await api.uploadAssessmentScore({ student_id: sc.student_id, assessment_type_id: (sc as any).assessment_type_id, score: parseFloat(editingScoreValue), term, academic_year: academicYear });
      setSavedScores(prev => prev.map(s => s.id === scoreId ? { ...s, score: parseFloat(editingScoreValue) } : s));
      setEditingScoreId(null);
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to update score", variant: "destructive" });
    }
  };

  // Group students by grade -> section -> sub_section
  const groupedStudents = allStudents.reduce<Record<number, Record<string, Record<string, StudentProfile[]>>>>((acc, s) => {
    const g = s.grade_level ?? 0;
    const sec = s.section ?? "—";
    const sub = s.sub_section ?? "—";
    if (!acc[g]) acc[g] = {};
    if (!acc[g][sec]) acc[g][sec] = {};
    if (!acc[g][sec][sub]) acc[g][sec][sub] = [];
    acc[g][sec][sub].push(s);
    return acc;
  }, {});

  const toggleGrade = (g: number) => setExpandedGrades(prev => { const n = new Set(prev); n.has(g) ? n.delete(g) : n.add(g); return n; });
  const toggleSection = (key: string) => setExpandedSections(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const toggleSubject = (key: string) => setExpandedSubjects(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const navItems: { id: NavSection; label: string; icon: React.ElementType }[] = [
    { id: "grades", label: "Upload Grades", icon: Upload },
    { id: "students", label: "My Students", icon: Users },
    { id: "homeroom", label: "My Homeroom", icon: BookOpen },
  ];

  const handleNavClick = (id: NavSection) => { setActiveSection(id); setMobileSidebarOpen(false); };

  if (role !== "teacher") return <p className="text-destructive">Access denied.</p>;

  const renderGradesSection = () => (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-foreground">Upload Grades</h2>
        <p className="text-sm text-muted-foreground">
          {academicYear} · {term}
        </p>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-5 pb-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Grade</Label>
              <Select value={selectedGrade?.toString() ?? ""} onValueChange={v => { setSelectedGrade(parseInt(v)); setSelectedSubjectId(null); }}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Grade" /></SelectTrigger>
                <SelectContent>{assignments.grades.sort().map(g => <SelectItem key={g} value={String(g)}>Grade {g}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Subject</Label>
              <Select value={selectedSubjectId?.toString() ?? ""} onValueChange={v => setSelectedSubjectId(parseInt(v))} disabled={!selectedGrade}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Subject" /></SelectTrigger>
                <SelectContent>{mySubjects.filter(s => s.grade_level === selectedGrade).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.subject_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Section</Label>
              <Select value={selectedSection || "__all__"} onValueChange={v => setSelectedSection(v === "__all__" ? "" : v)}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="All sections" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All</SelectItem>
                  {assignments.sections.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Sub-Section</Label>
              <Select value={selectedSubSection || "__all__"} onValueChange={v => setSelectedSubSection(v === "__all__" ? "" : v)}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All</SelectItem>
                  {assignments.subSections.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assessment Setup */}
      {selectedSubjectId && selectedGrade && (
        <Collapsible open={assessmentSetupOpen} onOpenChange={setAssessmentSetupOpen}>
          <Card className="border-0 shadow-sm">
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors rounded-xl">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">Assessment Setup</span>
                  <Badge variant="outline" className="text-xs">{assessmentTypes.length} types · {totalWeight}% total</Badge>
                </div>
                {assessmentSetupOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-5 pb-5 space-y-4 border-t border-border/50">
                {/* Presets */}
                <div className="flex flex-wrap gap-2 pt-4">
                  <span className="text-xs text-muted-foreground self-center">Quick add:</span>
                  {FIXED_ASSESSMENTS.map(name => (
                    <Button key={name} size="sm" variant="outline" className="rounded-lg text-xs h-7"
                      onClick={() => addAssessment(name, name === "Final Exam" ? 40 : 30)}>
                      <Plus className="h-3 w-3 mr-1" />{name}
                    </Button>
                  ))}
                </div>

                {/* Existing assessments */}
                {assessmentTypes.length > 0 && (
                  <div className="space-y-2">
                    {assessmentTypes.map(a => (
                      <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                        {editingAssessmentId === a.id ? (
                          <>
                            <Input value={editingAssessmentName} onChange={e => setEditingAssessmentName(e.target.value)} className="h-7 text-sm rounded-lg flex-1" />
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => saveAssessmentName(a.id)}><Save className="h-3.5 w-3.5 text-emerald-500" /></Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingAssessmentId(null)}><X className="h-3.5 w-3.5" /></Button>
                          </>
                        ) : (
                          <>
                            <span className="text-sm font-medium flex-1">{a.assessment_name}</span>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setEditingAssessmentId(a.id); setEditingAssessmentName(a.assessment_name); }}><Pencil className="h-3 w-3" /></Button>
                          </>
                        )}
                        <Badge variant="outline" className="text-xs shrink-0">{a.weight}%</Badge>
                        <div className="w-20 hidden sm:block"><Progress value={a.weight} className="h-1.5" /></div>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteAssessment(a.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    ))}
                    {totalWeight !== 100 && (
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-amber-500 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Total weight is {totalWeight}% (should be 100%)
                        </p>
                        <Badge variant="outline" className={cn("text-xs", totalWeight < 100 ? "text-emerald-600" : "text-destructive")}>
                          {totalWeight < 100 ? `${100 - totalWeight}% remaining` : `${totalWeight - 100}% over limit`}
                        </Badge>
                      </div>
                    )}
                    {totalWeight === 100 && (
                      <p className="text-xs text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Total weight is exactly 100% ✓
                      </p>
                    )}
                  </div>
                )}

                {/* Add custom */}
                <div className="space-y-3">
                  {assignments.length > 1 && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                      <Checkbox 
                        id="apply-all-subjects"
                        checked={applyToAllSubjects}
                        onCheckedChange={(checked) => setApplyToAllSubjects(checked === true)}
                        className="rounded-md"
                      />
                      <Label htmlFor="apply-all-subjects" className="text-xs cursor-pointer flex-1">
                        Apply this assessment to all my subjects ({assignments.length} subjects)
                      </Label>
                      <Badge variant="secondary" className="text-xs">
                        Bulk Create
                      </Badge>
                    </div>
                  )}
                  
                  <div className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs text-muted-foreground">Name</Label>
                      <Input value={newAssessmentName} onChange={e => setNewAssessmentName(e.target.value)} placeholder="e.g. Quiz 1" className="rounded-xl h-9 text-sm" />
                    </div>
                    <div className="w-24 space-y-1">
                      <Label className="text-xs text-muted-foreground">Weight %</Label>
                      <Input 
                        type="number" 
                        min={1} 
                        max={100 - totalWeight} 
                        value={newAssessmentWeight} 
                        onChange={e => {
                          const val = parseInt(e.target.value);
                          setNewAssessmentWeight(isNaN(val) ? 0 : val);
                        }} 
                        className="rounded-xl h-9 text-sm" 
                      />
                    </div>
                    <Button 
                      size="sm" 
                      className="rounded-xl gradient-primary border-0 text-white h-9" 
                      onClick={() => addAssessment(newAssessmentName, newAssessmentWeight)} 
                      disabled={!newAssessmentName.trim() || newAssessmentWeight <= 0 || totalWeight + newAssessmentWeight > 100}
                    >
                      <Plus className="h-4 w-4 mr-1" />Add
                    </Button>
                  </div>
                  {newAssessmentWeight > 0 && totalWeight + newAssessmentWeight > 100 && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Cannot add {newAssessmentWeight}% - would exceed 100% (currently {totalWeight}%)
                    </p>
                  )}
                </div>
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Score Tabs */}
      {(selectedSubjectId && selectedGrade && assessmentTypes.length > 0) || scoreTab === "view" ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            {/* Tab bar */}
            <div className="flex border-b border-border/50">
              {([["scores", "Enter / Edit Scores", Upload], ["view", "View Uploaded", Eye]] as const).map(([id, label, Icon]) => (
                <button key={id} onClick={() => setScoreTab(id as ScoreTab)}
                  className={cn("flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px",
                    scoreTab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
                  <Icon className="h-4 w-4" />{label}
                </button>
              ))}
            </div>

            {/* Enter scores */}
            {scoreTab === "scores" && (
              <div className="p-4 space-y-3">
                {loadingStudents ? <p className="text-center text-muted-foreground py-6">Loading students...</p> : students.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6">No students found for this selection.</p>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/20">
                            <TableHead className="min-w-[180px]">Student</TableHead>
                            {assessmentTypes.map(a => <TableHead key={a.id} className="min-w-[110px]">{a.assessment_name} <span className="text-muted-foreground text-xs">({a.weight}%)</span></TableHead>)}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {students.map(s => (
                            <TableRow key={s.user_id} className={cn("transition-colors", modifiedStudents.has(s.user_id) && "bg-amber-500/5")}>
                              <TableCell>
                                <p className="font-bold text-sm">{s.full_name}</p>
                                {s.admission_number && <Badge variant="outline" className="text-xs font-mono mt-0.5">{s.admission_number}</Badge>}
                              </TableCell>
                              {assessmentTypes.map(a => (
                                <TableCell key={a.id}>
                                  <Input
                                    type="number" 
                                    min={0} 
                                    max={a.weight}
                                    value={scores[s.user_id]?.[a.id] ?? ""}
                                    onChange={e => {
                                      const value = e.target.value;
                                      const numValue = parseFloat(value);
                                      // Prevent entering values greater than max
                                      if (value === '' || (numValue >= 0 && numValue <= a.weight)) {
                                        handleScoreChange(s.user_id, a.id, value);
                                      }
                                    }}
                                    className="h-8 w-24 rounded-lg text-sm"
                                    placeholder={`0-${a.weight}`}
                                  />
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex justify-end pt-2">
                      <Button onClick={submitScores} disabled={submitting} className="rounded-xl gradient-primary border-0 text-white">
                        {submitting ? "Saving..." : <><CheckCircle2 className="h-4 w-4 mr-2" />Save Scores</>}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* View uploaded */}
            {scoreTab === "view" && (
              <div className="p-4 space-y-4">
                {savedScores.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6">No scores uploaded yet.</p>
                ) : (() => {
                  // Group by student_id → subject_name
                  const byStudent = savedScores.reduce<Record<number, { full_name: string; username: string; admission_number?: string; subjects: Record<string, number> }>>((acc, sc) => {
                    const subj = (sc as any).subject_name ?? "Unknown Subject";
                    if (!acc[sc.student_id]) {
                      acc[sc.student_id] = { 
                        full_name: sc.full_name, 
                        username: sc.username, 
                        admission_number: (sc as any).admission_number,
                        subjects: {} 
                      };
                    }
                    // Sum all assessment scores for this subject
                    if (!acc[sc.student_id].subjects[subj]) {
                      acc[sc.student_id].subjects[subj] = 0;
                    }
                    acc[sc.student_id].subjects[subj] += Number(sc.score);
                    return acc;
                  }, {});

                  // Get all unique subjects
                  const allSubjects = [...new Set(savedScores.map(sc => (sc as any).subject_name ?? "Unknown Subject"))].sort();

                  // Convert to array for sorting
                  const studentsArray = Object.entries(byStudent).map(([studentId, data]) => ({
                    studentId: Number(studentId),
                    ...data
                  }));

                  return (
                    <div className="rounded-xl border border-border/50 overflow-hidden">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-primary/10">
                              <TableHead className="min-w-[50px] text-center font-bold">#</TableHead>
                              <TableHead className="min-w-[200px] font-bold">Student Name</TableHead>
                              <TableHead className="min-w-[120px] font-bold">ID Number</TableHead>
                              {allSubjects.map(subject => (
                                <TableHead key={subject} className="min-w-[120px] text-center font-bold">
                                  <div className="flex items-center justify-center gap-1">
                                    <BookOpen className="h-3.5 w-3.5 text-primary" />
                                    {subject}
                                  </div>
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {studentsArray.map((student, index) => (
                              <TableRow key={student.studentId} className="hover:bg-muted/30 transition-colors">
                                <TableCell className="text-center font-semibold text-muted-foreground">
                                  {index + 1}
                                </TableCell>
                                <TableCell className="font-semibold">
                                  {student.full_name}
                                </TableCell>
                                <TableCell className="font-mono text-sm text-muted-foreground">
                                  {student.admission_number ?? student.username}
                                </TableCell>
                                {allSubjects.map(subject => {
                                  const score = student.subjects[subject];
                                  return (
                                    <TableCell key={subject} className="text-center">
                                      {score !== undefined ? (
                                        <Badge 
                                          className={cn(
                                            "text-sm font-bold",
                                            score >= 50 
                                              ? "gradient-accent border-0 text-white" 
                                              : "bg-destructive text-destructive-foreground"
                                          )}
                                        >
                                          {score.toFixed(1)}
                                        </Badge>
                                      ) : (
                                        <span className="text-xs text-muted-foreground">—</span>
                                      )}
                                    </TableCell>
                                  );
                                })}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {selectedSubjectId && selectedGrade && assessmentTypes.length === 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-10 text-center text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No assessment types set up yet.</p>
            <p className="text-xs mt-1">Open Assessment Setup above to add types first.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderStudentsSection = () => (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-foreground">My Students</h2>
        <p className="text-sm text-muted-foreground">{allStudents.length} students across your assigned grades</p>
      </div>

      {loadingAllStudents ? (
        <Card className="border-0 shadow-sm"><CardContent className="py-10 text-center text-muted-foreground">Loading students...</CardContent></Card>
      ) : allStudents.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-10 text-center text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No students found for your assigned grades.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {Object.entries(groupedStudents).sort(([a], [b]) => Number(a) - Number(b)).map(([grade, sections]) => {
            const gradeNum = Number(grade);
            const gradeTotal = Object.values(sections).flatMap(subs => Object.values(subs).flat()).length;
            const isGradeOpen = expandedGrades.has(gradeNum);
            return (
              <Card key={grade} className="border-0 shadow-sm overflow-hidden">
                <button
                  onClick={() => toggleGrade(gradeNum)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="gradient-primary rounded-lg p-2"><BookOpen className="h-4 w-4 text-white" /></div>
                    <div className="text-left">
                      <p className="font-bold text-sm">Grade {grade}</p>
                      <p className="text-xs text-muted-foreground">{gradeTotal} students · {Object.keys(sections).length} sections</p>
                    </div>
                  </div>
                  {isGradeOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>

                {isGradeOpen && (
                  <div className="border-t border-border/50">
                    {Object.entries(sections).sort().map(([section, subSections]) => {
                      const sectionKey = `${grade}-${section}`;
                      const sectionTotal = Object.values(subSections).flat().length;
                      const isSectionOpen = expandedSections.has(sectionKey);
                      return (
                        <div key={section} className="border-b border-border/30 last:border-0">
                          <button
                            onClick={() => toggleSection(sectionKey)}
                            className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/20 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs capitalize">{section}</Badge>
                              <span className="text-xs text-muted-foreground">{sectionTotal} students</span>
                            </div>
                            {isSectionOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                          </button>

                          {isSectionOpen && (
                            <div className="px-5 pb-4 space-y-3">
                              {Object.entries(subSections).sort().map(([sub, studs]) => (
                                <div key={sub}>
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sub-Section {sub}</span>
                                    <Badge className="text-xs gradient-accent border-0 text-white">{studs.length}</Badge>
                                  </div>
                                  <div className="space-y-1">
                                    {studs.map((s, i) => (
                                      <div key={s.user_id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors">
                                        <span className="text-xs text-muted-foreground w-5 text-right shrink-0">{i + 1}.</span>
                                        <div className="flex-1 min-w-0">
                                          <p className="font-bold text-sm truncate">{s.full_name}</p>
                                        </div>
                                        {s.admission_number && (
                                          <Badge variant="outline" className="text-xs font-mono shrink-0">{s.admission_number}</Badge>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
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

  const renderHomeroomSection = () => (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-foreground">My Homeroom Class</h2>
        <p className="text-sm text-muted-foreground">View your homeroom students and their rankings</p>
      </div>

      {loadingHomeroom ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-10 text-center text-muted-foreground">Loading homeroom data...</CardContent>
        </Card>
      ) : !homeroomAssignment ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-10 text-center">
            <BookOpen className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-muted-foreground">You are not assigned as a homeroom teacher</p>
            <p className="text-xs text-muted-foreground mt-1">Contact the administrator if you believe this is an error</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Homeroom Info Card */}
          <Card className="border-0 shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="gradient-primary rounded-xl p-3">
                  <BookOpen className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Grade {homeroomAssignment.grade_level}</h3>
                  <p className="text-sm text-muted-foreground">
                    {homeroomAssignment.section && `Section: ${homeroomAssignment.section}`}
                    {homeroomAssignment.sub_section && ` - ${homeroomAssignment.sub_section}`}
                    {homeroomAssignment.stream && ` (${homeroomAssignment.stream})`}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/30 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">Total Students</p>
                  <p className="text-2xl font-bold text-foreground">{homeroomStudents.length}</p>
                </div>
                <div className="bg-muted/30 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">Academic Year</p>
                  <p className="text-sm font-semibold text-foreground">{academicYear}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Class Rankings */}
          <Card className="border-0 shadow-md">
            <CardContent className="pt-6">
              <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                Class Rankings
              </h3>
              {homeroomRankings.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">No rankings available yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/20">
                        <TableHead className="w-16">Rank</TableHead>
                        <TableHead>Student Name</TableHead>
                        <TableHead>ID Number</TableHead>
                        <TableHead className="text-center">Subjects</TableHead>
                        <TableHead className="text-right">Average</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {homeroomRankings.map((student) => (
                        <TableRow key={student.user_id} className="hover:bg-muted/30">
                          <TableCell className="font-bold text-primary">
                            {student.rank ? `#${student.rank}` : "—"}
                          </TableCell>
                          <TableCell className="font-semibold">{student.full_name}</TableCell>
                          <TableCell className="font-mono text-sm">{student.admission_number}</TableCell>
                          <TableCell className="text-center">{student.total_subjects || 0}</TableCell>
                          <TableCell className="text-right">
                            {student.average_score > 0 ? (
                              <Badge
                                className={cn(
                                  "text-xs font-bold",
                                  student.average_score >= 50
                                    ? "gradient-accent border-0 text-white"
                                    : "bg-destructive text-destructive-foreground"
                                )}
                              >
                                {student.average_score}%
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">No scores</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );

  return (
    <div className="flex h-full min-h-screen bg-background">
      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setMobileSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 h-full z-40 flex flex-col bg-card border-r border-border/50 shadow-lg transition-all duration-300",
        "lg:relative lg:z-auto lg:shadow-none",
        sidebarCollapsed ? "w-16" : "w-56",
        mobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-border/50 shrink-0">
          {!sidebarCollapsed && <span className="font-bold text-sm text-foreground">Teacher Portal</span>}
          <button onClick={() => setSidebarCollapsed(p => !p)} className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors hidden lg:block">
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
          <button onClick={() => setMobileSidebarOpen(false)} className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors lg:hidden">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-3 space-y-1 px-2 overflow-y-auto">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                  isActive ? "gradient-primary text-white shadow-md" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Student count badge at bottom */}
        {!sidebarCollapsed && (
          <div className="px-4 py-3 border-t border-border/50 shrink-0">
            <p className="text-xs text-muted-foreground">
              {assignments.grades.length > 0
                ? `Grades: ${assignments.grades.sort().map(g => `G${g}`).join(", ")}`
                : "No grades assigned"}
            </p>
          </div>
        )}
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile topbar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 lg:hidden">
          <button onClick={() => setMobileSidebarOpen(true)} className="p-2 rounded-lg hover:bg-muted/50 transition-colors">
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-semibold text-sm capitalize">
            {activeSection === "grades" ? "Upload Grades" : activeSection === "students" ? "My Students" : "My Homeroom"}
          </span>
        </div>

        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          {activeSection === "grades" ? renderGradesSection() : activeSection === "students" ? renderStudentsSection() : renderHomeroomSection()}
        </main>
      </div>

      <SuccessModal
        open={!!successModal}
        title={successModal?.title ?? ""}
        description={successModal?.description}
        onClose={() => setSuccessModal(null)}
      />
    </div>
  );
}
