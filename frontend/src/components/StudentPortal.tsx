import React, { useEffect, useState } from "react";
import { api } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ListChecks, Eye, EyeOff, ChevronRight, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import StudentRanking from "@/components/StudentRanking";
import AcademicHistory from "@/components/AcademicHistory";

interface Subject {
  id: number;
  subject_name: string;
  subject_code: string;
  grade_level: number;
  stream: string | null;
  credit_hours: number;
  ects: number;
}

interface AssessmentScore {
  id: number;
  assessment_type_id: number;
  score: number;
  assessment_name: string;
  weight: number;
}

interface SubjectBreakdown {
  subject: Subject;
  teacher_name: string;
  assessments: {
    assessment_name: string;
    weight: number;
    score: number;
  }[];
  totalScore: number;
  hasScores: boolean;
  hasAssessments: boolean;
}

export default function StudentPortal() {
  const { user, profile, loading: authLoading } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [breakdowns, setBreakdowns] = useState<SubjectBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [openSubjects, setOpenSubjects] = useState<Set<number>>(new Set());
  const [collapsedTeachers, setCollapsedTeachers] = useState<Set<string>>(new Set());
  const [rankingsApproved, setRankingsApproved] = useState(false);

  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) return;
    // Auth done but no user (shouldn't happen on protected route)
    if (!user) { setLoading(false); return; }
    // Profile loaded but no grade_level — stop loading, show message
    if (profile !== null && !profile?.grade_level) {
      setLoading(false);
      return;
    }
    // Profile still null (loading from server) — keep waiting
    if (profile === null) return;

    const fetchData = async () => {
      try {
        setLoading(true);

        const gradeLevel = profile.grade_level!;

        const filters: any = { grade_level: gradeLevel };
        if (gradeLevel >= 11 && profile.stream) {
          filters.stream = profile.stream;
        }

        const subjectsData = await api.getAllSubjects(filters);
        setSubjects(subjectsData);

        if (subjectsData.length === 0) {
          setLoading(false);
          return;
        }

        // Fetch assessment scores for the student
        const scoresData = await api.getAssessmentScores({
          student_id: Number(user.id),
        });

        // Group scores by assessment_type_id
        const scoreMap: Record<number, number> = {};
        scoresData.forEach((score: AssessmentScore) => {
          scoreMap[score.assessment_type_id] = Number(score.score);
        });

        // For each subject, fetch assessment types and build breakdown
        const breakdownPromises = subjectsData.map(async (subject: Subject) => {
          try {
            const assessmentTypes = await api.getAssessmentTypes({
              subject_id: subject.id,
              grade_level: subject.grade_level,
              stream: subject.stream || undefined,
            });

            // Get teacher name from first assessment type
            const teacher_name = assessmentTypes.length > 0 && assessmentTypes[0].teacher_name
              ? assessmentTypes[0].teacher_name
              : "—";

            const assessments = assessmentTypes.map((at: any) => ({
              assessment_name: at.assessment_name,
              weight: Number(at.weight),
              score: scoreMap[at.id] !== undefined ? Number(scoreMap[at.id]) : -1,
            }));

            const scored = assessments.filter((a: any) => a.score >= 0);
            const totalScore = scored.reduce((sum: number, a: any) => sum + a.score, 0);

            return {
              subject,
              teacher_name,
              assessments,
              totalScore,
              hasScores: scored.length > 0,
              hasAssessments: assessments.length > 0,
            };
          } catch (error) {
            console.error(`Error fetching assessments for subject ${subject.id}:`, error);
            return {
              subject,
              teacher_name: "—",
              assessments: [],
              totalScore: 0,
              hasScores: false,
              hasAssessments: false,
            };
          }
        });

        const breakdownsData = await Promise.all(breakdownPromises);
        setBreakdowns(breakdownsData);

        // Check if rankings are approved for this student's grade
        try {
          const approvalStatus = await api.getRankingApprovalStatus({
            grade_level: gradeLevel,
            stream: profile.stream || undefined,
          });
          setRankingsApproved(approvalStatus.approved);
        } catch {
          setRankingsApproved(false);
        }
      } catch (error) {
        console.error("Error fetching student portal data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, profile, authLoading]);

  const gradedCount = breakdowns.filter(b => b.hasScores).length;
  const progressPercent = subjects.length > 0 ? Math.round((gradedCount / subjects.length) * 100) : 0;

  const overallTotal = breakdowns.reduce((sum, b) => {
    const scored = b.assessments.filter(a => a.score >= 0);
    return sum + scored.reduce((s, a) => s + Number(a.score), 0);
  }, 0);
  const subjectsWithScores = breakdowns.filter(b => b.assessments.some(a => a.score >= 0));
  const overallAverage = subjectsWithScores.length > 0
    ? (overallTotal / subjectsWithScores.length).toFixed(1)
    : null;

  const toggleSubject = (id: number) => {
    setOpenSubjects(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleTeacher = (teacher: string) => {
    setCollapsedTeachers(prev => {
      const next = new Set(prev);
      if (next.has(teacher)) next.delete(teacher);
      else next.add(teacher);
      return next;
    });
  };

  // Group breakdowns by teacher
  const teacherGroups: Record<string, SubjectBreakdown[]> = {};
  breakdowns.forEach(bd => {
    const teacher = bd.teacher_name || "—";
    if (!teacherGroups[teacher]) teacherGroups[teacher] = [];
    teacherGroups[teacher].push(bd);
  });
  const teacherEntries = Object.entries(teacherGroups);

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
          {rankingsApproved && overallAverage !== null && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-white/70 text-sm">Overall Average:</span>
              <span
                className={`text-base font-extrabold ${
                  parseFloat(overallAverage) >= 50
                    ? "text-emerald-300"
                    : "text-red-300"
                }`}
              >
                {overallAverage} / 100
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* Courses Table - Grouped by Teacher */}
      <Card className="border-0 shadow-md overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <p className="text-muted-foreground p-6">Loading...</p>
          ) : subjects.length === 0 ? (
            <p className="text-muted-foreground text-center py-10">
              {!profile?.grade_level
                ? "Please update your profile with your grade level to see your subjects."
                : "No subjects have been assigned to your grade yet. Please check back later."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold w-[40px]"></TableHead>
                  <TableHead className="font-semibold">Teacher</TableHead>
                  <TableHead className="font-semibold">Subject</TableHead>
                  <TableHead className="font-semibold">Grade Level</TableHead>
                  {(profile?.grade_level ?? 0) >= 11 && (
                    <TableHead className="font-semibold">Stream</TableHead>
                  )}
                  <TableHead className="font-semibold text-center w-[80px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teacherEntries.map(([teacher, bds]) => {
                  const isTeacherCollapsed = collapsedTeachers.has(teacher);
                  return (
                    <React.Fragment key={teacher}>
                      {bds.map((bd, idx) => {
                        const s = bd.subject;
                        const hasAssessments = bd.assessments.length > 0;
                        
                        // Only show first row when collapsed
                        if (isTeacherCollapsed && idx > 0) return null;
                        
                        return (
                          <Collapsible
                            key={s.id}
                            asChild
                            open={openSubjects.has(s.id)}
                            onOpenChange={() => toggleSubject(s.id)}
                          >
                            <>
                              <TableRow className="hover:bg-muted/50">
                                {idx === 0 ? (
                                  <TableCell
                                    className="text-center align-top border-r border-border/50 cursor-pointer hover:bg-muted/70 transition-colors"
                                    rowSpan={isTeacherCollapsed ? 1 : bds.length}
                                    onClick={() => toggleTeacher(teacher)}
                                  >
                                    <button
                                      className="inline-flex items-center justify-center rounded-lg p-1.5 hover:bg-muted transition-colors"
                                      title={isTeacherCollapsed ? "Expand teacher group" : "Collapse teacher group"}
                                    >
                                      {isTeacherCollapsed ? (
                                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                      ) : (
                                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                      )}
                                    </button>
                                  </TableCell>
                                ) : null}
                                {idx === 0 ? (
                                  <TableCell
                                    className="text-sm font-semibold align-top border-r border-border/50"
                                    rowSpan={isTeacherCollapsed ? 1 : bds.length}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span>{teacher}</span>
                                      {isTeacherCollapsed && bds.length > 1 && (
                                        <Badge variant="secondary" className="text-xs">
                                          {bds.length} subjects
                                        </Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                ) : null}
                                <TableCell className="text-sm">{s.subject_name}</TableCell>
                                <TableCell className="text-sm">Grade {s.grade_level}</TableCell>
                                {(profile?.grade_level ?? 0) >= 11 && (
                                  <TableCell className="text-sm">
                                    {s.stream ? s.stream.charAt(0).toUpperCase() + s.stream.slice(1) : "—"}
                                  </TableCell>
                                )}
                                <TableCell className="text-center">
                                  {hasAssessments ? (
                                    <CollapsibleTrigger asChild>
                                      <button
                                        className="inline-flex items-center justify-center rounded-lg p-1.5 hover:bg-muted transition-colors"
                                        title="View assessments"
                                      >
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
                                  <td colSpan={(profile?.grade_level ?? 0) >= 11 ? 6 : 5} className="p-0">
                                    {bd.assessments.length > 0 && (
                                      <div className="mx-4 my-3 rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm overflow-hidden shadow-sm">
                                        <div className="grid grid-cols-3 gap-0 text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2.5 bg-muted/40 border-b border-border/40">
                                          <span>Assessment</span>
                                          <span className="text-center">Weight</span>
                                          <span className="text-right">Score</span>
                                        </div>
                                        <div className="divide-y divide-border/30">
                                          {bd.assessments.map((a, i) => (
                                            <div
                                              key={i}
                                              className="grid grid-cols-3 gap-0 items-center px-4 py-2.5 hover:bg-muted/20 transition-colors"
                                            >
                                              <span className="text-sm font-medium text-foreground">
                                                {a.assessment_name}
                                              </span>
                                              <span className="text-sm text-center text-muted-foreground">
                                                {a.weight}%
                                              </span>
                                              <div className="text-right">
                                                {a.score >= 0 ? (
                                                  <Badge
                                                    variant="outline"
                                                    className={`text-xs font-bold ${
                                                      a.score >= a.weight * 0.5
                                                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-400"
                                                        : "bg-destructive/10 text-destructive border-destructive/30"
                                                    }`}
                                                  >
                                                    {a.score}/{a.weight}
                                                  </Badge>
                                                ) : (
                                                  <Badge
                                                    variant="outline"
                                                    className="text-xs text-muted-foreground border-border/50"
                                                  >
                                                    Pending
                                                  </Badge>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                        {(() => {
                                          const scored = bd.assessments.filter(a => a.score >= 0);
                                          if (scored.length === 0) return null;
                                          const total = scored.reduce((sum, a) => sum + Number(a.score), 0);
                                          return (
                                            <div className="grid grid-cols-3 gap-0 items-center px-4 py-3 bg-muted/30 border-t border-border/50">
                                              <span className="text-sm font-bold text-foreground">Total</span>
                                              <span />
                                              <div className="text-right">
                                                <span
                                                  className={`text-sm font-extrabold ${
                                                    total >= 50
                                                      ? "text-emerald-600 dark:text-emerald-400"
                                                      : "text-destructive"
                                                  }`}
                                                >
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
                      })}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Student Rankings */}
      <StudentRanking />

      {/* Academic History — only visible after rankings are published */}
      {user && rankingsApproved && <AcademicHistory studentId={user.id} />}
    </div>
  );
}
