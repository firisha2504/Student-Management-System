import { useEffect, useState } from "react";
// Supabase removed - replace with your backend API
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Trophy, Eye, EyeOff } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AcademicHistory from "@/components/AcademicHistory";

interface ChildProfile {
  user_id: string;
  full_name: string;
  grade_level: number | null;
  stream: string | null;
  section: string | null;
  profile_image: string | null;
  id_number: string;
}

interface AssessmentScore {
  assessment_name: string;
  weight: number;
  score: number;
}

interface SubjectBreakdown {
  subject_name: string;
  subject_id: string;
  grade_level: number;
  stream: string | null;
  teacher_name: string;
  assessments: AssessmentScore[];
  totalScore: number;
  hasScores: boolean;
  hasAssessments: boolean;
}

export default function ParentPortal() {
  const { user, role } = useAuth();
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [selectedChild, setSelectedChild] = useState<ChildProfile | null>(null);
  const [breakdowns, setBreakdowns] = useState<SubjectBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingGrades, setLoadingGrades] = useState(false);
  const [openSubjects, setOpenSubjects] = useState<Set<string>>(new Set());
  const [ranking, setRanking] = useState<{ rank: number; total: number; average: number } | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchChildren = async () => {
      const { data: links } = await supabase.from("parent_students" as any).select("student_id").eq("parent_id", user.id);
      const studentIds = (links as any[] || []).map((l: any) => l.student_id);
      if (studentIds.length === 0) { setLoading(false); return; }
      const { data: profiles } = await supabase.from("profiles").select("*").in("user_id", studentIds);
      const kids = (profiles || []).map(p => ({
        user_id: p.user_id, full_name: p.full_name, grade_level: p.grade_level,
        stream: p.stream, section: p.section, profile_image: p.profile_image, id_number: p.id_number,
      }));
      setChildren(kids);
      if (kids.length === 1) setSelectedChild(kids[0]);
      setLoading(false);
    };
    fetchChildren();
  }, [user]);

  useEffect(() => {
    if (!selectedChild) return;
    fetchChildGrades(selectedChild);
  }, [selectedChild]);

  const fetchChildGrades = async (child: ChildProfile) => {
    setLoadingGrades(true);
    if (!child.grade_level) { setBreakdowns([]); setLoadingGrades(false); return; }

    let query = supabase.from("subjects").select("*").eq("grade_level", child.grade_level);
    if (child.grade_level >= 11 && child.stream) query = query.eq("stream", child.stream as "natural" | "social");
    else query = query.is("stream", null);
    const { data: subjects } = await query;
    const subs = subjects || [];

    if (subs.length === 0) { setBreakdowns([]); setLoadingGrades(false); return; }

    const { data: atData } = await supabase.from("assessment_types").select("id, assessment_name, weight, subject_id, teacher_id").in("subject_id", subs.map(s => s.id));
    const assessmentTypes = (atData || []) as any[];

    // Fetch teacher names
    const teacherIds = [...new Set(assessmentTypes.map((a: any) => a.teacher_id))] as string[];
    const tMap: Record<string, string> = {};
    if (teacherIds.length > 0) {
      const { data: teacherProfiles } = await supabase.rpc("get_teacher_names", { teacher_ids: teacherIds });
      (teacherProfiles || []).forEach((p: any) => { tMap[p.user_id] = p.full_name; });
    }

    const { data: scoreData } = await supabase.from("assessment_scores").select("assessment_type_id, score").eq("student_id", child.user_id);
    const scoreMap: Record<string, number> = {};
    (scoreData || []).forEach((s: any) => { scoreMap[s.assessment_type_id] = Number(s.score); });

    const bds: SubjectBreakdown[] = subs.map(sub => {
      const subAssessments = assessmentTypes.filter((a: any) => a.subject_id === sub.id);
      const assessments = subAssessments.map((a: any) => ({
        assessment_name: a.assessment_name, weight: Number(a.weight), score: scoreMap[a.id] ?? -1,
      }));
      const scored = assessments.filter(a => a.score >= 0);
      const totalScore = scored.reduce((sum, a) => sum + a.score, 0);
      // Get teacher from first assessment type
      const teacherName = subAssessments.length > 0 && tMap[subAssessments[0].teacher_id] ? tMap[subAssessments[0].teacher_id] : "—";
      return {
        subject_name: sub.subject_name, subject_id: sub.id, grade_level: sub.grade_level,
        stream: sub.stream, teacher_name: teacherName, assessments, totalScore,
        hasScores: scored.length > 0, hasAssessments: subAssessments.length > 0,
      };
    });
    setBreakdowns(bds);

    // Fetch ranking
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const params = new URLSearchParams({ grade_level: child.grade_level.toString() });
      if (child.stream) params.set("stream", child.stream);
      if (child.section) params.set("section", child.section);
      const { data } = await supabase.functions.invoke(`student-rankings?${params.toString()}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const childRank = (data?.rankings || []).find((r: any) => r.user_id === child.user_id);
      if (childRank) setRanking({ rank: childRank.rank, total: data.rankings.length, average: childRank.average });
      else setRanking(null);
    } catch { setRanking(null); }

    setLoadingGrades(false);
  };

  const toggleSubject = (id: string) => {
    setOpenSubjects(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  if (role !== "parent") return <p className="text-destructive">Access denied.</p>;

  const gradedCount = breakdowns.filter(b => b.hasScores).length;
  const progressPercent = breakdowns.length > 0 ? Math.round((gradedCount / breakdowns.length) * 100) : 0;
  const initials = selectedChild?.full_name?.split(" ").map(n => n[0]).join("").toUpperCase() || "?";

  // Group by teacher
  const teacherGroups: Record<string, SubjectBreakdown[]> = {};
  breakdowns.forEach(bd => {
    const teacher = bd.teacher_name;
    if (!teacherGroups[teacher]) teacherGroups[teacher] = [];
    teacherGroups[teacher].push(bd);
  });
  const teacherEntries = Object.entries(teacherGroups);

  return (
    <div className="space-y-6">
      <div className="gradient-hero rounded-2xl p-8 text-white relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-2xl font-extrabold">Parent Portal</h1>
          <p className="text-white/70 mt-1">View your child's academic progress</p>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-center py-8">Loading...</p>
      ) : children.length === 0 ? (
        <Card className="border-0 shadow-md">
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">No student accounts linked to your profile yet. Please contact the school registrar.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {children.length > 1 && (
            <div className="flex gap-3 flex-wrap">
              {children.map(child => (
                <button
                  key={child.user_id}
                  onClick={() => setSelectedChild(child)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-all ${
                    selectedChild?.user_id === child.user_id
                      ? "border-primary bg-primary/10 text-primary font-semibold"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={child.profile_image || undefined} />
                    <AvatarFallback className="text-[10px] gradient-primary text-white">{child.full_name?.split(" ").map(n => n[0]).join("").toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{child.full_name}</span>
                </button>
              ))}
            </div>
          )}

          {selectedChild && (
            <>
              {/* Child Profile Card */}
              <Card className="border-0 shadow-md">
                <CardContent className="pt-6 pb-5 flex items-center gap-4">
                  <Avatar className="h-14 w-14">
                    <AvatarImage src={selectedChild.profile_image || undefined} />
                    <AvatarFallback className="gradient-primary text-white font-bold text-lg">{initials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-lg font-extrabold text-foreground">{selectedChild.full_name}</h2>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {selectedChild.grade_level && <span>Grade {selectedChild.grade_level}</span>}
                      {selectedChild.stream && <><span>·</span><span className="capitalize">{selectedChild.stream}</span></>}
                      {selectedChild.section && <><span>·</span><span className="capitalize">{selectedChild.section}</span></>}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Rank Card */}
              {ranking && (
                <Card className="border-0 shadow-md overflow-hidden">
                  <div className="gradient-accent p-5 text-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-white/10 rounded-xl p-2.5"><Trophy className="h-6 w-6" /></div>
                        <div>
                          <p className="text-sm text-white/70">Rank</p>
                          <p className="text-2xl font-extrabold">{ranking.rank}<span className="text-sm font-normal text-white/70">/{ranking.total}</span></p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-white/70">Average</p>
                        <p className="text-2xl font-extrabold">{ranking.average}%</p>
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {/* Progress */}
              <Card className="border-0 shadow-md overflow-hidden">
                <div className="gradient-hero p-6 text-white">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-white/10 rounded-xl p-2"><BookOpen className="h-5 w-5" /></div>
                    <h3 className="font-bold">Subject Progress</h3>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <Progress value={progressPercent} className="h-2.5 bg-white/15 [&>div]:gradient-accent" />
                    </div>
                    <span className="text-sm font-bold">{gradedCount}/{breakdowns.length} graded</span>
                  </div>
                </div>
              </Card>

              {/* Subjects Table — same as Student Portal */}
              <Card className="border-0 shadow-md overflow-hidden">
                <CardContent className="p-0">
                  {loadingGrades ? (
                    <p className="text-muted-foreground p-6">Loading grades...</p>
                  ) : breakdowns.length === 0 ? (
                    <p className="text-muted-foreground text-center py-10">No subjects assigned yet</p>
                  ) : (
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
                          bds.map((bd, idx) => (
                            <Collapsible key={bd.subject_id} asChild open={openSubjects.has(bd.subject_id)} onOpenChange={() => toggleSubject(bd.subject_id)}>
                              <>
                                <TableRow className="hover:bg-muted/50">
                                  {idx === 0 ? (
                                    <TableCell className="text-sm font-semibold align-top border-r border-border/50" rowSpan={bds.length}>
                                      {teacher}
                                    </TableCell>
                                  ) : null}
                                  <TableCell className="text-sm">{bd.subject_name}</TableCell>
                                  <TableCell className="text-sm">Grade {bd.grade_level}</TableCell>
                                  <TableCell className="text-sm">{bd.stream ? bd.stream.charAt(0).toUpperCase() + bd.stream.slice(1) : "—"}</TableCell>
                                  <TableCell className="text-center">
                                    {bd.hasAssessments ? (
                                      <CollapsibleTrigger asChild>
                                        <button className="inline-flex items-center justify-center rounded-lg p-1.5 hover:bg-muted transition-colors" title="View assessments">
                                          {openSubjects.has(bd.subject_id) ? (
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
                                      {bd.assessments.length > 0 && (
                                        <div className="mx-4 my-3 rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm overflow-hidden shadow-sm">
                                          <div className="grid grid-cols-3 gap-0 text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2.5 bg-muted/40 border-b border-border/40">
                                            <span>Assessment</span>
                                            <span className="text-center">Weight</span>
                                            <span className="text-right">Score</span>
                                          </div>
                                          <div className="divide-y divide-border/30">
                                            {bd.assessments.map((a, i) => (
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
                                            const scored = bd.assessments.filter(a => a.score >= 0);
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
                          ))
                        )}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Academic History */}
              <AcademicHistory studentId={selectedChild.user_id} studentName={selectedChild.full_name} />
            </>
          )}
        </>
      )}
    </div>
  );
}
