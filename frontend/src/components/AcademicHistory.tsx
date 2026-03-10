import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { History, Award, TrendingUp } from "lucide-react";
import { api } from "@/services/api";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp } from "lucide-react";

interface AcademicHistoryProps {
  studentId: string;
  studentName?: string;
}

interface YearSummary {
  academic_year: string;
  grade_level: number;
  stream: string | null;
  total_score: number;
  average_score: number;
  rank_position: number;
  total_students: number;
  subject_count: number;
  status: string | null;
}

interface SubjectResult {
  subject_name: string;
  total_score: number;
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
}

export default function AcademicHistory({ studentId }: AcademicHistoryProps) {
  const [history, setHistory] = useState<YearHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [openYears, setOpenYears] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchHistory();
  }, [studentId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await api.getAcademicHistory(parseInt(studentId));
      setHistory(data || []);
    } catch (error) {
      console.error('Failed to fetch academic history:', error);
    }
    setLoading(false);
  };

  const toggleYear = (year: string) => {
    setOpenYears(prev => {
      const newSet = new Set(prev);
      if (newSet.has(year)) {
        newSet.delete(year);
      } else {
        newSet.add(year);
      }
      return newSet;
    });
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return null;
    
    const variants: Record<string, string> = {
      promoted: "bg-green-500/10 text-green-500",
      retained: "bg-yellow-500/10 text-yellow-500",
      graduated: "bg-blue-500/10 text-blue-500"
    };
    
    return (
      <Badge className={`${variants[status] || ""} border-0`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (loading) {
    return <p className="text-muted-foreground text-center py-6">Loading academic history...</p>;
  }

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
        <Card key={year.academic_year} className="border-0 shadow-sm">
          <Collapsible open={openYears.has(year.academic_year)} onOpenChange={() => toggleYear(year.academic_year)}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <CardTitle className="text-lg">{year.academic_year.replace('-', '/')}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Grade {year.grade_level} {year.stream && `- ${year.stream}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {year.status && getStatusBadge(year.status)}
                    {openYears.has(year.academic_year) ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <CardContent className="space-y-4">
                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Average Score</p>
                    <p className="text-2xl font-bold">{year.average_score.toFixed(1)}%</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="flex items-center gap-1 mb-1">
                      <Award className="h-3 w-3 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Rank</p>
                    </div>
                    <p className="text-2xl font-bold">#{year.rank_position}</p>
                    <p className="text-xs text-muted-foreground">of {year.total_students}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Total Score</p>
                    <p className="text-2xl font-bold">{year.total_score.toFixed(1)}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Subjects</p>
                    <p className="text-2xl font-bold">{year.subject_count}</p>
                  </div>
                </div>

                {/* Subject Breakdown */}
                <div>
                  <h4 className="font-semibold mb-3">Subject Results</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Subject</TableHead>
                        <TableHead className="text-right">Score</TableHead>
                        <TableHead className="text-right">Grade</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {year.subjects.map((subject, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{subject.subject_name}</TableCell>
                          <TableCell className="text-right">{subject.total_score.toFixed(1)}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={subject.total_score >= 50 ? "default" : "destructive"}>
                              {subject.total_score >= 90 ? 'A' :
                               subject.total_score >= 80 ? 'B' :
                               subject.total_score >= 70 ? 'C' :
                               subject.total_score >= 50 ? 'D' : 'F'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      ))}
    </div>
  );
}

