import { useEffect, useState } from "react";
import { api } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Trophy, Eye, EyeOff } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import AcademicHistory from "@/components/AcademicHistory";

interface ChildProfile {
  user_id: string;
  full_name: string;
  grade_level: number | null;
  stream: string | null;
  section: string | null;
  sub_section: string | null;
  profile_image: string | null;
  id_number: string;
}

interface AssessmentScore {
  assessment_name: string;
  weight: number;
  score: number | null;
}

interface SubjectBreakdown {
  subject_name: string;
  subject_id: string;
  credit_hours: number;
  teacher_name: string;
  assessments: AssessmentScore[];
  totalScore: number;
  hasScores: boolean;
  hasAssessments: boolean;
}

export default function ParentPortal() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [selectedChild, setSelectedChild] = useState<ChildProfile | null>(null);
  const [breakdowns, setBreakdowns] = useState<SubjectBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingGrades, setLoadingGrades] = useState(false);
  const [openSubjects, setOpenSubjects] = useState<Set<string>>(new Set());
  const [ranking, setRanking] = useState<{ rank: number; total: number; average: number; approved: boolean } | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchChildren();
  }, [user]);

  useEffect(() => {
    if (!selectedChild) return;
    fetchChildGrades(selectedChild);
    fetchChildRanking(selectedChild);
  }, [selectedChild]);

  const fetchChildren = async () => {
    setLoading(true);
    try {
      const data = await api.getMyChildren();
      setChildren(data || []);
      if (data && data.length === 1) {
        setSelectedChild(data[0]);
      }
    } catch (error: any) {
      console.error('Failed to fetch children:', error);
      toast({ title: "Error", description: "Failed to load children", variant: "destructive" });
    }
    setLoading(false);
  };

  const fetchChildGrades = async (child: ChildProfile) => {
    setLoadingGrades(true);
    try {
      if (!child.grade_level) {
        setBreakdowns([]);
        setLoadingGrades(false);
        return;
      }

      const data = await api.getChildGrades(child.user_id);
      setBreakdowns(data.breakdowns || []);
    } catch (error: any) {
      console.error('Failed to fetch grades:', error);
      toast({ title: "Error", description: "Failed to load grades", variant: "destructive" });
      setBreakdowns([]);
    }
    setLoadingGrades(false);
  };

  const fetchChildRanking = async (child: ChildProfile) => {
    try {
      const data = await api.getChildRanking(child.user_id);
      setRanking(data);
    } catch (error: any) {
      console.error('Failed to fetch ranking:', error);
      setRanking(null);
    }
  };

  const toggleSubject = (subjectId: string) => {
    setOpenSubjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(subjectId)) {
        newSet.delete(subjectId);
      } else {
        newSet.add(subjectId);
      }
      return newSet;
    });
  };

  const getLetterGrade = (score: number) => {
    if (score >= 90) return "A";
    if (score >= 80) return "B";
    if (score >= 70) return "C";
    if (score >= 60) return "D";
    if (score >= 50) return "E";
    return "F";
  };

  const getGradeColor = (score: number) => {
    if (score >= 80) return "text-emerald-600";
    if (score >= 60) return "text-blue-600";
    if (score >= 50) return "text-amber-600";
    return "text-red-600";
  };

  if (role !== "parent") {
    return <p className="text-destructive">Access denied. Parent role required.</p>;
  }

  if (loading) {
    return <p className="text-center text-muted-foreground py-8">Loading...</p>;
  }

  if (children.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="py-12 text-center">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-semibold text-foreground mb-2">No Children Linked</p>
          <p className="text-sm text-muted-foreground">
            Please contact the school registrar to link your children to your account.
          </p>
        </CardContent>
      </Card>
    );
  }

  const overallAverage = breakdowns.length > 0
    ? Math.round((breakdowns.reduce((sum, b) => sum + b.totalScore, 0) / breakdowns.length) * 100) / 100
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Parent Portal</h2>
        <p className="text-sm text-muted-foreground">View your children's academic progress</p>
      </div>

      {/* Children Selector */}
      {children.length > 1 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <p className="text-sm font-semibold mb-3">Select Child:</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {children.map(child => (
                <button
                  key={child.user_id}
                  onClick={() => setSelectedChild(child)}
                  className={`p-3 rounded-xl border-2 transition-all text-left ${
                    selectedChild?.user_id === child.user_id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={child.profile_image || undefined} />
                      <AvatarFallback>{child.full_name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{child.full_name}</p>
                      <p className="text-xs text-muted-foreground">Grade {child.grade_level}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedChild && (
        <>
          {/* Student Info Card */}
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={selectedChild.profile_image || undefined} />
                  <AvatarFallback className="text-xl">{selectedChild.full_name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-foreground">{selectedChild.full_name}</h3>
                  <p className="text-sm text-muted-foreground">ID: {selectedChild.id_number}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Badge variant="outline">Grade {selectedChild.grade_level}</Badge>
                    {selectedChild.stream && (
                      <Badge variant="outline" className="capitalize">{selectedChild.stream}</Badge>
                    )}
                    {selectedChild.section && (
                      <Badge variant="outline" className="capitalize">{selectedChild.section}</Badge>
                    )}
                    {selectedChild.sub_section && (
                      <Badge variant="outline">Sub-Section {selectedChild.sub_section}</Badge>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground mb-1">Overall Average</p>
                  <p className={`text-3xl font-extrabold ${getGradeColor(overallAverage)}`}>
                    {overallAverage}%
                  </p>
                  <p className="text-xs font-semibold text-muted-foreground mt-1">
                    Grade {getLetterGrade(overallAverage)}
                  </p>
                </div>
              </div>

              {/* Ranking Info */}
              {ranking && ranking.approved && ranking.rank && (
                <div className="mt-4 pt-4 border-t flex items-center gap-3">
                  <Trophy className="h-5 w-5 text-amber-500" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Rank: #{ranking.rank} out of {ranking.total} students
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Class Average: {ranking.average}%
                    </p>
                  </div>
                </div>
              )}
              {ranking && !ranking.approved && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Rankings not yet published by the director
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Grades Breakdown */}
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-6">
              <h3 className="text-lg font-bold text-foreground mb-4">Subject Grades</h3>

              {loadingGrades ? (
                <p className="text-center text-muted-foreground py-8">Loading grades...</p>
              ) : breakdowns.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No grades available yet</p>
              ) : (
                <div className="space-y-2">
                  {breakdowns.map(subject => (
                    <Collapsible
                      key={subject.subject_id}
                      open={openSubjects.has(subject.subject_id)}
                      onOpenChange={() => toggleSubject(subject.subject_id)}
                    >
                      <Card className="border overflow-hidden">
                        <CollapsibleTrigger className="w-full">
                          <div className="p-4 hover:bg-muted/30 transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1">
                                <BookOpen className="h-5 w-5 text-primary" />
                                <div className="text-left">
                                  <p className="font-semibold text-foreground">{subject.subject_name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Teacher: {subject.teacher_name}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <p className={`text-2xl font-bold ${getGradeColor(subject.totalScore)}`}>
                                    {subject.totalScore}%
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Grade {getLetterGrade(subject.totalScore)}
                                  </p>
                                </div>
                                {openSubjects.has(subject.subject_id) ? (
                                  <Eye className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                            </div>
                            {subject.hasAssessments && (
                              <div className="mt-3">
                                <Progress value={subject.totalScore} className="h-2" />
                              </div>
                            )}
                          </div>
                        </CollapsibleTrigger>

                        <CollapsibleContent>
                          <div className="border-t bg-muted/20 p-4">
                            {!subject.hasAssessments ? (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                No assessments configured for this subject
                              </p>
                            ) : !subject.hasScores ? (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                No scores published yet
                              </p>
                            ) : (
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-muted/40">
                                    <TableHead>Assessment</TableHead>
                                    <TableHead className="text-center">Weight</TableHead>
                                    <TableHead className="text-center">Score</TableHead>
                                    <TableHead className="text-right">Contribution</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {subject.assessments.map((assessment, idx) => {
                                    const contribution = assessment.score
                                      ? Math.round((assessment.score * assessment.weight) / 100 * 100) / 100
                                      : 0;
                                    return (
                                      <TableRow key={idx}>
                                        <TableCell className="font-medium">{assessment.assessment_name}</TableCell>
                                        <TableCell className="text-center">{assessment.weight}%</TableCell>
                                        <TableCell className="text-center">
                                          {assessment.score !== null ? (
                                            <Badge variant={assessment.score >= 50 ? "default" : "destructive"}>
                                              {assessment.score}%
                                            </Badge>
                                          ) : (
                                            <span className="text-muted-foreground text-sm">—</span>
                                          )}
                                        </TableCell>
                                        <TableCell className="text-right font-semibold">
                                          {assessment.score !== null ? `${contribution}%` : '—'}
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                  <TableRow className="bg-muted/40 font-bold">
                                    <TableCell colSpan={3}>Total Score</TableCell>
                                    <TableCell className="text-right text-lg">
                                      {subject.totalScore}%
                                    </TableCell>
                                  </TableRow>
                                </TableBody>
                              </Table>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Academic History */}
          <AcademicHistory studentId={selectedChild.user_id} />
        </>
      )}
    </div>
  );
}
