import { useEffect, useState } from "react";
// Supabase removed - replace with your backend API
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Upload, CheckCircle2, Plus, Trash2, AlertCircle, ChevronDown, ChevronUp, Zap } from "lucide-react";
import SuccessModal from "@/components/SuccessModal";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
// Database types removed

type StreamType = Database["public"]["Enums"]["stream_type"];

interface Subject {
  id: string;
  subject_name: string;
  grade_level: number;
  stream: StreamType | null;
}

interface StudentProfile {
  user_id: string;
  full_name: string;
  id_number: string;
}

interface AssessmentType {
  id: string;
  assessment_name: string;
  weight: number;
  is_fixed: boolean;
  subject_id: string;
  teacher_id: string;
}

const FIXED_ASSESSMENTS = ["Mid Exam", "Final Exam"];

export default function TeacherPortal() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [gradeLevel, setGradeLevel] = useState("");
  const [stream, setStream] = useState<StreamType | "">("");
  const [section, setSection] = useState("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [assignedGrades, setAssignedGrades] = useState<number[]>([]);

  // Assessment setup state
  const [assessmentTypes, setAssessmentTypes] = useState<AssessmentType[]>([]);
  const [newAssessmentName, setNewAssessmentName] = useState("");
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [editNames, setEditNames] = useState<Record<string, string>>({});
  const [savingSetup, setSavingSetup] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);

  // Score entry state
  const [selectedAssessment, setSelectedAssessment] = useState("");
  const [scores, setScores] = useState<Record<string, string>>({});
  const [existingScores, setExistingScores] = useState<Record<string, number>>({});

  const [assignedSections, setAssignedSections] = useState<string[]>([]);
  const [assignedSubSections, setAssignedSubSections] = useState<string[]>([]);
  const [subSection, setSubSection] = useState("");
  const [successModal, setSuccessModal] = useState<{ title: string; description?: string } | null>(null);

  const showSuccess = (title: string, description?: string) => setSuccessModal({ title, description });

  const needsStream = gradeLevel === "11" || gradeLevel === "12";

  useEffect(() => {
    if (!user) return;
    supabase.from("teacher_grades").select("grade_level").eq("teacher_id", user.id).then(({ data }) => {
      setAssignedGrades((data || []).map(g => g.grade_level));
    });
    supabase.from("teacher_sections").select("section").eq("teacher_id", user.id).then(({ data }) => {
      setAssignedSections((data || []).map((s: any) => s.section));
    });
    supabase.from("teacher_sub_sections" as any).select("sub_section").eq("teacher_id", user.id).then(({ data }) => {
      setAssignedSubSections((data || []).map((s: any) => s.sub_section));
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const fetchSubjects = async () => {
      const { data: assignments } = await supabase
        .from("teacher_subjects")
        .select("subject_id")
        .eq("teacher_id", user.id);
      const assignedIds = (assignments || []).map(a => a.subject_id);
      if (assignedIds.length === 0) { setSubjects([]); setSelectedSubject(""); return; }

      let query = supabase.from("subjects").select("*").in("id", assignedIds);
      if (gradeLevel) {
        query = query.eq("grade_level", parseInt(gradeLevel));
        if (needsStream && stream) query = query.eq("stream", stream as StreamType);
        else if (!needsStream) query = query.is("stream", null);
      }
      const { data } = await query;
      setSubjects(data || []);
      setSelectedSubject("");
    };
    fetchSubjects();
  }, [gradeLevel, stream, user]);

  // Fetch assessment types when subject changes
  useEffect(() => {
    if (!selectedSubject || !user) { setAssessmentTypes([]); return; }
    fetchAssessmentTypes();
  }, [selectedSubject, user]);

  const fetchAssessmentTypes = async () => {
    const { data } = await supabase
      .from("assessment_types")
      .select("*")
      .eq("subject_id", selectedSubject)
      .eq("teacher_id", user!.id)
      .order("is_fixed", { ascending: false })
      .order("assessment_name");
    const types = (data || []) as AssessmentType[];
    setAssessmentTypes(types);
    const w: Record<string, string> = {};
    const n: Record<string, string> = {};
    types.forEach(t => { w[t.id] = String(t.weight); n[t.id] = t.assessment_name; });
    setWeights(w);
    setEditNames(n);
  };

  // Auto-create fixed assessments if missing
  const ensureFixedAssessments = async () => {
    if (!selectedSubject || !user) return;
    const existingNames = assessmentTypes.map(a => a.assessment_name);
    const missing = FIXED_ASSESSMENTS.filter(n => !existingNames.includes(n));
    if (missing.length === 0) return;

    for (const name of missing) {
      await supabase.from("assessment_types").insert({
        teacher_id: user.id,
        subject_id: selectedSubject,
        assessment_name: name,
        weight: name === "Mid Exam" ? 30 : 40,
        is_fixed: true,
      } as any);
    }
    await fetchAssessmentTypes();
  };

  useEffect(() => {
    if (assessmentTypes.length === 0 && selectedSubject && user) {
      ensureFixedAssessments();
    }
  }, [assessmentTypes, selectedSubject, user]);

  // Fetch students
  useEffect(() => {
    if (!gradeLevel || !section) return;
    const fetchStudents = async () => {
      const { data: studentRoles } = await supabase
        .from("user_roles").select("user_id").eq("role", "student");
      const studentIds = (studentRoles || []).map(r => r.user_id);

      let query = supabase.from("profiles")
        .select("user_id, full_name, id_number")
        .eq("grade_level", parseInt(gradeLevel))
        .eq("is_active", true)
        .eq("section", section as any);
      if (needsStream && stream) query = query.eq("stream", stream as StreamType);
      if (subSection && subSection !== "all") query = (query as any).eq("sub_section", subSection);

      const { data } = await query.order("id_number", { ascending: true });
      const filtered = (data || []).filter(p => studentIds.includes(p.user_id));
      setStudents(filtered);
      setScores({});
    };
    fetchStudents();
  }, [gradeLevel, stream, section, subSection]);

  // Fetch existing scores when assessment changes
  useEffect(() => {
    if (!selectedAssessment || students.length === 0) { setExistingScores({}); return; }
    const fetchExisting = async () => {
      const { data } = await supabase
        .from("assessment_scores")
        .select("student_id, score")
        .eq("assessment_type_id", selectedAssessment)
        .in("student_id", students.map(s => s.user_id));
      const map: Record<string, number> = {};
      const prefilled: Record<string, string> = {};
      (data || []).forEach((g: any) => {
        map[g.student_id] = Number(g.score);
        prefilled[g.student_id] = String(Number(g.score));
      });
      setExistingScores(map);
      setScores(prefilled);
    };
    fetchExisting();
  }, [selectedAssessment, students]);

  // --- Assessment Setup Handlers ---
  const addCustomAssessment = async () => {
    if (!newAssessmentName.trim() || !selectedSubject || !user) return;
    if (FIXED_ASSESSMENTS.includes(newAssessmentName.trim())) {
      toast({ title: "Error", description: "This name is reserved for fixed assessments.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("assessment_types").insert({
      teacher_id: user.id,
      subject_id: selectedSubject,
      assessment_name: newAssessmentName.trim(),
      weight: 0,
      is_fixed: false,
    } as any);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setNewAssessmentName("");
      await fetchAssessmentTypes();
      showSuccess("Added", `"${newAssessmentName.trim()}" assessment added.`);
    }
  };

  const deleteAssessment = async (id: string) => {
    const { error } = await supabase.from("assessment_types").delete().eq("id", id);
    if (!error) await fetchAssessmentTypes();
  };

  const saveWeights = async () => {
    const total = Object.values(weights).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
    if (Math.abs(total - 100) > 0.01) {
      toast({ title: "Error", description: `Weights must total 100%. Currently: ${total}%`, variant: "destructive" });
      return;
    }
    setSavingSetup(true);
    for (const [id, w] of Object.entries(weights)) {
      const name = editNames[id];
      const updateData: any = { weight: parseFloat(w) };
      if (name && name.trim()) updateData.assessment_name = name.trim();
      await supabase.from("assessment_types").update(updateData).eq("id", id);
    }
    setSavingSetup(false);
    showSuccess("Saved", "Assessment setup updated.");
    await fetchAssessmentTypes();
  };

  const totalWeight = Object.values(weights).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);

  // --- Score Entry Handlers ---
  const updateScore = (studentId: string, value: string) => {
    setScores(prev => ({ ...prev, [studentId]: value }));
  };

  const getMaxScore = () => {
    const at = assessmentTypes.find(a => a.id === selectedAssessment);
    return at ? at.weight : 100;
  };

  const handleBulkSubmit = async () => {
    if (!selectedAssessment) {
      toast({ title: "Error", description: "Please select an assessment.", variant: "destructive" });
      return;
    }
    const maxScore = getMaxScore();
    const entries = Object.entries(scores).filter(([_, v]) => v.trim() !== "");
    if (entries.length === 0) {
      toast({ title: "Error", description: "Enter at least one score.", variant: "destructive" });
      return;
    }
    for (const [_, v] of entries) {
      const num = parseFloat(v);
      if (isNaN(num) || num < 0 || num > maxScore) {
        toast({ title: "Error", description: `All scores must be between 0 and ${maxScore}.`, variant: "destructive" });
        return;
      }
    }

    setSubmitting(true);
    let successCount = 0, errorCount = 0;

    for (const [studentId, scoreVal] of entries) {
      const scoreNum = parseFloat(scoreVal);
      const hasExisting = existingScores[studentId] !== undefined;

      if (hasExisting) {
        const { error } = await supabase
          .from("assessment_scores")
          .update({ score: scoreNum, published: true } as any)
          .eq("student_id", studentId)
          .eq("assessment_type_id", selectedAssessment);
        if (error) errorCount++; else successCount++;
      } else {
        const { error } = await supabase.from("assessment_scores").insert({
          student_id: studentId,
          assessment_type_id: selectedAssessment,
          score: scoreNum,
          teacher_id: user!.id,
          published: true,
        } as any);
        if (error) errorCount++; else successCount++;
      }
    }

    if (successCount > 0) showSuccess("Success", `${successCount} score(s) saved!`);
    if (errorCount > 0) toast({ title: "Some errors", description: `${errorCount} score(s) failed.`, variant: "destructive" });
    setSubmitting(false);

    // Refresh
    const { data } = await supabase
      .from("assessment_scores")
      .select("student_id, score")
      .eq("assessment_type_id", selectedAssessment)
      .in("student_id", students.map(s => s.user_id));
    const map: Record<string, number> = {};
    (data || []).forEach((g: any) => { map[g.student_id] = Number(g.score); });
    setExistingScores(map);
  };

  const filledCount = Object.values(scores).filter(v => v.trim() !== "").length;

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
              <Select value={gradeLevel} onValueChange={(v) => { setGradeLevel(v); setStream(""); setSection(""); setSelectedSubject(""); }}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select grade" /></SelectTrigger>
                <SelectContent>
                  {[9, 10, 11, 12].filter(g => assignedGrades.includes(g)).map(g => (
                    <SelectItem key={g} value={String(g)}>Grade {g}</SelectItem>
                  ))}
                  {assignedGrades.length === 0 && (
                    <SelectItem value="none" disabled>No grades assigned</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Section</Label>
              <Select value={section} onValueChange={setSection}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select section" /></SelectTrigger>
                <SelectContent>
                  {assignedSections.map(s => (
                    <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                  ))}
                  {assignedSections.length === 0 && (
                    <SelectItem value="none" disabled>No sections assigned</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            {assignedSubSections.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Sub-Section</Label>
                <Select value={subSection} onValueChange={setSubSection}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="All sub-sections" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {assignedSubSections.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          {needsStream && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Stream</Label>
              <Select value={stream} onValueChange={(v) => setStream(v as StreamType)}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select stream" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="natural">Natural</SelectItem>
                  <SelectItem value="social">Social</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Subject</Label>
            <Select value={selectedSubject} onValueChange={(v) => { setSelectedSubject(v); setSelectedAssessment(""); }} disabled={subjects.length === 0}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select subject" /></SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.subject_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedSubject && (
        <div className="space-y-4">
          {/* Assessment Setup - Collapsible */}
          <Collapsible open={setupOpen} onOpenChange={setSetupOpen}>
            <Card className="border-0 shadow-sm">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">Assessment Setup</CardTitle>
                      {Math.abs(totalWeight - 100) < 0.01 ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Ready
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> {totalWeight}% / 100%
                        </span>
                      )}
                    </div>
                    {setupOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <p className="text-xs text-muted-foreground text-left">
                    {assessmentTypes.length} assessment(s) configured · Weights must total 100%
                  </p>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4 pt-0">
                  {/* Quick preset buttons */}
                  {assessmentTypes.length <= 2 && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Quick Presets</Label>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-lg h-8 text-xs gap-1"
                          onClick={() => {
                            const newW: Record<string, string> = {};
                            assessmentTypes.forEach(a => {
                              if (a.assessment_name === "Mid Exam") newW[a.id] = "30";
                              else if (a.assessment_name === "Final Exam") newW[a.id] = "40";
                              else newW[a.id] = "0";
                            });
                            // Remaining 30% note
                            setWeights(newW);
                          }}
                        >
                          <Zap className="h-3 w-3" /> Mid 30 / Final 40
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-lg h-8 text-xs gap-1"
                          onClick={() => {
                            const newW: Record<string, string> = {};
                            assessmentTypes.forEach(a => {
                              if (a.assessment_name === "Mid Exam") newW[a.id] = "40";
                              else if (a.assessment_name === "Final Exam") newW[a.id] = "40";
                              else newW[a.id] = "0";
                            });
                            setWeights(newW);
                          }}
                        >
                          <Zap className="h-3 w-3" /> Mid 40 / Final 40
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Assessment list with visual weight bars */}
                  {assessmentTypes.length > 0 && (
                    <div className="space-y-3">
                      {assessmentTypes.map(a => (
                        <div key={a.id} className="space-y-1.5">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 flex items-center gap-2 min-w-0">
                              {a.is_fixed ? (
                                <span className="text-sm font-medium truncate">{a.assessment_name}</span>
                              ) : (
                                <Input
                                  value={editNames[a.id] || ""}
                                  onChange={(e) => setEditNames(prev => ({ ...prev, [a.id]: e.target.value }))}
                                  className="h-8 text-sm rounded-lg font-medium"
                                  placeholder="Assessment name"
                                />
                              )}
                              {a.is_fixed && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">Fixed</span>}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                value={weights[a.id] || ""}
                                onChange={(e) => setWeights(prev => ({ ...prev, [a.id]: e.target.value }))}
                                className="w-20 h-8 text-sm rounded-lg text-center"
                                placeholder="%"
                              />
                              <span className="text-xs text-muted-foreground">%</span>
                            </div>
                            {!a.is_fixed && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteAssessment(a.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {a.is_fixed && <div className="w-8" />}
                          </div>
                          {/* Visual weight bar */}
                          <Progress
                            value={parseFloat(weights[a.id] || "0")}
                            className="h-1.5"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Total weight indicator */}
                  <div className={cn(
                    "flex items-center gap-2 text-sm font-semibold rounded-lg px-3 py-2",
                    Math.abs(totalWeight - 100) < 0.01
                      ? "bg-primary/10 text-primary"
                      : "bg-destructive/10 text-destructive"
                  )}>
                    {Math.abs(totalWeight - 100) < 0.01 ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    Total: {totalWeight}% {Math.abs(totalWeight - 100) >= 0.01 && `(need ${100 - totalWeight}% more)`}
                  </div>

                  {/* Add custom assessment */}
                  <div className="flex gap-2">
                    <Input
                      value={newAssessmentName}
                      onChange={(e) => setNewAssessmentName(e.target.value)}
                      placeholder="e.g. Assignment, Quiz, Project..."
                      className="rounded-lg h-9 text-sm"
                      onKeyDown={(e) => e.key === "Enter" && addCustomAssessment()}
                    />
                    <Button size="sm" variant="outline" className="rounded-lg h-9 shrink-0" onClick={addCustomAssessment} disabled={!newAssessmentName.trim()}>
                      <Plus className="h-4 w-4 mr-1" /> Add
                    </Button>
                  </div>

                  <Button onClick={saveWeights} disabled={savingSetup || Math.abs(totalWeight - 100) > 0.01} className="w-full rounded-xl gradient-primary border-0 text-white h-10 font-semibold">
                    {savingSetup ? "Saving..." : "Save Assessment Setup"}
                  </Button>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Score Entry - Always visible */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Enter Scores</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Assessment selector */}
              <div>
                <Label className="text-sm font-semibold mb-2 block">Assessment</Label>
                <Select value={selectedAssessment} onValueChange={setSelectedAssessment} disabled={assessmentTypes.length === 0 || Math.abs(totalWeight - 100) > 0.01}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={
                      assessmentTypes.length === 0
                        ? "Set up assessments first ↑"
                        : Math.abs(totalWeight - 100) > 0.01
                          ? "Save weights first (must total 100%)"
                          : "Select assessment"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {assessmentTypes.map(a => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.assessment_name} ({a.weight}%)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Student Scores Table */}
          {selectedAssessment && students.length > 0 && (
            <Card className="border-0 shadow-sm overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Enter Scores ({students.length} students)</span>
                  <span className="text-sm font-normal text-muted-foreground">Max: {getMaxScore()} · {filledCount} filled</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/20">
                        <TableHead className="w-8">#</TableHead>
                        <TableHead>Student Name</TableHead>
                        <TableHead>ID</TableHead>
                        <TableHead className="w-28">Score</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map((s, i) => (
                        <TableRow key={s.user_id} className="hover:bg-muted/30">
                          <TableCell className="text-muted-foreground text-sm">{i + 1}</TableCell>
                          <TableCell className="font-medium">{s.full_name}</TableCell>
                          <TableCell className="font-mono text-sm text-muted-foreground">{s.id_number}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              max={getMaxScore()}
                              value={scores[s.user_id] || ""}
                              onChange={(e) => updateScore(s.user_id, e.target.value)}
                              placeholder={`0-${getMaxScore()}`}
                              className="rounded-lg h-8 text-sm w-24"
                            />
                          </TableCell>
                          <TableCell>
                            {existingScores[s.user_id] !== undefined && (
                              <CheckCircle2 className="h-4 w-4 text-primary" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="p-4 border-t">
                  <Button
                    onClick={handleBulkSubmit}
                    disabled={submitting || filledCount === 0}
                    className="w-full rounded-xl gradient-primary border-0 text-white h-11 font-semibold"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {submitting ? "Saving..." : `Save ${filledCount} Score(s)`}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {selectedAssessment && students.length === 0 && gradeLevel && section && (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-8 text-center text-muted-foreground">
                No students found for this selection
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <SuccessModal
        open={!!successModal}
        onClose={() => setSuccessModal(null)}
        title={successModal?.title || ""}
        description={successModal?.description}
      />
    </div>
  );
}
