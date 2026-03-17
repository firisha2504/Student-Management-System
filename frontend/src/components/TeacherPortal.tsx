import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Upload, CheckCircle2, Plus, Trash2, AlertCircle,
  ChevronDown, ChevronUp, Zap, Pencil, Save, X, Eye
} from "lucide-react";
import SuccessModal from "@/components/SuccessModal";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface Subject { id: number; subject_name: string; grade_level: number; stream: string | null; }
interface StudentProfile { user_id: number; full_name: string; username: string; }
interface AssessmentType { id: number; assessment_name: string; weight: number; subject_id: number; teacher_id: number; }
interface SavedScore { id: number; student_id: number; full_name: string; username: string; score: number; }

const FIXED_ASSESSMENTS = ["Mid Exam", "Final Exam"];
type Tab = "setup" | "scores" | "view";

export default function TeacherPortal() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Filters
  const [gradeLevel, setGradeLevel] = useState("");
  const [stream, setStream] = useState("");
  const [section, setSection] = useState("");
  const [subSection, setSubSection] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<StudentProfile[]>([]);

  // Assignments
  const [assignedGrades, setAssignedGrades] = useState<number[]>([]);
  const [assignedSections, setAssignedSections] = useState<string[]>([]);
  const [assignedSubjectIds, setAssignedSubjectIds] = useState<number[]>([]);

  // Assessment setup
  const [assessmentTypes, setAssessmentTypes] = useState<AssessmentType[]>([]);
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [editNames, setEditNames] = useState<Record<string, string>>({});
  const [newAssessmentName, setNewAssessmentName] = useState("");
  const [savingSetup, setSavingSetup] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);

  // Score entry
  const [selectedAssessment, setSelectedAssessment] = useState("");
  const [scores, setScores] = useState<Record<string, string>>({});
  const [existingScores, setExistingScores] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  // View/edit saved scores
  const [activeTab, setActiveTab] = useState<Tab>("scores");
  const [viewAssessment, setViewAssessment] = useState("");
  const [savedScores, setSavedScores] = useState<SavedScore[]>([]);
  const [loadingView, setLoadingView] = useState(false);
  const [editingScore, setEditingScore] = useState<Record<number, string>>({});
  const [savingScore, setSavingScore] = useState<number | null>(null);

  const [successModal, setSuccessModal] = useState<{ title: string; description?: string } | null>(null);
  const showSuccess = (title: string, description?: string) => setSuccessModal({ title, description });
  const needsStream = gradeLevel === "11" || gradeLevel === "12";

  const getCurrentAcademicYear = () => {
    const y = new Date().getFullYear();
    return new Date().getMonth() >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
  };

  // Load assignments
  useEffect(() => {
    if (!user) return;
    api.getMyAssignments().then(a => {
      setAssignedGrades(a.grades || []);
      setAssignedSections(a.sections || []);
      setAssignedSubjectIds(a.subjects || []);
    }).catch(console.error);
  }, [user]);

  // Load subjects when grade/stream changes
  useEffect(() => {
    if (!user || !gradeLevel || assignedSubjectIds.length === 0) return;
    const filters: any = { grade_level: parseInt(gradeLevel) };
    if (needsStream && stream) filters.stream = stream;
    api.getAllSubjects(filters).then(all => {
      setSubjects(all.filter((s: Subject) => assignedSubjectIds.includes(s.id)));
      setSelectedSubject("");
    }).catch(console.error);
  }, [gradeLevel, stream, user, needsStream, assignedSubjectIds]);

  // Load assessment types when subject changes
  useEffect(() => {
    if (!selectedSubject || !gradeLevel) { setAssessmentTypes([]); return; }
    fetchAssessmentTypes();
  }, [selectedSubject, gradeLevel]);

  const fetchAssessmentTypes = async () => {
    try {
      const types = await api.getAssessmentTypes({
        subject_id: parseInt(selectedSubject),
        grade_level: parseInt(gradeLevel),
        stream: stream || undefined,
        section: section || undefined,
      });
      setAssessmentTypes(types || []);
      const w: Record<string, string> = {};
      const n: Record<string, string> = {};
      types.forEach((t: AssessmentType) => { w[t.id] = String(Number(t.weight)); n[t.id] = t.assessment_name; });
      setWeights(w);
      setEditNames(n);
      if (types.length === 0) await ensureFixedAssessments();
    } catch (e) { console.error(e); setAssessmentTypes([]); }
  };

  const ensureFixedAssessments = async () => {
    if (!selectedSubject || !gradeLevel) return;
    for (const name of FIXED_ASSESSMENTS) {
      await api.createAssessmentType({
        subject_id: parseInt(selectedSubject), grade_level: parseInt(gradeLevel),
        stream: stream || undefined, section: section || undefined,
        assessment_name: name, weight: name === "Mid Exam" ? 30 : 40,
      });
    }
    await fetchAssessmentTypes();
  };

  // Load students
  useEffect(() => {
    if (!gradeLevel || !section) return;
    const filters: any = { grade_level: parseInt(gradeLevel), section };
    if (needsStream && stream) filters.stream = stream;
    if (subSection && subSection !== "all") filters.sub_section = subSection;
    api.getStudents(filters).then(d => { setStudents(d || []); setScores({}); }).catch(console.error);
  }, [gradeLevel, stream, section, subSection, needsStream]);

  // Load existing scores when assessment selected (Enter Scores tab)
  useEffect(() => {
    if (!selectedAssessment || students.length === 0) { setExistingScores({}); return; }
    api.getAssessmentScores({ assessment_type_id: parseInt(selectedAssessment) }).then(data => {
      const map: Record<string, number> = {};
      const pre: Record<string, string> = {};
      data.forEach((s: any) => { map[s.student_id] = Number(s.score); pre[s.student_id] = String(Number(s.score)); });
      setExistingScores(map);
      setScores(pre);
    }).catch(console.error);
  }, [selectedAssessment, students]);

  // Load saved scores for View tab
  useEffect(() => {
    if (!viewAssessment || activeTab !== "view") return;
    loadSavedScores();
  }, [viewAssessment, activeTab]);

  const loadSavedScores = async () => {
    setLoadingView(true);
    try {
      const data = await api.getAssessmentScores({ assessment_type_id: parseInt(viewAssessment) });
      // Enrich with student names from students list
      const enriched: SavedScore[] = data.map((s: any) => {
        const st = students.find(st => st.user_id === s.student_id);
        return { id: s.id, student_id: s.student_id, full_name: st?.full_name || s.student_id, username: st?.username || "—", score: Number(s.score) };
      });
      setSavedScores(enriched);
      setEditingScore({});
    } catch (e) { console.error(e); }
    setLoadingView(false);
  };

  // Assessment setup actions
  const addCustomAssessment = async () => {
    if (!newAssessmentName.trim() || !selectedSubject || !gradeLevel) return;
    if (FIXED_ASSESSMENTS.includes(newAssessmentName.trim())) {
      toast({ title: "Error", description: "That name is reserved.", variant: "destructive" }); return;
    }
    try {
      await api.createAssessmentType({
        subject_id: parseInt(selectedSubject), grade_level: parseInt(gradeLevel),
        stream: stream || undefined, section: section || undefined,
        assessment_name: newAssessmentName.trim(), weight: 0,
      });
      setNewAssessmentName("");
      await fetchAssessmentTypes();
      showSuccess("Added", `"${newAssessmentName.trim()}" added.`);
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  const deleteAssessment = async (id: number) => {
    try {
      await api.deleteAssessmentType(id);
      await fetchAssessmentTypes();
      showSuccess("Deleted", "Assessment removed.");
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  const saveWeights = async () => {
    const total = Object.values(weights).reduce((s, v) => s + (parseFloat(v) || 0), 0);
    if (Math.abs(total - 100) > 0.01) {
      toast({ title: "Error", description: `Weights must total 100%. Currently: ${total}%`, variant: "destructive" }); return;
    }
    setSavingSetup(true);
    try {
      for (const [id, w] of Object.entries(weights)) {
        await api.updateAssessmentType(parseInt(id), { weight: parseFloat(w), assessment_name: editNames[id]?.trim() || undefined });
      }
      showSuccess("Saved", "Assessment setup updated.");
      await fetchAssessmentTypes();
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    setSavingSetup(false);
  };

  // Score entry actions
  const getMaxScore = () => {
    const at = assessmentTypes.find(a => a.id === parseInt(selectedAssessment));
    return at ? Number(at.weight) : 100;
  };

  const handleBulkSubmit = async () => {
    if (!selectedAssessment) { toast({ title: "Error", description: "Select an assessment.", variant: "destructive" }); return; }
    const maxScore = getMaxScore();
    const entries = Object.entries(scores).filter(([, v]) => v.trim() !== "");
    if (entries.length === 0) { toast({ title: "Error", description: "Enter at least one score.", variant: "destructive" }); return; }
    for (const [, v] of entries) {
      const n = parseFloat(v);
      if (isNaN(n) || n < 0 || n > maxScore) {
        toast({ title: "Error", description: `Scores must be 0–${maxScore}.`, variant: "destructive" }); return;
      }
    }
    setSubmitting(true);
    try {
      await api.bulkUploadAssessmentScores({
        scores: entries.map(([sid, val]) => ({ student_id: parseInt(sid), assessment_type_id: parseInt(selectedAssessment), score: parseFloat(val) })),
        term: "Term 1", academic_year: getCurrentAcademicYear(),
      });
      showSuccess("Saved", `${entries.length} score(s) saved.`);
      const data = await api.getAssessmentScores({ assessment_type_id: parseInt(selectedAssessment) });
      const map: Record<string, number> = {};
      data.forEach((s: any) => { map[s.student_id] = Number(s.score); });
      setExistingScores(map);
    } catch (e: any) { toast({ title: "Error", description: e.message || "Failed to save", variant: "destructive" }); }
    setSubmitting(false);
  };

  // View/edit saved score actions
  const startEditScore = (scoreId: number, current: number) => setEditingScore(prev => ({ ...prev, [scoreId]: String(current) }));
  const cancelEditScore = (scoreId: number) => setEditingScore(prev => { const n = { ...prev }; delete n[scoreId]; return n; });

  const saveEditedScore = async (scoreId: number, studentId: number) => {
    const val = parseFloat(editingScore[scoreId] || "");
    const maxScore = assessmentTypes.find(a => a.id === parseInt(viewAssessment));
    const max = maxScore ? Number(maxScore.weight) : 100;
    if (isNaN(val) || val < 0 || val > max) {
      toast({ title: "Error", description: `Score must be 0–${max}.`, variant: "destructive" }); return;
    }
    setSavingScore(scoreId);
    try {
      await api.uploadAssessmentScore({
        student_id: studentId, assessment_type_id: parseInt(viewAssessment),
        score: val, term: "Term 1", academic_year: getCurrentAcademicYear(),
      });
      showSuccess("Updated", "Score updated.");
      await loadSavedScores();
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    setSavingScore(null);
  };

  const deleteScore = async (scoreId: number) => {
    try {
      await api.deleteAssessmentScore(scoreId);
      showSuccess("Deleted", "Score removed.");
      await loadSavedScores();
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  const totalWeight = Object.values(weights).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const filledCount = Object.values(scores).filter(v => v.trim() !== "").length;
  const isFixed = (name: string) => FIXED_ASSESSMENTS.includes(name);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Upload className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Upload Grades</h1>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Grade Level</Label>
              <Select value={gradeLevel} onValueChange={v => { setGradeLevel(v); setStream(""); setSection(""); setSelectedSubject(""); setSelectedAssessment(""); setViewAssessment(""); }}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select grade" /></SelectTrigger>
                <SelectContent>
                  {[9,10,11,12].filter(g => assignedGrades.includes(g)).map(g => <SelectItem key={g} value={String(g)}>Grade {g}</SelectItem>)}
                  {assignedGrades.length === 0 && <SelectItem value="none" disabled>No grades assigned</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Section</Label>
              <Select value={section} onValueChange={setSection}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select section" /></SelectTrigger>
                <SelectContent>
                  {assignedSections.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                  {assignedSections.length === 0 && <SelectItem value="none" disabled>No sections assigned</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Sub-Section (Optional)</Label>
              <Select value={subSection} onValueChange={setSubSection}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="All sub-sections" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {["A","B","C","D","E","F","G","H"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {needsStream && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Stream</Label>
                <Select value={stream} onValueChange={setStream}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select stream" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Natural Science">Natural Science</SelectItem>
                    <SelectItem value="Social Science">Social Science</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Subject</Label>
            <Select value={selectedSubject} onValueChange={v => { setSelectedSubject(v); setSelectedAssessment(""); setViewAssessment(""); }} disabled={subjects.length === 0}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select subject" /></SelectTrigger>
              <SelectContent>
                {subjects.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.subject_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedSubject && (
        <div className="space-y-4">
          {/* Assessment Setup */}
          <Collapsible open={setupOpen} onOpenChange={setSetupOpen}>
            <Card className="border-0 shadow-sm">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">Assessment Setup</CardTitle>
                      {Math.abs(totalWeight - 100) < 0.01
                        ? <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Ready</span>
                        : <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {totalWeight}% / 100%</span>}
                    </div>
                    {setupOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <p className="text-xs text-muted-foreground text-left">{assessmentTypes.length} assessment(s) · Weights must total 100%</p>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4 pt-0">
                  {/* Presets */}
                  {assessmentTypes.length >= 2 && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Quick Presets</Label>
                      <div className="flex flex-wrap gap-2">
                        {[["30","40"],["40","40"]].map(([mid, fin]) => (
                          <Button key={mid} variant="outline" size="sm" className="rounded-lg h-8 text-xs gap-1" onClick={() => {
                            const nw: Record<string, string> = {};
                            assessmentTypes.forEach(a => {
                              if (a.assessment_name === "Mid Exam") nw[a.id] = mid;
                              else if (a.assessment_name === "Final Exam") nw[a.id] = fin;
                              else nw[a.id] = "0";
                            });
                            setWeights(nw);
                          }}>
                            <Zap className="h-3 w-3" /> Mid {mid} / Final {fin}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Assessment rows */}
                  <div className="space-y-3">
                    {assessmentTypes.map(a => (
                      <div key={a.id} className="space-y-1.5">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 flex items-center gap-2 min-w-0">
                            {isFixed(a.assessment_name)
                              ? <><span className="text-sm font-medium">{a.assessment_name}</span><span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Fixed</span></>
                              : <Input value={editNames[a.id] || ""} onChange={e => setEditNames(p => ({ ...p, [a.id]: e.target.value }))} className="h-8 text-sm rounded-lg" placeholder="Assessment name" />}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Input type="number" min={0} max={100} value={weights[a.id] || ""} onChange={e => setWeights(p => ({ ...p, [a.id]: e.target.value }))} className="w-20 h-8 text-sm rounded-lg text-center" placeholder="%" />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>
                          {!isFixed(a.assessment_name)
                            ? <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteAssessment(a.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                            : <div className="w-8" />}
                        </div>
                        <Progress value={parseFloat(weights[a.id] || "0")} className="h-1.5" />
                      </div>
                    ))}
                  </div>
                  {/* Total indicator */}
                  <div className={cn("flex items-center gap-2 text-sm font-semibold rounded-lg px-3 py-2", Math.abs(totalWeight - 100) < 0.01 ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive")}>
                    {Math.abs(totalWeight - 100) < 0.01 ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    Total: {totalWeight}% {Math.abs(totalWeight - 100) >= 0.01 && `(need ${(100 - totalWeight).toFixed(1)}% more)`}
                  </div>
                  {/* Add custom */}
                  <div className="flex gap-2">
                    <Input value={newAssessmentName} onChange={e => setNewAssessmentName(e.target.value)} placeholder="e.g. Assignment, Quiz..." className="rounded-lg h-9 text-sm" onKeyDown={e => e.key === "Enter" && addCustomAssessment()} />
                    <Button size="sm" variant="outline" className="rounded-lg h-9 shrink-0" onClick={addCustomAssessment} disabled={!newAssessmentName.trim()}><Plus className="h-4 w-4 mr-1" /> Add</Button>
                  </div>
                  <Button onClick={saveWeights} disabled={savingSetup || Math.abs(totalWeight - 100) > 0.01} className="w-full rounded-xl gradient-primary border-0 text-white h-10 font-semibold">
                    {savingSetup ? "Saving..." : "Save Assessment Setup"}
                  </Button>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Tab switcher */}
          <div className="flex rounded-xl border overflow-hidden">
            {([["scores", "Enter / Edit Scores"], ["view", "View Uploaded"]] as [Tab, string][]).map(([id, label]) => (
              <button key={id} onClick={() => setActiveTab(id)} className={cn("flex-1 py-2.5 text-sm font-semibold transition-colors", activeTab === id ? "bg-primary text-white" : "bg-muted/30 text-muted-foreground hover:bg-muted/60")}>
                {label}
              </button>
            ))}
          </div>

          {/* ── ENTER / EDIT SCORES TAB ── */}
          {activeTab === "scores" && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Enter / Edit Scores</CardTitle>
                <p className="text-xs text-muted-foreground">Existing scores are pre-filled. Change any value and save to update.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-semibold mb-2 block">Assessment</Label>
                  <Select value={selectedAssessment} onValueChange={setSelectedAssessment} disabled={assessmentTypes.length === 0 || Math.abs(totalWeight - 100) > 0.01}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder={assessmentTypes.length === 0 ? "Set up assessments first ↑" : Math.abs(totalWeight - 100) > 0.01 ? "Save weights first (must total 100%)" : "Select assessment"} />
                    </SelectTrigger>
                    <SelectContent>
                      {assessmentTypes.map(a => <SelectItem key={a.id} value={a.id.toString()}>{a.assessment_name} ({Number(a.weight)}%)</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {selectedAssessment && students.length > 0 && (
                  <>
                    <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
                      <span>{students.length} students · Max score: <strong className="text-foreground">{getMaxScore()}</strong></span>
                      <span>{filledCount} filled · <span className="text-primary font-semibold">{Object.keys(existingScores).length} already saved</span></span>
                    </div>
                    <div className="rounded-xl border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/20">
                            <TableHead className="w-8">#</TableHead>
                            <TableHead>Student</TableHead>
                            <TableHead className="w-32">Score / {getMaxScore()}</TableHead>
                            <TableHead className="w-16 text-center">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {students.map((s, i) => {
                            const saved = existingScores[s.user_id];
                            const current = scores[s.user_id] || "";
                            const isModified = saved !== undefined && current !== "" && parseFloat(current) !== saved;
                            return (
                              <TableRow key={s.user_id} className={cn("hover:bg-muted/30", isModified && "bg-amber-500/5")}>
                                <TableCell className="text-muted-foreground text-sm">{i + 1}</TableCell>
                                <TableCell>
                                  <p className="font-medium text-sm">{s.full_name}</p>
                                  <p className="text-xs text-muted-foreground font-mono">{s.username}</p>
                                </TableCell>
                                <TableCell>
                                  <Input type="number" min={0} max={getMaxScore()} value={current} onChange={e => setScores(p => ({ ...p, [s.user_id]: e.target.value }))} placeholder={`0–${getMaxScore()}`} className={cn("rounded-lg h-8 text-sm w-28", isModified && "border-amber-400 focus-visible:ring-amber-400")} />
                                </TableCell>
                                <TableCell className="text-center">
                                  {isModified
                                    ? <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600 bg-amber-500/10">Modified</Badge>
                                    : saved !== undefined
                                      ? <CheckCircle2 className="h-4 w-4 text-primary mx-auto" />
                                      : null}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    <Button onClick={handleBulkSubmit} disabled={submitting || filledCount === 0} className="w-full rounded-xl gradient-primary border-0 text-white h-11 font-semibold">
                      <Upload className="h-4 w-4 mr-2" />
                      {submitting ? "Saving..." : `Save / Update ${filledCount} Score(s)`}
                    </Button>
                  </>
                )}
                {selectedAssessment && students.length === 0 && (
                  <p className="text-center text-muted-foreground py-6">No students found for the selected grade and section.</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── VIEW UPLOADED TAB ── */}
          {activeTab === "view" && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Eye className="h-4 w-4 text-primary" /> View & Edit Uploaded Scores</CardTitle>
                <p className="text-xs text-muted-foreground">Click the pencil icon to edit a score, trash to delete it.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-semibold mb-2 block">Assessment</Label>
                  <Select value={viewAssessment} onValueChange={setViewAssessment} disabled={assessmentTypes.length === 0}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select assessment to view" /></SelectTrigger>
                    <SelectContent>
                      {assessmentTypes.map(a => <SelectItem key={a.id} value={a.id.toString()}>{a.assessment_name} ({Number(a.weight)}%)</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {viewAssessment && (
                  loadingView ? (
                    <p className="text-center text-muted-foreground py-6">Loading...</p>
                  ) : savedScores.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Upload className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p>No scores uploaded yet for this assessment.</p>
                    </div>
                  ) : (
                    <>
                      <div className="text-sm text-muted-foreground px-1">{savedScores.length} score(s) uploaded</div>
                      <div className="rounded-xl border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/20">
                              <TableHead className="w-8">#</TableHead>
                              <TableHead>Student</TableHead>
                              <TableHead className="w-36">Score</TableHead>
                              <TableHead className="w-24 text-center">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {savedScores.map((s, i) => {
                              const isEditing = editingScore[s.id] !== undefined;
                              const maxScore = assessmentTypes.find(a => a.id === parseInt(viewAssessment));
                              const max = maxScore ? Number(maxScore.weight) : 100;
                              return (
                                <TableRow key={s.id} className={cn("hover:bg-muted/30", isEditing && "bg-primary/5")}>
                                  <TableCell className="text-muted-foreground text-sm">{i + 1}</TableCell>
                                  <TableCell>
                                    <p className="font-medium text-sm">{s.full_name}</p>
                                    <p className="text-xs text-muted-foreground font-mono">{s.username}</p>
                                  </TableCell>
                                  <TableCell>
                                    {isEditing ? (
                                      <Input type="number" min={0} max={max} value={editingScore[s.id]} onChange={e => setEditingScore(p => ({ ...p, [s.id]: e.target.value }))} className="rounded-lg h-8 text-sm w-28 border-primary" autoFocus />
                                    ) : (
                                      <span className={cn("text-sm font-bold", s.score >= max * 0.5 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
                                        {s.score} / {max}
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center justify-center gap-1">
                                      {isEditing ? (
                                        <>
                                          <Button size="icon" variant="ghost" className="h-7 w-7 text-primary hover:text-primary" disabled={savingScore === s.id} onClick={() => saveEditedScore(s.id, s.student_id)}>
                                            {savingScore === s.id ? <span className="text-[10px]">...</span> : <Save className="h-3.5 w-3.5" />}
                                          </Button>
                                          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => cancelEditScore(s.id)}>
                                            <X className="h-3.5 w-3.5" />
                                          </Button>
                                        </>
                                      ) : (
                                        <>
                                          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => startEditScore(s.id, s.score)}>
                                            <Pencil className="h-3.5 w-3.5" />
                                          </Button>
                                          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteScore(s.id)}>
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </Button>
                                        </>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  )
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <SuccessModal open={!!successModal} onClose={() => setSuccessModal(null)} title={successModal?.title || ""} description={successModal?.description} />
    </div>
  );
}
