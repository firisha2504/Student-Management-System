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

  const getCurrentAcademicYear = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-11
    // Academic year starts in September (month 8)
    return month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
  };

  const currentAcademicYear = getCurrentAcademicYear();

  // Check if registration is needed
  const needsRegistration = () => {
    // Grade 12 students never need registration
    if (profile?.grade_level === 12) {
      return false;
    }

    // If no registration status, they need to register
    if (!registrationStatus?.registered) {
      return true;
    }

    // If registered for a different academic year, they need to register for current year
    if (registrationStatus.registration?.academic_year !== currentAcademicYear) {
      return true;
    }

    // Already registered for current academic year
    return false;
  };

  // Grade 12 students don't need registration
  if (profile?.grade_level === 12) {
    return (
      <div className="space-y-6">
        <Card className="border-0 shadow-md overflow-hidden">
          <div className="gradient-hero p-6 sm:p-8 text-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-white/10 rounded-xl p-2">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold">Registration Complete</h2>
                <p className="text-white/60 text-sm">
                  Grade 12 · Final Year
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
                <h3 className="text-xl font-bold text-foreground">No Registration Required</h3>
                <p className="text-muted-foreground max-w-md">
                  As a Grade 12 student, you are already registered for your final year courses. 
                  Focus on your studies and prepare for your final exams!
                </p>
              </div>
              <div className="bg-muted/50 rounded-xl p-4 mt-4">
                <p className="text-sm text-muted-foreground">
                  <strong>Good luck with your final year!</strong> 🎓
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  useEffect(() => {
    if (!user || !profile) return;

    const fetchData = async () => {
      try {
        setLoading(true);

        // Check registration status
        const statusData = await api.getRegistrationStatus();
        setRegistrationStatus(statusData);

        // Fetch available courses for student's grade
        if (profile.grade_level) {
          const filters: any = { grade_level: profile.grade_level };
          if (profile.grade_level >= 11 && profile.stream) {
            filters.stream = profile.stream;
          }

          const subjectsData = await api.getAllSubjects(filters);
          setSubjects(subjectsData);
        }
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
  }, [user, profile, toast]);

  const handleRegister = async () => {
    if (!user || !profile || subjects.length === 0) return;

    setRegistering(true);

    try {
      // Prepare courses for registration
      const courses = subjects.map(subject => ({
        subject_id: subject.id,
        credit_hours: subject.credit_hours,
        ects: subject.ects,
        instructor: "TBA",
      }));

      await api.registerCourses(courses);

      // Refresh registration status
      const statusData = await api.getRegistrationStatus();
      setRegistrationStatus(statusData);

      toast({
        title: "Registered Successfully!",
        description: `You are now registered for ${currentAcademicYear}.`,
      });
    } catch (error: any) {
      console.error("Registration error:", error);
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

  // Check if student needs registration
  if (!needsRegistration()) {
    const registration = registrationStatus?.registration;
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
              {registration && (
                <div className="bg-muted/50 rounded-xl p-4 mt-4 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    <strong>Registration Details:</strong>
                  </p>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>Registered: {new Date(registration.registration_date).toLocaleDateString()}</span>
                    <span>Credit Hours: {registration.total_credit_hours}</span>
                    <span>ECTS: {registration.total_ects}</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if registration is open
  const [registrationOpen, setRegistrationOpen] = useState<any>(null);
  const [checkingRegistrationStatus, setCheckingRegistrationStatus] = useState(true);

  useEffect(() => {
    const checkRegistrationOpen = async () => {
      try {
        const openStatus = await api.isRegistrationOpen();
        setRegistrationOpen(openStatus);
      } catch (error) {
        console.error('Failed to check registration status:', error);
      } finally {
        setCheckingRegistrationStatus(false);
      }
    };
    
    checkRegistrationOpen();
  }, []);

  if (checkingRegistrationStatus) {
    return <p className="text-muted-foreground p-6">Checking registration status...</p>;
  }

  // Registration is closed
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
                <p className="text-white/60 text-sm">
                  Academic Year Registration
                </p>
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
                      : "Registration is currently not available."
                  }
                </p>
              </div>
              {registrationOpen?.startDate && registrationOpen?.endDate && (
                <div className="bg-muted/50 rounded-xl p-4 mt-4 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    <strong>Registration Period:</strong>
                  </p>
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

  const isRegistered = registrationStatus?.registered || false;
  const registration = registrationStatus?.registration;

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
                Academic Year {currentAcademicYear} · Grade {profile?.grade_level}
                {profile?.stream
                  ? ` · ${profile.stream.charAt(0).toUpperCase() + profile.stream.slice(1)}`
                  : ""}
              </p>
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
              <span className="text-muted-foreground">Username:</span>{" "}
              <span className="font-semibold text-foreground">{user?.username}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Grade:</span>{" "}
              <span className="font-semibold text-foreground">{profile?.grade_level}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Stream:</span>{" "}
              <span className="font-semibold text-foreground capitalize">
                {profile?.stream || "—"}
              </span>
            </div>
          </div>

          {/* Subjects Table */}
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold w-12">#</TableHead>
                <TableHead className="font-semibold">Subject</TableHead>
                <TableHead className="font-semibold">Code</TableHead>
                <TableHead className="font-semibold text-center">Credit Hrs</TableHead>
                <TableHead className="font-semibold text-center">ECTS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subjects.map((sub, idx) => (
                <TableRow key={sub.id}>
                  <TableCell className="text-sm">{idx + 1}</TableCell>
                  <TableCell className="text-sm font-medium">{sub.subject_name}</TableCell>
                  <TableCell className="text-sm">{sub.subject_code}</TableCell>
                  <TableCell className="text-sm text-center">{sub.credit_hours}</TableCell>
                  <TableCell className="text-sm text-center">{sub.ects}</TableCell>
                </TableRow>
              ))}
              {subjects.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No subjects found for your grade level.
                  </TableCell>
                </TableRow>
              )}
              <TableRow className="bg-muted/30 font-semibold">
                <TableCell colSpan={2} className="text-right text-sm">
                  Total
                </TableCell>
                <TableCell className="text-sm font-bold">{subjects.length} subjects</TableCell>
                <TableCell className="text-sm text-center font-bold">
                  {subjects.reduce((sum, s) => sum + s.credit_hours, 0)} hrs
                </TableCell>
                <TableCell className="text-sm text-center font-bold">
                  {subjects.reduce((sum, s) => sum + s.ects, 0)} ECTS
                </TableCell>
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
                {registration?.registration_date && (
                  <p className="text-xs text-muted-foreground">
                    Registered on{" "}
                    {new Date(registration.registration_date).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                )}
                <div className="flex gap-4 text-xs text-muted-foreground mt-2">
                  <span>
                    Total Credit Hours: <strong>{registration?.total_credit_hours || 0}</strong>
                  </span>
                  <span>
                    Total ECTS: <strong>{registration?.total_ects || 0}</strong>
                  </span>
                </div>
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
