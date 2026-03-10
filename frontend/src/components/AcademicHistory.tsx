import { useEffect, useState } from "react";
// Supabase removed - replace with your backend API
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { History, Trophy, BookOpen, TrendingUp } from "lucide-react";

interface AcademicHistoryProps {
  studentId: string;
  studentName?: string;
}

interface YearSummary {
  academic_year: string;
  grade_level: number;
  stream: string | null;
  section: string | null;
  total_score: number;
  average_score: number;
  rank: number | null;
  total_students: number | null;
  subject_count: number;
}

interface YearResult {
  subject_name: string;
  score: number;
  grade_level: number;
}

export default function AcademicHistory({ studentId, studentName }: AcademicHistoryProps) {
  const [summaries, setSummaries] = useState<YearSummary[]>([]);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [results, setResults] = useState<YearResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);

  useEffect(() => {
    const fetchSummaries = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("academic_year_summaries")
        .select("*")
        .eq("student_id", studentId)
        .order("academic_year", { ascending: false });

      const items = (data || []) as any[];
      setSummaries(items.map((d: any) => ({
        academic_year: d.academic_year,
        grade_level: d.grade_level,
        stream: d.stream,
        section: d.section,
        total_score: Number(d.total_score),
        average_score: Number(d.average_score),
        rank: d.rank,
        total_students: d.total_students,
        subject_count: d.subject_count,
      })));

      if (items.length > 0) {
        setSelectedYear(items[0].academic_year);
      }
      setLoading(false);
    };
    fetchSummaries();
  }, [studentId]);

  useEffect(() => {
    if (!selectedYear) return;
    const fetchResults = async () => {
      setLoadingResults(true);
      const { data } = await supabase
        .from("academic_year_results")
        .select("*")
        .eq("student_id", studentId)
        .eq("academic_year", selectedYear)
        .order("subject_name");

      setResults((data || []).map((d: any) => ({
        subject_name: d.subject_name,
        score: Number(d.score),
        grade_level: d.grade_level,
      })));
      setLoadingResults(false);
    };
    fetchResults();
  }, [selectedYear, studentId]);

  const currentSummary = summaries.find(s => s.academic_year === selectedYear);

  if (loading) {
    return <p className="text-muted-foreground text-center py-6">Loading academic history...</p>;
  }

  if (summaries.length === 0) {
    return (
      <Card className="border-0 shadow-md">
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
      {/* Header with year selector */}
      <Card className="border-0 shadow-md overflow-hidden">
        <div className="gradient-hero p-6 text-white">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-white/10 rounded-xl p-2">
                <History className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold">Academic History</h2>
                {studentName && <p className="text-white/60 text-sm">{studentName}</p>}
              </div>
            </div>
            {selectedYear && (
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[160px] bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {summaries.filter(s => s.academic_year).map(s => (
                    <SelectItem key={s.academic_year} value={s.academic_year}>
                      {s.academic_year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </Card>

      {/* Summary cards */}
      {currentSummary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border-0 shadow-md">
            <CardContent className="pt-4 pb-4 text-center">
              <BookOpen className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Grade</p>
              <p className="text-lg font-extrabold">{currentSummary.grade_level}</p>
              {currentSummary.stream && (
                <p className="text-xs text-muted-foreground capitalize">{currentSummary.stream}</p>
              )}
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="pt-4 pb-4 text-center">
              <TrendingUp className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Average</p>
              <p className={`text-lg font-extrabold ${currentSummary.average_score >= 50 ? "text-green-600" : "text-destructive"}`}>
                {currentSummary.average_score}%
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="pt-4 pb-4 text-center">
              <Trophy className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Rank</p>
              <p className="text-lg font-extrabold">
                {currentSummary.rank || "—"}
                {currentSummary.total_students && (
                  <span className="text-xs font-normal text-muted-foreground">/{currentSummary.total_students}</span>
                )}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="pt-4 pb-4 text-center">
              <BookOpen className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-extrabold">{currentSummary.total_score}</p>
              <p className="text-xs text-muted-foreground">{currentSummary.subject_count} subjects</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Subject results table */}
      <Card className="border-0 shadow-md">
        <CardContent className="pt-4">
          {loadingResults ? (
            <p className="text-center text-muted-foreground py-6">Loading results...</p>
          ) : results.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">No subject results for this year.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">#</TableHead>
                  <TableHead className="text-xs">Subject</TableHead>
                  <TableHead className="text-xs text-right">Score</TableHead>
                  <TableHead className="text-xs text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((r, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-sm text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="text-sm font-medium">{r.subject_name}</TableCell>
                    <TableCell className="text-right">
                      <span className={`font-bold text-sm ${r.score >= 50 ? "text-green-600" : "text-destructive"}`}>
                        {r.score}/100
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={r.score >= 50 ? "default" : "destructive"}
                        className={`text-xs ${r.score >= 50 ? "gradient-accent border-0 text-white" : ""}`}
                      >
                        {r.score >= 50 ? "Pass" : "Fail"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
