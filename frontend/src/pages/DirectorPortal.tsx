import { useEffect, useState } from "react";
// Supabase removed - replace with your backend API
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Users, GraduationCap, BarChart3, Trophy, Eye,
  Menu, ChevronLeft, ChevronRight, PieChart as PieChartIcon, Medal, Printer
} from "lucide-react";
import { cn } from "@/lib/utils";
import SuccessModal from "@/components/SuccessModal";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line
} from "recharts";

interface UserWithRole {
  user_id: string;
  full_name: string;
  username: string;
  id_number: string;
  is_active: boolean;
  role: string;
}

interface RankingEntry {
  user_id: string;
  full_name: string;
  section: string | null;
  average: number;
  rank: number;
}

interface OverallRankingEntry {
  user_id: string;
  full_name: string;
  grade_level: number;
  section: string | null;
  stream: string | null;
  average: number;
  rank: number;
}

type DirectorSection = "teachers" | "rankings" | "top10" | "performance";

const sidebarItems: { id: DirectorSection; label: string; icon: React.ElementType }[] = [
  { id: "teachers", label: "Teachers", icon: Users },
  { id: "rankings", label: "Rankings", icon: Trophy },
  { id: "top10", label: "Top 10 Overall", icon: Medal },
  { id: "performance", label: "Performance", icon: BarChart3 },
];

const CHART_COLORS = [
  "hsl(234, 85%, 60%)", "hsl(262, 80%, 60%)", "hsl(340, 75%, 55%)",
  "hsl(160, 60%, 45%)", "hsl(30, 85%, 55%)", "hsl(200, 70%, 50%)",
];

const GENDER_COLORS = { male: "hsl(220, 70%, 55%)", female: "hsl(340, 70%, 55%)" };

export default function DirectorPortal() {
  const { role, user } = useAuth();
  const { toast } = useToast();
  const [teachers, setTeachers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<DirectorSection>("teachers");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Assign dialog
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assigningTeacher, setAssigningTeacher] = useState<UserWithRole | null>(null);
  const [allSubjects, setAllSubjects] = useState<{ id: string; subject_name: string; grade_level: number; stream: string | null }[]>([]);
  const [assignedSubjectIds, setAssignedSubjectIds] = useState<string[]>([]);
  const [assignedGradeLevels, setAssignedGradeLevels] = useState<number[]>([]);
  const [assignedSections, setAssignedSections] = useState<string[]>([]);
  const [assignedSubSections, setAssignedSubSections] = useState<string[]>([]);
  const [savingAssignments, setSavingAssignments] = useState(false);

  // Rankings
  const [rankGrade, setRankGrade] = useState("9");
  const [rankStream, setRankStream] = useState("");
  const [rankSection, setRankSection] = useState("");
  const [rankSubSection, setRankSubSection] = useState("");
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [loadingRankings, setLoadingRankings] = useState(false);
  const [rankingsPublished, setRankingsPublished] = useState(false);
  const [publishingRankings, setPublishingRankings] = useState(false);

  // Top 10 Overall
  const [top10Rankings, setTop10Rankings] = useState<OverallRankingEntry[]>([]);
  const [loadingTop10, setLoadingTop10] = useState(false);

  // Stats
  const [stats, setStats] = useState<{
    totalStudents: number;
    totalTeachers: number;
    subjectAverages: { name: string; average: number }[];
    genderStats: { name: string; value: number }[];
    scoreDistribution: { range: string; count: number }[];
    yearlyTrends: { year: string; average: number }[];
  } | null>(null);

  // Performance filters
  const [perfGrade, setPerfGrade] = useState("all");
  const [perfStream, setPerfStream] = useState("all");

  const [successModal, setSuccessModal] = useState<{ title: string; description?: string } | null>(null);

  const fetchTeachers = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from("profiles").select("*");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role").eq("role", "teacher");
    const teacherIds = new Set((roles || []).map(r => r.user_id));
    setTeachers((profiles || []).filter(p => teacherIds.has(p.user_id)).map(p => ({
      user_id: p.user_id, full_name: p.full_name, username: p.username,
      id_number: p.id_number, is_active: p.is_active, role: "teacher",
    })));
    setLoading(false);
  };

  const fetchStats = async () => {
    const { data: roles } = await supabase.from("user_roles").select("role, user_id");
    const studentIds = new Set((roles || []).filter(r => r.role === "student").map(r => r.user_id));
    const totalStudents = studentIds.size;
    const totalTeachers = (roles || []).filter(r => r.role === "teacher").length;

    // Fetch all student profiles for gender stats
    const { data: profiles } = await supabase.from("profiles").select("user_id, gender, grade_level, stream");
    const studentProfiles = (profiles || []).filter(p => studentIds.has(p.user_id));

    // Apply filters
    const filteredProfiles = studentProfiles.filter(p => {
      if (perfGrade !== "all" && p.grade_level?.toString() !== perfGrade) return false;
      if (perfStream !== "all" && p.stream !== perfStream) return false;
      return true;
    });

    // Gender stats
    const maleCount = filteredProfiles.filter(p => (p as any).gender === "male").length;
    const femaleCount = filteredProfiles.filter(p => (p as any).gender === "female").length;
    const unknownCount = filteredProfiles.filter(p => !(p as any).gender).length;
    const genderStats = [
      ...(maleCount > 0 ? [{ name: "Male", value: maleCount }] : []),
      ...(femaleCount > 0 ? [{ name: "Female", value: femaleCount }] : []),
      ...(unknownCount > 0 ? [{ name: "Not Set", value: unknownCount }] : []),
    ];

    // Subject averages from grades
    const { data: grades } = await supabase.from("grades").select("score, student_id, subjects(subject_name)");
    const filteredStudentIds = new Set(filteredProfiles.map(p => p.user_id));
    const filteredGrades = (grades || []).filter((g: any) => filteredStudentIds.has(g.student_id));

    const subjectMap: Record<string, { total: number; count: number }> = {};
    filteredGrades.forEach((g: any) => {
      const name = g.subjects?.subject_name || "Unknown";
      if (!subjectMap[name]) subjectMap[name] = { total: 0, count: 0 };
      subjectMap[name].total += g.score;
      subjectMap[name].count += 1;
    });
    const subjectAverages = Object.entries(subjectMap)
      .map(([name, { total, count }]) => ({ name, average: Math.round(total / count) }))
      .sort((a, b) => b.average - a.average);

    // Score distribution
    const ranges = [
      { range: "0-20", min: 0, max: 20 },
      { range: "21-40", min: 21, max: 40 },
      { range: "41-60", min: 41, max: 60 },
      { range: "61-80", min: 61, max: 80 },
      { range: "81-100", min: 81, max: 100 },
    ];
    const scoreDistribution = ranges.map(r => ({
      range: r.range,
      count: filteredGrades.filter((g: any) => g.score >= r.min && g.score <= r.max).length,
    }));

    // Yearly trends from academic_year_summaries
    const { data: summaries } = await supabase.from("academic_year_summaries").select("academic_year, average_score, student_id");
    const filteredSummaries = (summaries || []).filter(s => filteredStudentIds.has(s.student_id));
    const yearMap: Record<string, { total: number; count: number }> = {};
    filteredSummaries.forEach(s => {
      if (!yearMap[s.academic_year]) yearMap[s.academic_year] = { total: 0, count: 0 };
      yearMap[s.academic_year].total += Number(s.average_score);
      yearMap[s.academic_year].count += 1;
    });
    const yearlyTrends = Object.entries(yearMap)
      .map(([year, { total, count }]) => ({ year, average: Math.round(total / count) }))
      .sort((a, b) => a.year.localeCompare(b.year));

    setStats({ totalStudents, totalTeachers, subjectAverages, genderStats, scoreDistribution, yearlyTrends });
  };

  useEffect(() => { fetchTeachers(); }, []);
  useEffect(() => { fetchStats(); }, [perfGrade, perfStream]);

  const fetchTop10 = async () => {
    setLoadingTop10(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("top-students-overall", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw error;
      setTop10Rankings(data?.rankings || []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setLoadingTop10(false);
  };

  const printTop10 = () => {
    const rows = top10Rankings.map(r =>
      `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:bold">#${r.rank}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600">${r.full_name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">Grade ${r.grade_level}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-transform:capitalize">${r.section || "—"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-transform:capitalize">${r.stream || "—"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:bold">${r.average}%</td>
      </tr>`
    ).join("");

    const html = `<!DOCTYPE html>
<html><head><title>Top 10 Students Overall</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; color: #1a1a1a; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  p { color: #666; font-size: 13px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; }
  th { padding: 10px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #666; border-bottom: 2px solid #e5e7eb; }
  th:last-child { text-align: right; }
  .footer { margin-top: 32px; font-size: 11px; color: #999; text-align: center; }
  @media print { body { padding: 20px; } }
</style>
</head><body>
  <h1>🏆 Top 10 Students Overall — Grades 9-12</h1>
  <p>Generated on ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
  <table>
    <thead><tr><th>Rank</th><th>Name</th><th>Grade</th><th>Section</th><th>Stream</th><th>Average</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">School Management System — Confidential Report</div>
</body></html>`;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 300);
    }
  };

  if (role !== "director") return <p className="text-destructive">Access denied.</p>;

  const openAssignDialog = async (teacher: UserWithRole) => {
    setAssigningTeacher(teacher);
    const { data: subjects } = await supabase.from("subjects").select("*");
    setAllSubjects(subjects || []);
    const { data: assigned } = await supabase.from("teacher_subjects").select("subject_id").eq("teacher_id", teacher.user_id);
    setAssignedSubjectIds((assigned || []).map(a => a.subject_id));
    const { data: grades } = await supabase.from("teacher_grades").select("grade_level").eq("teacher_id", teacher.user_id);
    setAssignedGradeLevels((grades || []).map(g => g.grade_level));
    const { data: sections } = await supabase.from("teacher_sections").select("section").eq("teacher_id", teacher.user_id);
    setAssignedSections((sections || []).map((s: any) => s.section));
    const { data: subSections } = await supabase.from("teacher_sub_sections" as any).select("sub_section").eq("teacher_id", teacher.user_id);
    setAssignedSubSections((subSections as any[] || []).map((s: any) => s.sub_section));
    setAssignDialogOpen(true);
  };

  const toggleSubjectAssignment = (id: string) => setAssignedSubjectIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const toggleGradeAssignment = (g: number) => setAssignedGradeLevels(prev => prev.includes(g) ? prev.filter(i => i !== g) : [...prev, g]);
  const toggleSectionAssignment = (s: string) => setAssignedSections(prev => prev.includes(s) ? prev.filter(i => i !== s) : [...prev, s]);
  const toggleSubSectionAssignment = (s: string) => setAssignedSubSections(prev => prev.includes(s) ? prev.filter(i => i !== s) : [...prev, s]);

  const saveAssignments = async () => {
    if (!assigningTeacher) return;
    setSavingAssignments(true);
    await supabase.from("teacher_subjects").delete().eq("teacher_id", assigningTeacher.user_id);
    if (assignedSubjectIds.length > 0) {
      await supabase.from("teacher_subjects").insert(assignedSubjectIds.map(sid => ({ teacher_id: assigningTeacher.user_id, subject_id: sid })));
    }
    await supabase.from("teacher_grades").delete().eq("teacher_id", assigningTeacher.user_id);
    if (assignedGradeLevels.length > 0) {
      await supabase.from("teacher_grades").insert(assignedGradeLevels.map(g => ({ teacher_id: assigningTeacher.user_id, grade_level: g })));
    }
    await supabase.from("teacher_sections").delete().eq("teacher_id", assigningTeacher.user_id);
    if (assignedSections.length > 0) {
      await supabase.from("teacher_sections").insert(assignedSections.map(s => ({ teacher_id: assigningTeacher.user_id, section: s })) as any);
    }
    await (supabase.from("teacher_sub_sections" as any) as any).delete().eq("teacher_id", assigningTeacher.user_id);
    if (assignedSubSections.length > 0) {
      await (supabase.from("teacher_sub_sections" as any) as any).insert(assignedSubSections.map(s => ({ teacher_id: assigningTeacher.user_id, sub_section: s })));
    }
    setSuccessModal({ title: "Assignments Saved", description: `Updated assignments for ${assigningTeacher.full_name}` });
    setSavingAssignments(false);
    setAssignDialogOpen(false);
  };

  const fetchRankings = async () => {
    setLoadingRankings(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const params = new URLSearchParams({ grade_level: rankGrade });
      if (rankStream) params.set("stream", rankStream);
      if (rankSection && rankSection !== "all") params.set("section", rankSection);
      if (rankSubSection && rankSubSection !== "all") params.set("sub_section", rankSubSection);
      const { data, error } = await supabase.functions.invoke(`student-rankings?${params.toString()}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw error;
      setRankings(data?.rankings || []);

      let approvalQuery = supabase.from("ranking_approvals" as any).select("id")
        .eq("grade_level", parseInt(rankGrade));
      if (rankStream) approvalQuery = approvalQuery.eq("stream", rankStream);
      else approvalQuery = approvalQuery.is("stream", null);
      if (rankSection && rankSection !== "all") approvalQuery = approvalQuery.eq("section", rankSection);
      else approvalQuery = approvalQuery.is("section", null);
      if (rankSubSection && rankSubSection !== "all") approvalQuery = approvalQuery.eq("sub_section", rankSubSection);
      else approvalQuery = approvalQuery.is("sub_section", null);
      const { data: approval } = await approvalQuery.maybeSingle();
      setRankingsPublished(!!approval);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setLoadingRankings(false);
  };

  const togglePublishRankings = async () => {
    setPublishingRankings(true);
    try {
      if (rankingsPublished) {
        let deleteQuery = supabase.from("ranking_approvals" as any).delete()
          .eq("grade_level", parseInt(rankGrade));
        if (rankStream) deleteQuery = deleteQuery.eq("stream", rankStream);
        else deleteQuery = deleteQuery.is("stream", null);
        if (rankSection && rankSection !== "all") deleteQuery = deleteQuery.eq("section", rankSection);
        else deleteQuery = deleteQuery.is("section", null);
        if (rankSubSection && rankSubSection !== "all") deleteQuery = deleteQuery.eq("sub_section", rankSubSection);
        else deleteQuery = deleteQuery.is("sub_section", null);
        await deleteQuery;
        setRankingsPublished(false);
        setSuccessModal({ title: "Rankings Unpublished", description: "Students can no longer see their ranks for this group." });
      } else {
        await (supabase.from("ranking_approvals" as any) as any).upsert({
          grade_level: parseInt(rankGrade),
          stream: rankStream || null,
          section: (rankSection && rankSection !== "all") ? rankSection : null,
          sub_section: (rankSubSection && rankSubSection !== "all") ? rankSubSection : null,
          approved_by: user!.id,
        }, { onConflict: "grade_level,stream,section,sub_section" });
        setRankingsPublished(true);
        setSuccessModal({ title: "Rankings Published", description: "Students can now see their ranks." });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setPublishingRankings(false);
  };

  const needsStream = rankGrade === "11" || rankGrade === "12";

  const handleNavClick = (id: DirectorSection) => { setActiveSection(id); setMobileSidebarOpen(false); };

  const getBadgeCount = (id: DirectorSection) => {
    if (id === "teachers") return teachers.length;
    return null;
  };

  const renderContent = () => {
    switch (activeSection) {
      case "teachers":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Teachers</h2>
              <p className="text-sm text-muted-foreground">{teachers.length} total teachers</p>
            </div>

            {stats && (
              <div className="grid gap-4 grid-cols-2">
                <Card className="border-0 shadow-md">
                  <CardContent className="pt-6 pb-5 flex items-center gap-4">
                    <div className="gradient-primary rounded-xl p-3 shadow-lg"><GraduationCap className="h-5 w-5 text-white" /></div>
                    <div><p className="text-xs font-medium text-muted-foreground uppercase">Students</p><p className="text-2xl font-extrabold text-foreground">{stats.totalStudents}</p></div>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-md">
                  <CardContent className="pt-6 pb-5 flex items-center gap-4">
                    <div className="gradient-accent rounded-xl p-3 shadow-lg"><Users className="h-5 w-5 text-white" /></div>
                    <div><p className="text-xs font-medium text-muted-foreground uppercase">Teachers</p><p className="text-2xl font-extrabold text-foreground">{stats.totalTeachers}</p></div>
                  </CardContent>
                </Card>
              </div>
            )}

            <Card className="border-0 shadow-sm overflow-hidden">
              <CardContent className="p-0">
                {loading ? <p className="p-6 text-center text-muted-foreground">Loading...</p> : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/20">
                          <TableHead>Name</TableHead>
                          <TableHead>Username</TableHead>
                          <TableHead>ID</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teachers.map(t => (
                          <TableRow key={t.user_id} className="hover:bg-muted/30">
                            <TableCell className="font-semibold">{t.full_name}</TableCell>
                            <TableCell className="text-muted-foreground">{t.username}</TableCell>
                            <TableCell className="font-mono text-sm">{t.id_number}</TableCell>
                            <TableCell>
                              <Badge variant={t.is_active ? "default" : "destructive"} className={cn("text-xs", t.is_active && "gradient-accent border-0 text-white")}>
                                {t.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button size="sm" className="rounded-lg text-xs gradient-primary border-0 text-white" onClick={() => openAssignDialog(t)}>
                                Assign
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {teachers.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No teachers</TableCell></TableRow>}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );

      case "rankings":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Student Rankings</h2>
              <p className="text-sm text-muted-foreground">View student rankings by grade and stream</p>
            </div>
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Select value={rankGrade} onValueChange={v => { setRankGrade(v); setRankStream(""); }}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Grade" /></SelectTrigger>
                    <SelectContent>{[9,10,11,12].map(g => <SelectItem key={g} value={String(g)}>Grade {g}</SelectItem>)}</SelectContent>
                  </Select>
                  {needsStream && (
                    <Select value={rankStream} onValueChange={setRankStream}>
                      <SelectTrigger className="rounded-xl"><SelectValue placeholder="Stream" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="natural">Natural</SelectItem>
                        <SelectItem value="social">Social</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  <Select value={rankSection} onValueChange={setRankSection}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Section" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sections</SelectItem>
                      <SelectItem value="oromo">Oromo</SelectItem>
                      <SelectItem value="amharic">Amharic</SelectItem>
                      <SelectItem value="somali">Somali</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={rankSubSection} onValueChange={setRankSubSection}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Sub-Section" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {["A","B","C","D","E","F","G","H"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button onClick={fetchRankings} disabled={loadingRankings} className="rounded-xl gradient-primary border-0 text-white">
                    {loadingRankings ? "Loading..." : "View Rankings"}
                  </Button>
                </div>

                {rankings.length > 0 && (
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={cn("text-xs", rankingsPublished ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" : "bg-amber-500/10 text-amber-600 border-amber-500/30")}>
                      {rankingsPublished ? "Published — Students can see ranks" : "Unpublished — Students cannot see ranks"}
                    </Badge>
                    <Button
                      onClick={togglePublishRankings}
                      disabled={publishingRankings}
                      variant={rankingsPublished ? "outline" : "default"}
                      className={cn("rounded-xl text-xs", !rankingsPublished && "gradient-accent border-0 text-white")}
                    >
                      <Eye className="h-3.5 w-3.5 mr-1.5" />
                      {publishingRankings ? "..." : rankingsPublished ? "Unpublish Rankings" : "Publish Rankings"}
                    </Button>
                  </div>
                )}

                {rankings.length > 0 && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/20">
                          <TableHead className="w-16">Rank</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Section</TableHead>
                          <TableHead className="text-right">Average</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rankings.map(r => (
                          <TableRow key={r.user_id} className="hover:bg-muted/30">
                            <TableCell className="font-bold text-primary">#{r.rank}</TableCell>
                            <TableCell className="font-semibold">{r.full_name}</TableCell>
                            <TableCell className="capitalize text-muted-foreground">{r.section || "—"}</TableCell>
                            <TableCell className="text-right">
                              <Badge className={cn("text-xs", r.average >= 50 ? "gradient-accent border-0 text-white" : "bg-destructive text-destructive-foreground")}>
                                {r.average}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {rankings.length === 0 && !loadingRankings && (
                  <p className="text-center text-muted-foreground py-6">Select filters and click "View Rankings"</p>
                )}
              </CardContent>
            </Card>
          </div>
        );

      case "top10":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-bold text-foreground">Top 10 Students Overall</h2>
                <p className="text-sm text-muted-foreground">Highest performing students across all grades (9-12)</p>
              </div>
              <div className="flex items-center gap-2">
                {top10Rankings.length > 0 && (
                  <Button variant="outline" onClick={printTop10} className="rounded-xl text-xs">
                    <Printer className="h-3.5 w-3.5 mr-1.5" />
                    Print / PDF
                  </Button>
                )}
                <Button onClick={fetchTop10} disabled={loadingTop10} className="rounded-xl gradient-primary border-0 text-white">
                  {loadingTop10 ? "Loading..." : "Calculate Rankings"}
                </Button>
              </div>
            </div>

            {top10Rankings.length > 0 && (
              <Card className="border-0 shadow-md overflow-hidden">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/20">
                          <TableHead className="w-16">Rank</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Grade</TableHead>
                          <TableHead>Section</TableHead>
                          <TableHead>Stream</TableHead>
                          <TableHead className="text-right">Average</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {top10Rankings.map(r => (
                          <TableRow key={r.user_id} className="hover:bg-muted/30">
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                {r.rank <= 3 ? (
                                  <Trophy className={cn("h-4 w-4", r.rank === 1 ? "text-yellow-500" : r.rank === 2 ? "text-gray-400" : "text-amber-600")} />
                                ) : null}
                                <span className="font-bold text-primary">#{r.rank}</span>
                              </div>
                            </TableCell>
                            <TableCell className="font-semibold">{r.full_name}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">G{r.grade_level}</Badge></TableCell>
                            <TableCell className="capitalize text-muted-foreground">{r.section || "—"}</TableCell>
                            <TableCell className="capitalize text-muted-foreground">{r.stream || "—"}</TableCell>
                            <TableCell className="text-right">
                              <Badge className={cn("text-xs", r.average >= 50 ? "gradient-accent border-0 text-white" : "bg-destructive text-destructive-foreground")}>
                                {r.average}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
            {top10Rankings.length === 0 && !loadingTop10 && (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-10 text-center text-muted-foreground">
                  Click "Calculate Rankings" to see the top 10 students across all grades
                </CardContent>
              </Card>
            )}
          </div>
        );

      case "performance":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Academic Performance Dashboard</h2>
              <p className="text-sm text-muted-foreground">Comprehensive analytics across subjects, gender, and trends</p>
            </div>

            {/* Filters */}
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm font-semibold text-foreground">Filters:</span>
                  <Select value={perfGrade} onValueChange={setPerfGrade}>
                    <SelectTrigger className="rounded-xl w-32"><SelectValue placeholder="Grade" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Grades</SelectItem>
                      {[9,10,11,12].map(g => <SelectItem key={g} value={String(g)}>Grade {g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={perfStream} onValueChange={setPerfStream}>
                    <SelectTrigger className="rounded-xl w-32"><SelectValue placeholder="Stream" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Streams</SelectItem>
                      <SelectItem value="natural">Natural</SelectItem>
                      <SelectItem value="social">Social</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {stats ? (
              <div className="space-y-6">
                {/* Top: Average Score Bar Chart */}
                {stats.subjectAverages.length > 0 && (
                  <Card className="border-0 shadow-md">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <div className="gradient-primary rounded-lg p-1.5"><BarChart3 className="h-4 w-4 text-white" /></div>
                        Average Score per Subject
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={stats.subjectAverages} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="name" angle={-35} textAnchor="end" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                            <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                            <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.75rem" }} formatter={(v: number) => [`${v}%`, "Average"]} />
                            <Bar dataKey="average" radius={[6, 6, 0, 0]}>
                              {stats.subjectAverages.map((_, i) => (
                                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Middle: Score Distribution + Gender Stats */}
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Score Distribution Pie */}
                  {stats.scoreDistribution.some(d => d.count > 0) && (
                    <Card className="border-0 shadow-md">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <div className="gradient-accent rounded-lg p-1.5"><PieChartIcon className="h-4 w-4 text-white" /></div>
                          Score Distribution
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={stats.scoreDistribution.filter(d => d.count > 0)}
                                cx="50%" cy="50%"
                                innerRadius={50} outerRadius={90}
                                paddingAngle={3}
                                dataKey="count"
                                nameKey="range"
                                label={({ range, count }) => `${range}: ${count}`}
                              >
                                {stats.scoreDistribution.filter(d => d.count > 0).map((_, i) => (
                                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.75rem" }} />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Gender Stats */}
                  {stats.genderStats.length > 0 && (
                    <Card className="border-0 shadow-md">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <div className="gradient-warm rounded-lg p-1.5"><Users className="h-4 w-4 text-white" /></div>
                          Gender Distribution
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-44">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={stats.genderStats}
                                cx="50%" cy="50%"
                                innerRadius={35} outerRadius={65}
                                paddingAngle={3}
                                dataKey="value"
                                nameKey="name"
                                label={({ name, value }) => `${name}: ${value}`}
                              >
                                {stats.genderStats.map((entry, i) => (
                                  <Cell
                                    key={i}
                                    fill={
                                      entry.name === "Male" ? GENDER_COLORS.male :
                                      entry.name === "Female" ? GENDER_COLORS.female :
                                      "hsl(var(--muted-foreground))"
                                    }
                                  />
                                ))}
                              </Pie>
                              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.75rem" }} />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        {/* Summary counts */}
                        <div className="flex justify-center gap-6 mt-2">
                          {stats.genderStats.map(g => (
                            <div key={g.name} className="text-center">
                              <p className="text-xl font-extrabold text-foreground">{g.value}</p>
                              <p className="text-xs text-muted-foreground font-medium">{g.name}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Bottom: Yearly Trends Line Chart */}
                {stats.yearlyTrends.length > 0 && (
                  <Card className="border-0 shadow-md">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <div className="gradient-primary rounded-lg p-1.5"><BarChart3 className="h-4 w-4 text-white" /></div>
                        Yearly Average Trends
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={stats.yearlyTrends} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="year" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                            <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                            <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.75rem" }} formatter={(v: number) => [`${v}%`, "Average"]} />
                            <Line type="monotone" dataKey="average" stroke="hsl(234, 85%, 60%)" strokeWidth={3} dot={{ r: 5, fill: "hsl(234, 85%, 60%)" }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* No data fallback */}
                {stats.subjectAverages.length === 0 && stats.genderStats.length === 0 && (
                  <Card className="border-0 shadow-md">
                    <CardContent className="py-10 text-center text-muted-foreground">No data available for the selected filters</CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <Card className="border-0 shadow-md"><CardContent className="py-10 text-center text-muted-foreground">Loading analytics...</CardContent></Card>
            )}
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col -mx-4 sm:-mx-6 -mt-8 min-h-[calc(100vh-4rem)]">
      <div className="flex items-center gap-3 p-4 border-b lg:hidden">
        <button onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)} className="p-2 rounded-xl bg-muted hover:bg-muted/80 transition-colors">
          <Menu className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-primary" />
          <span className="font-bold text-sm text-foreground">{sidebarItems.find(i => i.id === activeSection)?.label}</span>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {mobileSidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileSidebarOpen(false)} />}

        {/* Desktop sidebar */}
        <aside className={cn("shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex-col transition-all duration-300 hidden lg:flex", sidebarCollapsed ? "w-[68px]" : "w-60")}>
          <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
            {!sidebarCollapsed && <div className="flex items-center gap-2"><Eye className="h-5 w-5 text-sidebar-primary" /><span className="font-bold text-sm">Director</span></div>}
            <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="p-1.5 rounded-lg hover:bg-sidebar-accent transition-colors text-sidebar-foreground/60">
              {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>
          <nav className="flex-1 p-3 space-y-1">
            {sidebarItems.map(({ id, label, icon: Icon }) => {
              const count = getBadgeCount(id);
              return (
                <button key={id} onClick={() => handleNavClick(id)} className={cn("w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all", activeSection === id ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground")}>
                  <Icon className="h-4 w-4 shrink-0" />
                  {!sidebarCollapsed && <><span className="flex-1 text-left">{label}</span>{count !== null && <span className={cn("text-xs font-bold min-w-[20px] text-center rounded-full px-1.5 py-0.5", activeSection === id ? "bg-white/20" : "bg-sidebar-accent")}>{count}</span>}</>}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Mobile sidebar */}
        <aside className={cn("fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col transition-transform duration-300 lg:hidden", mobileSidebarOpen ? "translate-x-0" : "-translate-x-full")}>
          <div className="flex items-center gap-2 p-4 border-b border-sidebar-border"><Eye className="h-5 w-5 text-sidebar-primary" /><span className="font-bold text-sm">Director</span></div>
          <nav className="flex-1 p-3 space-y-1">
            {sidebarItems.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => handleNavClick(id)} className={cn("w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all", activeSection === id ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md" : "text-sidebar-foreground/70 hover:bg-sidebar-accent")}>
                <Icon className="h-4 w-4 shrink-0" /><span className="flex-1 text-left">{label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 min-w-0 p-6 lg:p-8">{renderContent()}</main>
      </div>

      {/* Assign Subjects Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign to {assigningTeacher?.full_name}</DialogTitle>
            <p className="text-xs text-muted-foreground">Configure grades, sections, and subjects</p>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-5 pr-1">
            <div className="space-y-2">
              <p className="text-sm font-semibold">Grade Levels</p>
              <div className="grid grid-cols-4 gap-2">
                {[9,10,11,12].map(g => (
                  <label key={g} className={cn("flex items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all", assignedGradeLevels.includes(g) ? "border-primary bg-primary/10 text-primary font-semibold" : "border-border hover:border-primary/40")}>
                    <Checkbox checked={assignedGradeLevels.includes(g)} onCheckedChange={() => toggleGradeAssignment(g)} className="sr-only" />
                    <span className="text-sm">G{g}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold">Sections</p>
              <div className="grid grid-cols-3 gap-2">
                {["oromo","amharic","somali"].map(s => (
                  <label key={s} className={cn("flex items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all capitalize", assignedSections.includes(s) ? "border-primary bg-primary/10 text-primary font-semibold" : "border-border hover:border-primary/40")}>
                    <Checkbox checked={assignedSections.includes(s)} onCheckedChange={() => toggleSectionAssignment(s)} className="sr-only" />
                    <span className="text-sm">{s}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold">Sub-Sections</p>
              <div className="grid grid-cols-4 gap-2">
                {["A","B","C","D","E","F","G","H"].map(s => (
                  <label key={s} className={cn("flex items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all", assignedSubSections.includes(s) ? "border-primary bg-primary/10 text-primary font-semibold" : "border-border hover:border-primary/40")}>
                    <Checkbox checked={assignedSubSections.includes(s)} onCheckedChange={() => toggleSubSectionAssignment(s)} className="sr-only" />
                    <span className="text-sm">{s}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold">Subjects</p>
              {assignedGradeLevels.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Select grade levels first</p>
              ) : (
                [...assignedGradeLevels].sort().map(grade => {
                  const subs = allSubjects.filter(s => s.grade_level === grade);
                  if (subs.length === 0) return null;
                  const allSelected = subs.every(s => assignedSubjectIds.includes(s.id));
                  return (
                    <div key={grade} className="rounded-xl border overflow-hidden">
                      <button type="button" onClick={() => {
                        if (allSelected) setAssignedSubjectIds(prev => prev.filter(id => !subs.map(s => s.id).includes(id)));
                        else setAssignedSubjectIds(prev => [...new Set([...prev, ...subs.map(s => s.id)])]);
                      }} className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/40 hover:bg-muted/60 transition-colors">
                        <span className="text-xs font-bold text-primary">Grade {grade}</span>
                        <span className="text-xs text-muted-foreground">{allSelected ? "Deselect all" : "Select all"}</span>
                      </button>
                      <div className="divide-y divide-border/50">
                        {subs.map(s => (
                          <label key={s.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/30 cursor-pointer">
                            <Checkbox checked={assignedSubjectIds.includes(s.id)} onCheckedChange={() => toggleSubjectAssignment(s.id)} />
                            <span className="text-sm font-medium flex-1">{s.subject_name}</span>
                            {s.stream && <Badge variant="outline" className="text-[10px] capitalize">{s.stream}</Badge>}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground bg-muted/30 rounded-xl px-3 py-2.5">
            <span><strong className="text-foreground">{assignedGradeLevels.length}</strong> grades</span>
            <span>·</span>
            <span><strong className="text-foreground">{assignedSections.length}</strong> sections</span>
            <span>·</span>
            <span><strong className="text-foreground">{assignedSubSections.length}</strong> sub-sections</span>
            <span>·</span>
            <span><strong className="text-foreground">{assignedSubjectIds.length}</strong> subjects</span>
          </div>
          <div className="flex gap-3">
            <DialogClose asChild><Button variant="outline" className="flex-1 rounded-xl">Cancel</Button></DialogClose>
            <Button onClick={saveAssignments} disabled={savingAssignments} className="flex-1 rounded-xl gradient-primary border-0 text-white">
              {savingAssignments ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <SuccessModal open={!!successModal} onClose={() => setSuccessModal(null)} title={successModal?.title || ""} description={successModal?.description} />
    </div>
  );
}
