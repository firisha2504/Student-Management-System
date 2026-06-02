import { useState, useEffect } from "react";
import { api } from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Trophy, Eye, EyeOff, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface RankingEntry {
  user_id: number;
  full_name: string;
  grade_level: number;
  stream: string | null;
  average_score: number;
  rank: number;
  total_subjects: number;
}

export default function RankingApproval() {
  const { toast } = useToast();
  const [gradeLevel, setGradeLevel] = useState("9");
  const [stream, setStream] = useState("");
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [approved, setApproved] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [term, setTerm] = useState("Semester 1");
  const [academicYear, setAcademicYear] = useState("");

  const needsStream = gradeLevel === "11" || gradeLevel === "12";

  // Load current academic year and term from system settings
  useEffect(() => {
    api.getCurrentAcademicYear().then(data => {
      if (data?.academic_year) setAcademicYear(data.academic_year);
      if (data?.term) setTerm(data.term);
    }).catch(() => {});
  }, []);

  const fetchRankings = async () => {
    if (needsStream && !stream) {
      toast({ title: "Error", description: "Please select a stream for Grade 11/12", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const data = await api.getRankings({
        grade_level: parseInt(gradeLevel),
        stream: stream || undefined
      });

      if (data.rankings) {
        setRankings(data.rankings.map((r: RankingEntry) => ({
          ...r,
          average_score: Number(r.average_score),
        })));
      }

      // Check approval status
      const statusData = await api.getRankingApprovalStatus({
        grade_level: parseInt(gradeLevel),
        stream: stream || undefined
      });
      setApproved(statusData.approved);

    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to fetch rankings", variant: "destructive" });
    }
    setLoading(false);
  };

  const togglePublish = async () => {
    if (needsStream && !stream) {
      toast({ title: "Error", description: "Please select a stream", variant: "destructive" });
      return;
    }

    setPublishing(true);
    try {
      if (approved) {
        await api.unpublishRankings({
          grade_level: parseInt(gradeLevel),
          stream: stream || undefined,
          term,
          academic_year: academicYear
        });
        setApproved(false);
        toast({ title: "Success", description: "Rankings unpublished. Students can no longer see their ranks." });
      } else {
        await api.approveRankings({
          grade_level: parseInt(gradeLevel),
          stream: stream || undefined,
          term,
          academic_year: academicYear
        });
        setApproved(true);
        toast({ title: "Success", description: "Rankings published! Students can now see their ranks." });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to update rankings", variant: "destructive" });
    }
    setPublishing(false);
  };

  const approveAll = async () => {
    setBulkApproving(true);
    try {
      const data = await api.approveAllRankings({ term, academic_year: academicYear });
      toast({
        title: "All Rankings Published",
        description: `Approved: ${data.approvedCount} grade group(s). Already approved: ${data.skippedCount}.`,
      });
      // Refresh current view if rankings are loaded
      if (rankings.length > 0) {
        const statusData = await api.getRankingApprovalStatus({
          grade_level: parseInt(gradeLevel),
          stream: stream || undefined
        });
        setApproved(statusData.approved);
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to bulk approve rankings", variant: "destructive" });
    }
    setBulkApproving(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Student Rankings</h2>
        <p className="text-sm text-muted-foreground">View and approve student rankings by grade and stream</p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Ranking Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Bulk Approve All */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <div>
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Publish All Grade Rankings</p>
              <p className="text-xs text-muted-foreground">Approve rankings for all grade levels at once for {term} · {academicYear}</p>
            </div>
            <Button
              onClick={approveAll}
              disabled={bulkApproving || !academicYear}
              className="rounded-xl gradient-accent border-0 text-white text-xs shrink-0"
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1.5" />
              {bulkApproving ? "Approving..." : "Approve All Grades"}
            </Button>
          </div>

          <div className="relative flex items-center gap-2">
            <div className="flex-1 border-t border-border/50" />
            <span className="text-xs text-muted-foreground px-2">or approve by grade</span>
            <div className="flex-1 border-t border-border/50" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Select value={gradeLevel} onValueChange={(v) => { setGradeLevel(v); setStream(""); setRankings([]); }}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Grade" />
              </SelectTrigger>
              <SelectContent>
                {[9, 10, 11, 12].map(g => (
                  <SelectItem key={g} value={String(g)}>Grade {g}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {needsStream && (
              <Select value={stream} onValueChange={setStream}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Stream" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="natural">Natural</SelectItem>
                  <SelectItem value="social">Social</SelectItem>
                </SelectContent>
              </Select>
            )}

            <Button
              onClick={fetchRankings}
              disabled={loading}
              className="rounded-xl gradient-primary border-0 text-white"
            >
              {loading ? "Loading..." : "View Rankings"}
            </Button>
          </div>

          {rankings.length > 0 && (
            <>
              <div className="flex items-center justify-between pt-2">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs",
                    approved
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                      : "bg-amber-500/10 text-amber-600 border-amber-500/30"
                  )}
                >
                  {approved ? "✓ Published — Students can see ranks" : "⚠ Unpublished — Students cannot see ranks"}
                </Badge>
                <Button
                  onClick={togglePublish}
                  disabled={publishing}
                  variant={approved ? "outline" : "default"}
                  className={cn(
                    "rounded-xl text-xs",
                    !approved && "gradient-accent border-0 text-white"
                  )}
                >
                  {approved ? <EyeOff className="h-3.5 w-3.5 mr-1.5" /> : <Eye className="h-3.5 w-3.5 mr-1.5" />}
                  {publishing ? "..." : approved ? "Unpublish Rankings" : "Publish Rankings"}
                </Button>
              </div>

              <div className="overflow-x-auto border rounded-xl">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/20">
                      <TableHead className="w-16">Rank</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead>Stream</TableHead>
                      <TableHead className="text-center">Subjects</TableHead>
                      <TableHead className="text-right">Average</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rankings.map((r) => (
                      <TableRow key={r.user_id} className="hover:bg-muted/30">
                        <TableCell className="font-bold text-primary">#{r.rank}</TableCell>
                        <TableCell className="font-semibold">{r.full_name}</TableCell>
                        <TableCell>Grade {r.grade_level}</TableCell>
                        <TableCell className="capitalize">{r.stream || "—"}</TableCell>
                        <TableCell className="text-center">{r.total_subjects}</TableCell>
                        <TableCell className="text-right">
                          <Badge
                            className={cn(
                              "text-xs",
                              r.average_score >= 50
                                ? "gradient-accent border-0 text-white"
                                : "bg-destructive text-destructive-foreground"
                            )}
                          >
                            {r.average_score.toFixed(1)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {rankings.length === 0 && !loading && (
            <p className="text-center text-muted-foreground py-6">
              Select grade level and click "View Rankings" to see student rankings
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
