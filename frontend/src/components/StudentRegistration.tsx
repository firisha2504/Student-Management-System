import { useEffect, useState } from "react";
// Supabase removed - replace with your backend API
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ClipboardList, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Subject {
  id: string;
  subject_name: string;
  grade_level: number;
  stream: string | null;
}

export default function StudentRegistration() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [registeredAt, setRegisteredAt] = useState<string | null>(null);
  const [hasPromotion, setHasPromotion] = useState(false);
  const [promotionInfo, setPromotionInfo] = useState<{ old_grade: number; new_grade: number | null; status: string; academic_year: string } | null>(null);

  const currentYear = (() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    return month >= 8 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
  })();

  useEffect(() => {
    if (!user || !profile) return;

    const fetchData = async () => {
      // Check if student has been promoted (has a promotion_history record)
      const { data: promoData } = await supabase
        .from("promotion_history")
        .select("old_grade, new_grade, status, academic_year")
        .eq("student_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (promoData && (promoData.status === "promoted" || promoData.status === "retained")) {
        setHasPromotion(true);
        setPromotionInfo(promoData);
      }

      // Check if already registered for current academic year
      const { data: regData } = await supabase
        .from("student_registrations")
        .select("*")
        .eq("student_id", user.id)
        .eq("academic_year", currentYear)
        .maybeSingle();

      if (regData) {
        setIsRegistered(true);
        setRegisteredAt(regData.registered_at);
      }

      // Fetch subjects for student's grade
      if (profile.grade_level) {
        let query = supabase.from("subjects").select("*").eq("grade_level", profile.grade_level);
        if (profile.grade_level >= 11 && profile.stream) {
          query = query.eq("stream", profile.stream);
        } else {
          query = query.is("stream", null);
        }
        const { data: subjectData } = await query;
        setSubjects(subjectData || []);
      }
      setLoading(false);
    };
    fetchData();
  }, [user, profile, currentYear]);

  const handleRegister = async () => {
    if (!user || !profile) return;
    setRegistering(true);

    const { error } = await supabase.from("student_registrations").insert({
      student_id: user.id,
      academic_year: currentYear,
      grade_level: profile.grade_level!,
      stream: profile.stream || null,
      section: profile.section || null,
    });

    if (error) {
      toast({ title: "Registration failed", description: error.message, variant: "destructive" });
    } else {
      setIsRegistered(true);
      setRegisteredAt(new Date().toISOString());
      toast({ title: "Registered Successfully!", description: `You are now registered for ${currentYear}.` });
    }
    setRegistering(false);
  };

  if (loading) {
    return <p className="text-muted-foreground p-6">Loading...</p>;
  }

  // If student has not been promoted yet, show a message
  if (!hasPromotion && !isRegistered) {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="p-8 text-center">
          <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-bold text-foreground mb-2">Registration Not Available</h3>
          <p className="text-muted-foreground text-sm">
            You have not been promoted yet. Registration will be available after the year-end promotion process is completed by the administrator.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Registration Header */}
      <Card className="border-0 shadow-md overflow-hidden">
        <div className="gradient-hero p-6 sm:p-8 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-white/10 rounded-xl p-2">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold">Course Registration</h2>
              <p className="text-white/60 text-sm">
                Academic Year {currentYear} · Grade {profile?.grade_level}
                {profile?.stream ? ` · ${profile.stream.charAt(0).toUpperCase() + profile.stream.slice(1)}` : ""}
              </p>
              {promotionInfo && (
                <p className="text-white/80 text-xs mt-1">
                  {promotionInfo.status === "promoted" 
                    ? `Promoted from Grade ${promotionInfo.old_grade} → Grade ${promotionInfo.new_grade}`
                    : `Retained at Grade ${promotionInfo.new_grade}`
                  } ({promotionInfo.academic_year})
                </p>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Registration Slip */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-6">
          {/* Student Info */}
          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div>
              <span className="text-muted-foreground">Name:</span>{" "}
              <span className="font-semibold text-foreground">{profile?.full_name}</span>
            </div>
            <div>
              <span className="text-muted-foreground">ID:</span>{" "}
              <span className="font-semibold text-foreground">{profile?.id_number}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Grade:</span>{" "}
              <span className="font-semibold text-foreground">{profile?.grade_level}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Section:</span>{" "}
              <span className="font-semibold text-foreground capitalize">{profile?.section || "—"}</span>
            </div>
          </div>

          {/* Subjects Table */}
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold w-12">#</TableHead>
                <TableHead className="font-semibold">Subject</TableHead>
                <TableHead className="font-semibold">Grade Level</TableHead>
                <TableHead className="font-semibold">Stream</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subjects.map((sub, idx) => (
                <TableRow key={sub.id}>
                  <TableCell className="text-sm">{idx + 1}</TableCell>
                  <TableCell className="text-sm font-medium">{sub.subject_name}</TableCell>
                  <TableCell className="text-sm">Grade {sub.grade_level}</TableCell>
                  <TableCell className="text-sm">{sub.stream ? sub.stream.charAt(0).toUpperCase() + sub.stream.slice(1) : "—"}</TableCell>
                </TableRow>
              ))}
              {subjects.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No subjects found for your grade level.
                  </TableCell>
                </TableRow>
              )}
              <TableRow className="bg-muted/30 font-semibold">
                <TableCell colSpan={2} className="text-right text-sm">Total Subjects</TableCell>
                <TableCell className="text-sm font-bold">{subjects.length}</TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>

          {/* Register Button / Success State */}
          <div className="mt-6 flex flex-col items-center gap-3">
            {isRegistered ? (
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-6 w-6" />
                  <span className="text-lg font-extrabold uppercase">Registered Successfully</span>
                </div>
                {registeredAt && (
                  <p className="text-xs text-muted-foreground">
                    Registered on {new Date(registeredAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                  </p>
                )}
              </div>
            ) : (
              <Button
                onClick={handleRegister}
                disabled={registering || subjects.length === 0}
                size="lg"
                className="gradient-primary text-white font-bold px-8"
              >
                {registering ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Registering...
                  </>
                ) : (
                  "Register for This Year"
                )}
              </Button>
            )}
          </div>

          {/* Footer note */}
          <p className="text-xs text-muted-foreground mt-4 text-center italic">
            This registration slip should not be considered complete without advisor verification.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
