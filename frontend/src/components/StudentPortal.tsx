import { useEffect, useState } from "react";
// Supabase removed - replace with your backend API
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ListChecks, Eye, EyeOff } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import StudentRanking from "@/components/StudentRanking";
import AcademicHistory from "@/components/AcademicHistory";

interface Subject {
  id: string;
  subject_name: string;
  grade_level: number;
  stream: string | null;
}

interface AssessmentScore {
  assessment_name: string;
  weight: number;
  score: number;
}

interface SubjectTeacher {
  subject_id: string;
  teacher_name: string;
}

interface SubjectBreakdown {
  subject: Subject;
  assessments: AssessmentScore[];
  totalScore: number;
  hasScores: boolean;
  hasAssessments: boolean;
}

export default function StudentPortal() {
  const { user, profile } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [breakdowns, setBreakdowns] = useState<Record<string, AssessmentScore[]>>({});
  const [teacherMap, setTeacherMap] = useState<Record<string, string>>({});
  
  const [assessmentCountMap, setAssessmentCountMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [openSubjects, setOpenSubjects] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user || !profile) return;
    const fetchData = async () => {
      // Fetch subjects for student's grade
      if (profile.grade_level) {
        let query = supabase.from("subjects").select("*").eq("grade_level", profile.grade_level);
        if (profile.grade_level >= 11 && profile.stream) {
          query = query.eq("stream", profile.stream);
        } else {
          query = query.is("stream", null);
        }
        const { data: subjectData } = await query;
        const subs = subjectData || [];
        setSubjects(subs);

        // Fetch assessment scores for each subject
        if (subs.length > 0) {
          // Get all assessment types for these subjects
          const { data: atData } = await supabase
            .from("assessment_types")
            .select("id, assessment_name, weight, subject_id, teacher_id")
            .in("subject_id", subs.map(s => s.id));

          const assessmentTypes = (atData || []) as any[];

          // Get unique teacher IDs to fetch names
          const teacherIds = [...new Set(assessmentTypes.map((a: any) => a.teacher_id))] as string[];
          const tMap: Record<string, string> = {};
          if (teacherIds.length > 0) {
            const { data: teacherProfiles } = await supabase
              .rpc("get_teacher_names", { teacher_ids: teacherIds });
            (teacherProfiles || []).forEach((p: any) => { tMap[p.user_id] = p.full_name; });
          }

          // Map subject_id -> teacher_name (from first assessment type found)
          const subjectTeacherMap: Record<string, string> = {};
          assessmentTypes.forEach((a: any) => {
            if (!subjectTeacherMap[a.subject_id] && tMap[a.teacher_id]) {
              subjectTeacherMap[a.subject_id] = tMap[a.teacher_id];
            }
          });
          setTeacherMap(subjectTeacherMap);

          // Track assessment counts per subject
          const acMap: Record<string, number> = {};
          subs.forEach(sub => {
            acMap[sub.id] = assessmentTypes.filter((a: any) => a.subject_id === sub.id).length;
          });
          setAssessmentCountMap(acMap);

          if (assessmentTypes.length > 0) {
            // Fetch published scores (visible to student via RLS)
            const { data: scoreData } = await supabase
              .from("assessment_scores")
              .select("assessment_type_id, score")
              .eq("student_id", user.id);

            const scoreMap: Record<string, number> = {};
            (scoreData || []).forEach((s: any) => { scoreMap[s.assessment_type_id] = Number(s.score); });


            const bd: Record<string, AssessmentScore[]> = {};
            subs.forEach(sub => {
              const subAssessments = assessmentTypes.filter((a: any) => a.subject_id === sub.id);
              bd[sub.id] = subAssessments.map((a: any) => ({
                assessment_name: a.assessment_name,
                weight: Number(a.weight),
                score: scoreMap[a.id] ?? -1,
              }));
            });
            setBreakdowns(bd);
          }
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [user, profile]);

  const getSubjectBreakdowns = (): SubjectBreakdown[] => {
    return subjects.map(sub => {
      const assessments = breakdowns[sub.id] || [];
      const scored = assessments.filter(a => a.score >= 0);
      const totalScore = scored.reduce((sum, a) => sum + a.score, 0);
      return {
        subject: sub,
        assessments,
        totalScore,
        hasScores: scored.length > 0,
        hasAssessments: (assessmentCountMap[sub.id] || 0) > 0,
      };
    });
  };

  const subjectBreakdowns = getSubjectBreakdowns();
  const gradedCount = subjectBreakdowns.filter(s => s.hasScores).length;
  const progressPercent = subjects.length > 0 ? Math.round((gradedCount / subjects.length) * 100) : 0;

  const toggleSubject = (id: string) => {
    setOpenSubjects(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-8">
        {/* Progress Overview */}
        <Card className="border-0 shadow-md overflow-hidden">
          <div className="gradient-hero p-6 sm:p-8 text-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-white/10 rounded-xl p-2">
                <ListChecks className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold">My Courses</h1>
                <p className="text-white/60 text-sm">
                  {profile?.grade_level ? `Grade ${profile.grade_level}` : "—"}
                  {profile?.stream ? ` · ${profile.stream.charAt(0).toUpperCase() + profile.stream.slice(1)}` : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Progress value={progressPercent} className="h-2.5 bg-white/15 [&>div]:gradient-accent" />
              </div>
              <span className="text-sm font-bold">{gradedCount}/{subjects.length} graded</span>
            </div>
          </div>
        </Card>

        {/* Courses Table - Grouped by Teacher */}
        <Card className="border-0 shadow-md overflow-hidden">
          <CardContent className="p-0">
            {loading ? (
              <p className="text-muted-foreground p-6">Loading...</p>
            ) : subjects.length === 0 ? (
              <p className="text-muted-foreground text-center py-10">No subjects assigned to your grade yet. Please update your profile first.</p>
            ) : (
              (() => {
                // Group subjects by teacher
                const teacherGroups: Record<string, SubjectBreakdown[]> = {};
                subjectBreakdowns.forEach(bd => {
                  const teacher = teacherMap[bd.subject.id] || "—";
                  if (!teacherGroups[teacher]) teacherGroups[teacher] = [];
                  teacherGroups[teacher].push(bd);
                });
                const teacherEntries = Object.entries(teacherGroups);

                return (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-semibold">Teacher</TableHead>
                        <TableHead className="font-semibold">Subject</TableHead>
                        <TableHead className="font-semibold">Grade</TableHead>
                        <TableHead className="font-semibold">Stream</TableHead>
                        <TableHead className="font-semibold text-center w-[80px]">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teacherEntries.map(([teacher, bds]) =>
                        bds.map((bd, idx) => {
                          const s = bd.subject;
                          const hasAssessments = (breakdowns[s.id] || []).length > 0;
                          return (
                            <Collapsible key={s.id} asChild open={openSubjects.has(s.id)} onOpenChange={() => toggleSubject(s.id)}>
                              <>
                                <TableRow className="hover:bg-muted/50">
                                  {idx === 0 ? (
                                    <TableCell className="text-sm font-semibold align-top border-r border-border/50" rowSpan={bds.length}>
                                      {teacher}
                                    </TableCell>
                                  ) : null}
                                  <TableCell className="text-sm">{s.subject_name}</TableCell>
                                  <TableCell className="text-sm">Grade {s.grade_level}</TableCell>
                                  <TableCell className="text-sm">{s.stream ? s.stream.charAt(0).toUpperCase() + s.stream.slice(1) : "—"}</TableCell>
                                  <TableCell className="text-center">
                                    {hasAssessments ? (
                                      <CollapsibleTrigger asChild>
                                        <button className="inline-flex items-center justify-center rounded-lg p-1.5 hover:bg-muted transition-colors" title="View assessments">
                                          {openSubjects.has(s.id) ? (
                                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                                          ) : (
                                            <Eye className="h-4 w-4 text-primary" />
                                          )}
                                        </button>
                                      </CollapsibleTrigger>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">—</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                                <CollapsibleContent asChild>
                                  <tr>
                                    <td colSpan={5} className="p-0">
                                      {(breakdowns[s.id] || []).length > 0 && (
                                        <div className="mx-4 my-3 rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm overflow-hidden shadow-sm">
                                          <div className="grid grid-cols-3 gap-0 text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2.5 bg-muted/40 border-b border-border/40">
                                            <span>Assessment</span>
                                            <span className="text-center">Weight</span>
                                            <span className="text-right">Score</span>
                                          </div>
                                          <div className="divide-y divide-border/30">
                                            {(breakdowns[s.id] || []).map((a, i) => (
                                              <div key={i} className="grid grid-cols-3 gap-0 items-center px-4 py-2.5 hover:bg-muted/20 transition-colors">
                                                <span className="text-sm font-medium text-foreground">{a.assessment_name}</span>
                                                <span className="text-sm text-center text-muted-foreground">{a.weight}%</span>
                                                <div className="text-right">
                                                  {a.score >= 0 ? (
                                                    <Badge variant="outline" className={`text-xs font-bold ${
                                                      a.score >= a.weight * 0.5
                                                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-400"
                                                        : "bg-destructive/10 text-destructive border-destructive/30"
                                                    }`}>
                                                      {a.score}/{a.weight}
                                                    </Badge>
                                                  ) : (
                                                    <Badge variant="outline" className="text-xs text-muted-foreground border-border/50">Pending</Badge>
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                          {(() => {
                                            const scored = (breakdowns[s.id] || []).filter(a => a.score >= 0);
                                            if (scored.length === 0) return null;
                                            const total = scored.reduce((sum, a) => sum + a.score, 0);
                                            return (
                                              <div className="grid grid-cols-3 gap-0 items-center px-4 py-3 bg-muted/30 border-t border-border/50">
                                                <span className="text-sm font-bold text-foreground">Total</span>
                                                <span />
                                                <div className="text-right">
                                                  <span className={`text-sm font-extrabold ${total >= 50 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                                                    {total.toFixed(1)}/100
                                                  </span>
                                                </div>
                                              </div>
                                            );
                                          })()}
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                </CollapsibleContent>
                              </>
                            </Collapsible>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                );
              })()
            )}
          </CardContent>
        </Card>

        {/* Student Rankings */}
        <StudentRanking />

        {/* Academic History */}
        {user && <AcademicHistory studentId={user.id} />}
    </div>
  );
}
