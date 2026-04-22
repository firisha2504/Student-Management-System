import { ReactNode, useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useSchoolInfo } from "@/contexts/SchoolConfigContext";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/NavLink";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Home, BookOpen, User, Shield, LogOut, GraduationCap, Sun, Moon, ClipboardList, Eye as EyeIcon, Users, FileCheck } from "lucide-react";
import { api, getAssetUrl } from "@/services/api";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { profile, role, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const schoolInfo = useSchoolInfo();
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);

  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const settings = await api.getSystemSettings();
        if (settings.school_logo) {
          setSchoolLogo(getAssetUrl(settings.school_logo));
        }
      } catch (error) {
        console.error('Failed to fetch school logo:', error);
      }
    };
    fetchLogo();
  }, []);

  const initials = profile?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "?";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-2.5">
            {schoolLogo ? (
              <img src={schoolLogo} alt="School Logo" className="h-8 w-8 object-contain rounded-lg" />
            ) : (
              <div className="gradient-primary rounded-xl p-1.5">
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
            )}
            <span className="font-extrabold text-lg tracking-tight text-foreground">{schoolInfo.name}</span>
          </div>

          <nav className="flex items-center gap-0.5">
            <NavLink to="/" icon={<Home className="h-4 w-4" />} label="Home" />
            {role === "student" && (
              <>
                <NavLink to="/portal" icon={<BookOpen className="h-4 w-4" />} label="My Grades" />
                {/* Hide Register link for Grade 12 students and students already registered for current year */}
                {profile?.grade_level !== 12 && (
                  <NavLink to="/student-register" icon={<FileCheck className="h-4 w-4" />} label="Register" />
                )}
              </>
            )}
            {role === "teacher" && (
              <NavLink to="/portal" icon={<BookOpen className="h-4 w-4" />} label="Upload Grades" />
            )}
            {role === "admin" && (
              <NavLink to="/admin" icon={<Shield className="h-4 w-4" />} label="Admin" />
            )}
            {role === "registrar" && (
              <NavLink to="/registrar" icon={<ClipboardList className="h-4 w-4" />} label="Registrar" />
            )}
            {role === "director" && (
              <NavLink to="/director" icon={<EyeIcon className="h-4 w-4" />} label="Director" />
            )}
            {role === "parent" && (
              <NavLink to="/parent" icon={<Users className="h-4 w-4" />} label="My Child" />
            )}
            <NavLink to="/about" icon={<User className="h-4 w-4" />} label="Profile" />
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2.5">
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile?.profile_image || undefined} />
                <AvatarFallback className="gradient-primary text-white text-xs font-bold">{initials}</AvatarFallback>
              </Avatar>
              <div className="text-right">
                <p className="text-sm font-semibold text-foreground leading-none">{profile?.full_name}</p>
                <p className="text-xs text-muted-foreground capitalize">{role}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-xl text-muted-foreground hover:bg-muted transition-colors">
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut} className="rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}
