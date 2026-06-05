import { useEffect, useState } from "react";
import { api } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ClipboardList, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Subject {
  id: number;
  subject_name: string;
  subject_code: string;
  grade_level: number;
  stream: string | null;
  credit_hours: number;
  ects: number;
}

interface RegistrationStatus {
  registered: boolean;
  academicYear?: string;
  registration?: {
    id: number;
    academic_year: string;
    registration_date: string;
    total_credit_hours: number;
    total_ects: number;
  };
}

export default function StudentRegistration() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [registrationStatus, setRegistrationStatus] = useState<RegistrationStatus | null>(null);
  const [currentAcademicYear, setCurrentAcademicYear] = useState<string>("");
  const [registrationOpen, setRegistrationOpen] = useState<any>(null);

  useEffect(() => {
    if (!user || !profile) return;

    const fetchData = async () => {
      try {
        setLoading(true);

        // Always get the current academic year from the system (not hardcoded)
        const [yearData, statusData, openStatus] = await Promise.all([
          api.getCurrentAcademicYear(),
          api.getRegistrationStatus(),
          api.isRegistrationOpen(),
        ]);

        const sysYear = yearData?.academic_year || "";
        setCurrentAcademicYear(sysYear);
        setRegistrationStatus(statusData);
        setRegistrationOpen(openStatus);

        // Fetch subjects for the student's current grade/stream
        // The backend already returns the correct grade's subjects
        const coursesData = await api.getAvailableCourses();
        setSubjects(coursesData.subjects || []);

      } catch (error) {
        console.error("Error fetching registration data:", error);
        toast({
          title: "Error",
          description: "Failed to load registration data",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, profile]);

  const handleRegister = async () => {
    if (!user || !profile || subjects.length === 0) return;
    setRegistering(true);
    try {
      const courses = subjects.map(subject => ({
        subject_id: subject.id,
        credit_hours: subject.credit_hours,
        ects: subject.ects,
        instructor: "TBA",
      }));

      await api.registerCourses(courses);

      const [statusData, openStatus] = await Promise.all([
        api.getRegistrationStatus(),
        api.isRegistrationOpen(),
      ]);
      setRegistrationStatus(statusData);
      setRegistrationOpen(openStatus);

      toast({
        title: "Registered Successfully!",
        description: `You are now registered for ${currentAcademicYear}.`,
      });
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.message || "Failed to register for courses",
        variant: "destructive",
      });
    } finally {
      setRegistering(false);
    }
  };

  if (loading) {
    return <p className="text-muted-foreground p-6">Loading...</p>;
  }

  // Already registered for current year
  if (registrationStatus?.registered &&
      registrationStatus.registration?.academic_year === currentAcademicYear) {
    const reg = registrationStatus.registration;
    return (
      <div className="space-y-6">
        <Card className="border-0 shadow-md overflow-hidden">
          <div className="gradient-hero p-6 sm:p-8 text-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-white/10 rounded-xl p-2">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold">Already Registered</h2>
                <p className="text-white/60 text-sm">
                  Academic Year {currentAcademicYear} · Grade {profile?.grade_level}
                  {profile?.stream ? ` · ${profile.stream.charAt(0).toUpperCase() + profile.stream.slice(1)}` : ""}
                </p>
              </div>
            </div>
          </div>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="p-8 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="bg-emerald-500/10 rounded-full p-4">
                <CheckCircle2 className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-foreground">Registration Complete</h3>
                <p className="text-muted-foreground max-w-md">
                  You are already registered for the {currentAcademicYear} academic year.
                  Registration will be available again when the new academic year begins.
                </p>
              </div>
              {reg && (
                <div className="bg-muted/50 rounded-xl p-4 mt-4 space-y-2">
                  <p className="text-sm text-muted-foreground"><strong>Registration Details:</strong></p>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>Registered: {new Date(reg.registration_date).toLocaleDateString()}</span>
                    <span>Credit Hours: {reg.total_credit_hours}</span>
                    <span>ECTS: {reg.total_ects}</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Registration closed
  if (!registrationOpen?.isOpen) {
    return (
      <div className="space-y-6">
        <Card className="border-0 shadow-md overflow-hidden">
          <div className="gradient-hero p-6 sm:p-8 text-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-white/10 rounded-xl p-2">
                <ClipboardList className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold">Registration Closed</h2>
                <p className="text-white/60 text-sm">Academic Year Registration</p>
              </div>
            </div>
          </div>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="p-8 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="bg-amber-500/10 rounded-full p-4">
                <ClipboardList className="h-12 w-12 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-foreground">Registration Period Closed</h3>
                <p className="text-muted-foreground max-w-md">
                  {!registrationOpen?.manuallyOpen
                    ? "Registration has been closed by the registrar."
                    : !registrationOpen?.isInPeriod
                    ? "Registration period has ended."
                    : "Registration is currently not available."}
                </p>
              </div>
              {registrationOpen?.startDate && registrationOpen?.endDate && (
                <div className="bg-muted/50 rounded-xl p-4 mt-4 space-y-2">
                  <p className="text-sm text-muted-foreground"><strong>Registration Period:</strong></p>
                  <div className="text-xs text-muted-foreground">
                    <p>Start: {new Date(registrationOpen.startDate).toLocaleDateString()}</p>
                    <p>End: {new Date(registrationOpen.endDate).toLocaleDateString()}</p>
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-4">
                Contact the registrar's office for more information.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Registration form
  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-0 shadow-md overflow-hidden">
        <div className="gradient-hero p-6 sm:p-8 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-white/10 rounded-xl p-2">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold">Student Registration</h2>
              <p className="text-white/60 text-sm">
                Academic Year {currentAcademicYear}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Confirmation notice */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-6">
          <div className="flex items-start gap-3 mb-6 p-4 rounded-xl bg-primary/5 border border-primary/20">
            <ClipboardList className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-sm text-foreground">Confirm Your Registration</p>
              <p className="text-xs text-muted-foreground mt-1">
                You have been promoted to the next grade level. Please confirm your registration for the
                academic year {currentAcademicYear} by clicking the button below.
              </p>
              <div className="flex gap-6 mt-3 text-xs text-muted-foreground">
                <span>Student Name: <strong className="text-foreground">{profile?.full_name}</strong></span>
                <span>Student ID: <strong className="text-foreground">{profile?.admission_number}</strong></span>
              </div>
            </div>
          </div>

          {/* Subjects table */}
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            Available Courses for Your Grade
          </h3>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold w-12">#</TableHead>
                <TableHead className="font-semibold">Course Title</TableHead>
                <TableHead className="font-semibold">Course Code</TableHead>
                <TableHead className="font-semibold text-center">Cr.Hr</TableHead>
                <TableHead className="font-semibold">Instructor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subjects.map((sub, idx) => (
                <TableRow key={sub.id}>
                  <TableCell className="text-sm">{idx + 1}</TableCell>
                  <TableCell className="text-sm font-medium">{sub.subject_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{sub.subject_code}</TableCell>
                  <TableCell className="text-sm text-center">{sub.credit_hours}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">Teacher</TableCell>
                </TableRow>
              ))}
              {subjects.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No subjects found for your grade level. Contact the admin.
                  </TableCell>
                </TableRow>
              )}
              <TableRow className="bg-muted/30 font-semibold">
                <TableCell colSpan={3} className="text-right text-sm">Total:</TableCell>
                <TableCell className="text-sm text-center font-bold">
                  {subjects.reduce((sum, s) => sum + s.credit_hours, 0)} Credit Hours
                </TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>

          {/* Important notice */}
          <div className="mt-4 p-3 rounded-xl bg-muted/30 border border-border/50">
            <p className="text-xs font-semibold text-foreground mb-1">Important Notice</p>
            <p className="text-xs text-muted-foreground">
              By clicking "Register", you confirm your attendance for the academic year {currentAcademicYear}.
              If you do not register, the system will mark you as not attending this year.
            </p>
          </div>

          <div className="mt-6 flex justify-center">
            <Button
              onClick={handleRegister}
              disabled={registering || subjects.length === 0}
              size="lg"
              className="gradient-primary text-white font-bold px-10"
            >
              {registering ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Registering...
                </>
              ) : (
                "Register"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
