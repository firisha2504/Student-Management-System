import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Upload, Shield, Users, GraduationCap, BarChart3, TrendingUp, ArrowRight, ClipboardList, Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface Stats {
  totalStudents: number;
  totalTeachers: number;
  totalGrades: number;
  avgScore: number;
  subjectAverages: { name: string; average: number }[];
  // teacher-specific
  assignedSubjects?: number;
  assignedGrades?: number[];
  assignedSections?: string[];
}

export default function Home() {
  const { profile, role } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (role === "parent") {
        setLoading(false);
        return;
      }

      try {
        if (role === "student") {
          // Students get their own stats
          const data = await api.getStudentStats();
          setStats({
            totalStudents: 0,
            totalTeachers: 0,
            totalGrades: data.totalGrades || 0,
            avgScore: data.avgScore || 0,
            subjectAverages: []
          });
        } else if (role === "teacher") {
          const data = await api.getMyAssignments();
          setStats({
            totalStudents: 0,
            totalTeachers: 0,
            totalGrades: 0,
            avgScore: 0,
            subjectAverages: [],
            assignedSubjects: data.subjects?.length || 0,
            assignedGrades: data.grades || [],
            assignedSections: data.sections || [],
          });
        } else if (["admin", "director", "registrar"].includes(role || "")) {
          // Admin, director, registrar get full dashboard stats
          const data = await api.getDashboardStats();
          
          const totalStudents = data.users?.student || 0;
          const totalTeachers = data.users?.teacher || 0;
          const totalGrades = data.grades?.total_grades || 0;
          const avgScore = data.grades?.average_score ? Math.round(data.grades.average_score) : 0;
          
          const subjectAverages = (data.subjectAverages || [])
            .map((s: any) => ({
              name: s.subject_name,
              average: Math.round(s.average_score)
            }))
            .sort((a: any, b: any) => b.average - a.average);

          setStats({ totalStudents, totalTeachers, totalGrades, avgScore, subjectAverages });
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
      
      setLoading(false);
    };

    fetchStats();
  }, [role]);

  const getWelcomeMessage = () => {
    switch (role) {
      case "student": return "Check your grades, view your courses, and manage your profile.";
      case "teacher": return "Upload student grades and track academic progress.";
      case "admin": return "Manage accounts, system settings, and oversee the platform.";
      case "registrar": return "Register students, manage profiles, and link parent accounts.";
      case "director": return "Monitor academic performance, assign teachers, and view rankings.";
      case "parent": return "View your child's grades, scores, and academic progress.";
      default: return "";
    }
  };

  return (
    <div className="space-y-8">
      <div className="gradient-hero rounded-2xl p-8 sm:p-10 text-white relative overflow-hidden">
        <div className="absolute top-[-50px] right-[-30px] w-[200px] h-[200px] rounded-full bg-white/5 blur-2xl" />
        <div className="relative z-10">
          <p className="text-white/60 text-sm font-medium mb-1">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Welcome back, {profile?.full_name?.split(" ")[0] || "User"} 👋
          </h1>
          <p className="text-white/70 mt-2 text-base max-w-lg">
            {getWelcomeMessage()}
          </p>
        </div>
      </div>

      {/* Stats - visible to admin, director, registrar */}
      {!loading && stats && ["admin", "director", "registrar"].includes(role || "") && (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Students", value: stats.totalStudents, icon: GraduationCap, gradient: "gradient-primary" },
            { label: "Teachers", value: stats.totalTeachers, icon: Users, gradient: "gradient-accent" },
            { label: "Grades", value: stats.totalGrades, icon: BarChart3, gradient: "gradient-warm" },
            { label: "Avg Score", value: stats.avgScore > 0 ? `${stats.avgScore}%` : "—", icon: TrendingUp, gradient: "gradient-primary" },
          ].map(({ label, value, icon: Icon, gradient }) => (
            <Card key={label} className="border-0 shadow-md hover:shadow-lg transition-shadow">
              <CardContent className="pt-6 pb-5 flex items-center gap-4">
                <div className={`${gradient} rounded-xl p-3 shadow-lg`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
                  <p className="text-2xl font-extrabold text-foreground">{value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Teacher stats */}
      {!loading && stats && role === "teacher" && (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
          {[
            { label: "Subjects Assigned", value: stats.assignedSubjects ?? 0, icon: BookOpen, gradient: "gradient-primary" },
            { label: "Grades Assigned", value: stats.assignedGrades?.map(g => `G${g}`).join(", ") || "—", icon: GraduationCap, gradient: "gradient-accent" },
            { label: "Sections Assigned", value: stats.assignedSections?.length ? stats.assignedSections.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(", ") : "—", icon: Users, gradient: "gradient-warm" },
          ].map(({ label, value, icon: Icon, gradient }) => (
            <Card key={label} className="border-0 shadow-md hover:shadow-lg transition-shadow">
              <CardContent className="pt-6 pb-5 flex items-center gap-4">
                <div className={`${gradient} rounded-xl p-3 shadow-lg`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
                  <p className="text-xl font-extrabold text-foreground">{value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Student stats - limited */}
      {!loading && stats && role === "student" && (
        <div className="grid gap-4 grid-cols-2">
          <Card className="border-0 shadow-md">
            <CardContent className="pt-6 pb-5 flex items-center gap-4">
              <div className="gradient-warm rounded-xl p-3 shadow-lg">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Grade Level</p>
                <p className="text-2xl font-extrabold text-foreground">
                  {profile?.grade_level ? `Grade ${profile.grade_level}` : "—"}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="pt-6 pb-5 flex items-center gap-4">
              <div className="gradient-primary rounded-xl p-3 shadow-lg">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Avg Score</p>
                <p className="text-2xl font-extrabold text-foreground">{stats.avgScore > 0 ? `${stats.avgScore}%` : "—"}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Chart - for admin, director */}
      {!loading && stats && stats.subjectAverages.length > 0 && ["admin", "director"].includes(role || "") && (
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="gradient-primary rounded-lg p-1.5">
                <BarChart3 className="h-4 w-4 text-white" />
              </div>
              Average Score per Subject
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.subjectAverages} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="name" 
                    angle={-35} 
                    textAnchor="end" 
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} 
                  />
                  <YAxis 
                    domain={[0, 100]} 
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} 
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))", 
                      borderRadius: "0.75rem" 
                    }} 
                    formatter={(v: number) => [`${v}%`, "Average"]} 
                  />
                  <Bar dataKey="average" fill="url(#barGradient)" radius={[6, 6, 0, 0]} />
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(234 85% 60%)" />
                      <stop offset="100%" stopColor="hsl(262 80% 60%)" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-bold text-foreground mb-4">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {role === "student" && (
            <>
              <ActionCard 
                to="/portal" 
                icon={BookOpen} 
                gradient="gradient-primary" 
                title="View Grades" 
                description="Check your scores for all subjects" 
              />
              <ActionCard 
                to="/register" 
                icon={Users} 
                gradient="gradient-accent" 
                title="Update Profile" 
                description="Update your grade level and stream" 
              />
            </>
          )}

          {role === "teacher" && (
            <ActionCard 
              to="/portal" 
              icon={Upload} 
              gradient="gradient-primary" 
              title="Upload Grades" 
              description="Enter scores for your students" 
            />
          )}

          {role === "admin" && (
            <>
              <ActionCard 
                to="/admin" 
                icon={Shield} 
                gradient="gradient-primary" 
                title="Admin Panel" 
                description="Create accounts and manage system" 
              />
              <ActionCard 
                to="/admin" 
                icon={Users} 
                gradient="gradient-accent" 
                title="Manage Users" 
                description="Activate, deactivate, and manage accounts" 
              />
            </>
          )}

          {role === "registrar" && (
            <>
              <ActionCard 
                to="/registrar" 
                icon={ClipboardList} 
                gradient="gradient-primary" 
                title="Register Students" 
                description="Add new students and manage profiles" 
              />
              <ActionCard 
                to="/registrar" 
                icon={Users} 
                gradient="gradient-accent" 
                title="Student List" 
                description="View and edit student records" 
              />
            </>
          )}

          {role === "director" && (
            <>
              <ActionCard 
                to="/director" 
                icon={Eye} 
                gradient="gradient-primary" 
                title="Director Dashboard" 
                description="Monitor teachers and academic performance" 
              />
              <ActionCard 
                to="/director" 
                icon={BarChart3} 
                gradient="gradient-accent" 
                title="View Rankings" 
                description="See student rankings by grade" 
              />
            </>
          )}

          {role === "parent" && (
            <ActionCard 
              to="/parent" 
              icon={BookOpen} 
              gradient="gradient-primary" 
              title="View Child's Grades" 
              description="See your child's academic progress" 
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ActionCard({ 
  to, 
  icon: Icon, 
  gradient, 
  title, 
  description 
}: { 
  to: string; 
  icon: any; 
  gradient: string; 
  title: string; 
  description: string 
}) {
  return (
    <Link to={to}>
      <Card className="border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-pointer group">
        <CardContent className="pt-6 pb-5 flex items-start gap-4">
          <div className={`${gradient} rounded-xl p-3 shadow-lg`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-foreground flex items-center gap-1">
              {title}
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
