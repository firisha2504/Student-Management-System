import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/services/api";
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

interface Subject {
  id: number;
  subject_name: string;
  grade_level: number;
  stream: string | null;
}

interface StudentProfile {
  user_id: number;
  full_name: string;
  username: string;
}

interface AssessmentType {
  id: number;
  assessment_name: string;
  weight: number;
  subject_id: number;
  teacher_id: number;
}

const FIXED_ASSESSMENTS = ["Mid Exam", "Final Exam"];

export default function TeacherPortal() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [gradeLevel, setGradeLevel] = useState("");
  const [stream, setStream] = useState("");
  const [section, setSection] = useState("");
  const [subSection, setSubSection] = useState("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Teacher assignments
  const [assignedGrades, setAssignedGrades] = useState<number[]>([]);
  const [assignedSections, setAssignedSections] = useState<string[]>([]);
  const [assignedSubjectIds, setAssignedSubjectIds] = useState<number[]>([]);

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

  const [successModal, setSuccessModal] = useState<{ title: string; description?: string } | null>(null);

  const showSuccess = (title: string, description?: string) => setSuccessModal({ title, description });
  const needsStream = gradeLevel === "11" || gradeLevel === "12";

  // Fetch teacher's assignments
  useEffect(() => {
    if (!user) return;
    
    const fetchAssignments = async () => {
      try {
        const assignments = await api.getMyAssignments();
        setAssignedGrades(assignments.grades || []);
        setAssignedSections(assignments.sections || []);
        setAssignedSubjectIds(assignments.subjects || []);
      } catch (error: any) {
        console.error('Failed to fetch assignments:', error);
      }
    };
    
    fetchAssignments();
  }, [user]);

  // Fetch teacher's assigned subjects
  useEffect(() => {
    if (!user || !gradeLevel || assignedSubjectIds.length === 0) return;
    
    const fetchSubjects = async () => {
      try {
        const filters: any = { grade_level: parseInt(gradeLevel) };
        if (needsStream && stream) {
          filters.stream = stream;
        }
        
        const allSubjects = await api.getAllSubjects(filters);
        // Filter to only show subjects teacher is assigned to
        const filtered = allSubjects.filter((s: Subject) => assignedSubjectIds.includes(s.id));
        setSubjects(filtered || []);
        setSelectedSubject("");
      } catch (error: any) {
        console.error('Failed to fetch subjects:', error);
        setSubjects([]);
      }
    };
    
    fetchSubjects();
  }, [gradeLevel, stream, user, needsStream, assignedSubjectIds]);

  // Fetch assessment types when subject changes
  useEffect(() => {
    if (!selectedSubject || !user || !gradeLevel) {
      setAssessmentTypes([]);
      return;
    }
    fetchAssessmentTypes();
  }, [selectedSubject, user, gradeLevel]);

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
      types.forEach((t: AssessmentType) => {
        w[t.id] = String(t.weight);
        n[t.id] = t.assessment_name;
      });
      setWeights(w);
      setEditNames(n);
      
      // Auto-create fixed assessments if missing
      if (types.length === 0) {
        await ensureFixedAssessments();
      }
    } catch (error: any) {
      console.error('Failed to fetch assessment types:', error);
      setAssessmentTypes([]);
    }
  };

  // Auto-create fixed assessments
  const ensureFixedAssessments = async () => {
    if (!selectedSubject || !user || !gradeLevel) return;
    
    try {
      for (const name of FIXED_ASSESSMENTS) {
        await api.createAssessmentType({
          subject_id: parseInt(selectedSubject),
          grade_level: parseInt(gradeLevel),
          stream: stream || undefined,
          section: section || undefined,
          assessment_name: name,
          weight: name === "Mid Exam" ? 30 : 40,
        });
      }
      await fetchAssessmentTypes();
    } catch (error: any) {
      console.error('Failed to create fixed assessments:', error);
    }
  };

  // Fetch students
  useEffect(() => {
    if (!gradeLevel || !section) return;
    
    const fetchStudents = async () => {
      try {
        const filters: any = {
          grade_level: parseInt(gradeLevel),
          section: section,
        };
        if (needsStream && stream) {
          filters.stream = stream;
        }
        // Only add sub_section filter if it's not "all"
        if (subSection && subSection !== "all") {
          filters.sub_section = subSection;
        }
        
        const studentsData = await api.getStudents(filters);
        setStudents(studentsData || []);
        setScores({});
      } catch (error: any) {
        console.error('Failed to fetch students:', error);
        setStudents([]);
      }
    };
    
    fetchStudents();
  }, [gradeLevel, stream, section, subSection, needsStream]);

  // Fetch existing scores when assessment changes
  useEffect(() => {
    if (!selectedAssessment || students.length === 0) {
      setExistingScores({});
      return;
    }
    
    const fetchExisting = async () => {
      try {
        const scoresData = await api.getAssessmentScores({
          assessment_type_id: parseInt(selectedAssessment),
        });
        
        const map: Record<string, number> = {};
        const prefilled: Record<string, string> = {};
        scoresData.forEach((score: any) => {
          map[score.student_id] = Number(score.score);
          prefilled[score.student_id] = String(Number(score.score));
        });
        setExistingScores(map);
        setScores(prefilled);
      } catch (error: any) {
        console.error('Failed to fetch existing scores:', error);
      }
    };
    
    fetchExisting();
  }, [selectedAssessment, students]);

  const addCustomAssessment = async () => {
    if (!newAssessmentName.trim() || !selectedSubject || !user || !gradeLevel) return;
    
    if (FIXED_ASSESSMENTS.includes(newAssessmentName.trim())) {
      toast({ title: "Error", description: "This name is reserved for fixed assessments.", variant: "destructive" });
      return;
    }
    
    try {
      await api.createAssessmentType({
        subject_id: parseInt(selectedSubject),
        grade_level: parseInt(gradeLevel),
        stream: stream || undefined,
        section: section || undefined,
        assessment_name: newAssessmentName.trim(),
        weight: 0,
      });
      
      setNewAssessmentName("");
      await fetchAssessmentTypes();
      showSuccess("Added", `"${newAssessmentName.trim()}" assessment added.`);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const deleteAssessment = async (id: number) => {
    try {
      await api.deleteAssessmentType(id);
      await fetchAssessmentTypes();
      showSuccess("Deleted", "Assessment type removed.");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const saveWeights = async () => {
    const total = Object.values(weights).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
    if (Math.abs(total - 100) > 0.01) {
      toast({ title: "Error", description: `Weights must total 100%. Currently: ${total}%`, variant: "destructive" });
      return;
    }
    
    setSavingSetup(true);
    try {
      for (const [id, w] of Object.entries(weights)) {
        const name = editNames[id];
        const updateData: any = { weight: parseFloat(w) };
        if (name && name.trim()) {
          updateData.assessment_name = name.trim();
        }
        await api.updateAssessmentType(parseInt(id), updateData);
      }
      
      showSuccess("Saved", "Assessment setup updated.");
      await fetchAssessmentTypes();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    setSavingSetup(false);
  };

  const totalWeight = Object.values(weights).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
  const updateScore = (studentId: string, value: string) => setScores(prev => ({ ...prev, [studentId]: value }));
  
  const getMaxScore = () => {
    const at = assessmentTypes.find(a => a.id === parseInt(selectedAssessment));
    return at ? at.weight : 100;
  };

  const getCurrentAcademicYear = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    if (month >= 8) return `${year}-${year + 1}`;
    else return `${year - 1}-${year}`;
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
    
    try {
      const scoresToUpload = entries.map(([studentId, scoreVal]) => ({
        student_id: parseInt(studentId),
        assessment_type_id: parseInt(selectedAssessment),
        score: parseFloat(scoreVal),
      }));
      
      await api.bulkUploadAssessmentScores({
        scores: scoresToUpload,
        term: 'Term 1',
        academic_year: getCurrentAcademicYear(),
      });
      
      showSuccess("Success", `${entries.length} score(s) saved!`);
      
      const scoresData = await api.getAssessmentScores({
        assessment_type_id: parseInt(selectedAssessment),
      });
      
      const map: Record<string, number> = {};
      scoresData.forEach((score: any) => {
        map[score.student_id] = Number(score.score);
      });
      setExistingScores(map);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to save scores", variant: "destructive" });
    }
    
    setSubmitting(false);
  };

  const filledCount = Object.values(scores).filter(v => v.trim() !== "").length;
  const isFixedAssessment = (name: string) => FIXED_ASSESSMENTS.includes(name);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Upload className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Upload Grades</h1>
      </div>

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
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Sub-Section (Optional)</Label>
              <Select value={subSection} onValueChange={setSubSection}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="All sub-sections" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="A">A</SelectItem>
                  <SelectItem value="B">B</SelectItem>
                  <SelectItem value="C">C</SelectItem>
                  <SelectItem value="D">D</SelectItem>
                  <SelectItem value="E">E</SelectItem>
                  <SelectItem value="F">F</SelectItem>
                  <SelectItem value="G">G</SelectItem>
                  <SelectItem value="H">H</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Subject</Label>
            <Select value={selectedSubject} onValueChange={(v) => { setSelectedSubject(v); setSelectedAssessment(""); }} disabled={subjects.length === 0}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select subject" /></SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id.toString()}>{s.subject_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedSubject && (
        <div className="space-y-4">
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
                  {assessmentTypes.length >= 2 && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Quick Presets</Label>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" className="rounded-lg h-8 text-xs gap-1" onClick={() => {
                          const newW: Record<string, string> = {};
                          let midId = "", finalId = "";
                          assessmentTypes.forEach(a => {
                            if (a.assessment_name === "Mid Exam") midId = a.id.toString();
                            if (a.assessment_name === "Final Exam") finalId = a.id.toString();
                          });
                          assessmentTypes.forEach(a => {
                            if (a.id.toString() === midId) newW[a.id] = "30";
                            else if (a.id.toString() === finalId) newW[a.id] = "40";
                            else newW[a.id] = "0";
                          });
                          setWeights(newW);
                        }}>
                          <Zap className="h-3 w-3" /> Mid 30 / Final 40
                        </Button>
                        <Button variant="outline" size="sm" className="rounded-lg h-8 text-xs gap-1" onClick={() => {
                          const newW: Record<string, string> = {};
                          let midId = "", finalId = "";
                          assessmentTypes.forEach(a => {
                            if (a.assessment_name === "Mid Exam") midId = a.id.toString();
                            if (a.assessment_name === "Final Exam") finalId = a.id.toString();
                          });
                          assessmentTypes.forEach(a => {
                            if (a.id.toString() === midId) newW[a.id] = "40";
                            else if (a.id.toString() === finalId) newW[a.id] = "40";
                            else newW[a.id] = "0";
                          });
                          setWeights(newW);
                        }}>
                          <Zap className="h-3 w-3" /> Mid 40 / Final 40
                        </Button>
                      </div>
                    </div>
                  )}
                  {assessmentTypes.length > 0 && (
                    <div className="space-y-3">
                      {assessmentTypes.map(a => (
                        <div key={a.id} className="space-y-1.5">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 flex items-center gap-2 min-w-0">
                              {isFixedAssessment(a.assessment_name) ? (
                                <span className="text-sm font-medium truncate">{a.assessment_name}</span>
                              ) : (
                                <Input value={editNames[a.id] || ""} onChange={(e) => setEditNames(prev => ({ ...prev, [a.id]: e.target.value }))} className="h-8 text-sm rounded-lg font-medium" placeholder="Assessment name" />
                              )}
                              {isFixedAssessment(a.assessment_name) && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">Fixed</span>}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Input type="number" min={0} max={100} value={weights[a.id] || ""} onChange={(e) => setWeights(prev => ({ ...prev, [a.id]: e.target.value }))} className="w-20 h-8 text-sm rounded-lg text-center" placeholder="%" />
                              <span className="text-xs text-muted-foreground">%</span>
                            </div>
                            {!isFixedAssessment(a.assessment_name) && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteAssessment(a.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {isFixedAssessment(a.assessment_name) && <div className="w-8" />}
                          </div>
                          <Progress value={parseFloat(weights[a.id] || "0")} className="h-1.5" />
                        </div>
                      ))}
                    </div>
                  )}
                  <div className={cn("flex items-center gap-2 text-sm font-semibold rounded-lg px-3 py-2", Math.abs(totalWeight - 100) < 0.01 ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive")}>
                    {Math.abs(totalWeight - 100) < 0.01 ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    Total: {totalWeight}% {Math.abs(totalWeight - 100) >= 0.01 && `(need ${(100 - totalWeight).toFixed(1)}% more)`}
                  </div>
                  <div className="flex gap-2">
                    <Input value={newAssessmentName} onChange={(e) => setNewAssessmentName(e.target.value)} placeholder="e.g. Assignment, Quiz, Project..." className="rounded-lg h-9 text-sm" onKeyDown={(e) => e.key === "Enter" && addCustomAssessment()} />
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
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Enter Scores</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-semibold mb-2 block">Assessment</Label>
                <Select value={selectedAssessment} onValueChange={setSelectedAssessment} disabled={assessmentTypes.length === 0 || Math.abs(totalWeight - 100) > 0.01}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={assessmentTypes.length === 0 ? "Set up assessments first ↑" : Math.abs(totalWeight - 100) > 0.01 ? "Save weights first (must total 100%)" : "Select assessment"} />
                  </SelectTrigger>
                  <SelectContent>
                    {assessmentTypes.map(a => (
                      <SelectItem key={a.id} value={a.id.toString()}>{a.assessment_name} ({a.weight}%)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
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
                        <TableHead>Username</TableHead>
                        <TableHead className="w-28">Score</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map((s, i) => (
                        <TableRow key={s.user_id} className="hover:bg-muted/30">
                          <TableCell className="text-muted-foreground text-sm">{i + 1}</TableCell>
                          <TableCell className="font-medium">{s.full_name}</TableCell>
                          <TableCell className="font-mono text-sm text-muted-foreground">{s.username}</TableCell>
                          <TableCell>
                            <Input type="number" min={0} max={getMaxScore()} value={scores[s.user_id] || ""} onChange={(e) => updateScore(s.user_id.toString(), e.target.value)} placeholder={`0-${getMaxScore()}`} className="rounded-lg h-8 text-sm w-24" />
                          </TableCell>
                          <TableCell>
                            {existingScores[s.user_id] !== undefined && <CheckCircle2 className="h-4 w-4 text-primary" />}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="p-4 border-t">
                  <Button onClick={handleBulkSubmit} disabled={submitting || filledCount === 0} className="w-full rounded-xl gradient-primary border-0 text-white h-11 font-semibold">
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
                No students found for the selected grade and section.
              </CardContent>
            </Card>
          )}
        </div>
      )}
      <SuccessModal open={!!successModal} onClose={() => setSuccessModal(null)} title={successModal?.title || ""} description={successModal?.description} />
    </div>
  );
}
