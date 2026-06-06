import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { History, ChevronDown, ChevronUp } from "lucide-react";
import { api } from "@/services/api";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface SubjectResult {
  subject_name: string;
  total_score: number;
}

interface SemesterSummary {
  term: string;
  total_score: number;
  average_score: number;
  rank_position: number;
  total_students: number;
  subject_count: number;
}

interface YearHistory {
  academic_year: string;
  grade_level: number;
  stream: string | null;
  total_score: number;
  average_score: number;
  rank_position: number;
  total_students: number;
  subject_count: number;
  status: string | null;
  subjects: SubjectResult[];
  semesters: SemesterSummary[];
}

interface AcademicHistoryProps {
  studentId: string;
}

const gradeLabel = (score: number) =>
  score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 50 ? 'D' : 'F';

export default function AcademicHistory({ studentId }: AcademicHistoryProps) {
  const [history, setHistory] = useState<YearHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [openYears, setOpenYears] = useState<Set<string>>(new Set());
  const [openSems, setOpenSems] = useState<Set<string>>(new Set());

  useEffect(() => { fetchHistory(); }, [studentId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await api.getAcademicHistory(parseInt(studentId));
      const normalized = (data || []).map((year: YearHistory) => ({
        ...year,
        average_score: Number(year.average_score),
        total_score: Number(year.total_score),
        subjects: (year.subjects || []).map((s: SubjectResult) => ({
          ...s,
          total_score: Number(s.total_score),
        })),
        semesters: (year.semesters || []).map((s: SemesterSummary) => ({
          ...s,
          total_score: Number(s.total_score),
          average_score: Number(s.average_score),
        })),
      }));
      setHistory(normalized);
    } catch (error) {
      console.error('Failed to fetch academic history:', error);
    }
    setLoading(false);
  };

  const toggleYear = (key: string) => setOpenYears(prev => {
    const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next;
  });
  const toggleSem = (key: string) => setOpenSems(prev => {
    const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next;
  });

  const getStatusBadge = (status: string | null) => {
    if (!status || status === 'pending') return null;
    const styles: Record<string, string> = {
      promoted: "bg-green-500/10 text-green-600 border-green-500/20",
      retained: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
      graduated: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    };
    return (
      <Badge variant="outline" className={styles[status] || ""}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const StatCard = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
    <div className="bg-muted/50 rounded-lg p-3">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );

  const SubjectTable = ({ subjects }: { subjects: SubjectResult[] }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Subject</TableHead>
          <TableHead className="text-right">Score</TableHead>
          <TableHead className="text-right">Grade</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {subjects.map((s, i) => (
          <TableRow key={i}>
            <TableCell className="font-medium">{s.subject_name}</TableCell>
            <TableCell className="text-right">{s.total_score.toFixed(1)}</TableCell>
            <TableCell className="text-right">
              <Badge variant={s.total_score >= 50 ? "default" : "destructive"}>
                {gradeLabel(s.total_score)}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  if (loading) return <p className="text-muted-foreground text-center py-6">Loading academic history...</p>;

  if (history.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="py-10 text-center">
          <History className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No academic history available yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Results will appear here after each academic year is archived.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <History className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold">Academic History</h2>
      </div>

      {history.map((year) => (
        <Card key={year.academic_year} className="border-0 shadow-sm overflow-hidden">
          {/* Year header */}
          <Collapsible open={openYears.has(year.academic_year)} onOpenChange={() => toggleYear(year.academic_year)}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{year.academic_year}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Grade {year.grade_level}{year.stream ? ` · ${year.stream}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(year.status)}
                    {openYears.has(year.academic_year)
                      ? <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <CardContent className="space-y-5 pt-0">

                {/* ── Per-Semester Sections ── */}
                {year.semesters && year.semesters.length > 0 && (
                  <div className="space-y-3">
                    {year.semesters.map((sem) => {
                      const semKey = `${year.academic_year}__${sem.term}`;
                      const isOpen = openSems.has(semKey);
                      return (
                        <div key={sem.term} className="border border-border/50 rounded-xl overflow-hidden">
                          <button
                            className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
                            onClick={() => toggleSem(semKey)}
                          >
                            <div className="flex items-center gap-2">
                              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                              <span className="font-semibold text-sm">{sem.term}</span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>Avg: <strong className={cn("font-bold", sem.average_score >= 50 ? "text-emerald-600" : "text-destructive")}>{sem.average_score.toFixed(1)}%</strong></span>
                              <span>Rank: <strong>#{sem.rank_position}</strong> of {sem.total_students}</span>
                              <span>Total: <strong>{sem.total_score.toFixed(1)}</strong></span>
                            </div>
                          </button>
                          {isOpen && (
                            <div className="px-4 pb-4 pt-3 space-y-3">
                              <div className="grid grid-cols-3 gap-3">
                                <StatCard label="Average" value={`${sem.average_score.toFixed(1)}%`} />
                                <StatCard label="Rank" value={`#${sem.rank_position}`} sub={`of ${sem.total_students}`} />
                                <StatCard label="Total Score" value={sem.total_score.toFixed(1)} />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── Full Year Combined ── */}
                <div className="border border-primary/20 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-primary/8 flex items-center justify-between">
                    <span className="font-bold text-sm text-primary">Full Year Combined</span>
                    <span className="text-xs text-muted-foreground">{year.subject_count} subjects</span>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <StatCard label="Average Score" value={`${year.average_score.toFixed(1)}%`} />
                      <StatCard label="Rank" value={`#${year.rank_position}`} sub={`of ${year.total_students}`} />
                      <StatCard label="Total Score" value={year.total_score.toFixed(1)} />
                      <StatCard label="Subjects" value={String(year.subject_count)} />
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2 text-sm">Subject Results</h4>
                      <SubjectTable subjects={year.subjects} />
                    </div>
                  </div>
                </div>

              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      ))}
    </div>
  );
}
