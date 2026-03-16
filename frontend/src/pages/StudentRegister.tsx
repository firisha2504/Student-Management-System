import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CheckCircle2, GraduationCap, BookOpen, FileText } from "lucide-react";

interface Course {
  id: number;
  subject_name: string;
  subject_code: string;
  credit_hours: number;
  ects: number;
  instructor?: string;
  teachers?: Array<{ name: string; grade_level: number; stream: string }>;
}

interface RegistrationStatus {
  registered: boolean;
  academicYear: string;
  registration?: any;
  courses?: Course[];
}

export default function StudentRegister() {
  const { profile, role } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [registrationStatus, setRegistrationStatus] = useState<RegistrationStatus | null>(null);
  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  const [registering, setRegistering] = useState(false);
  const [successModal, setSuccessModal] = useState(false);
  const [rankingsPublished, setRankingsPublished] = useState(false);
  const [profileIncomplete, setProfileIncomplete] = useState(false);

  useEffect(() => {
    if (profile !== undefined) {
      fetchRegistrationStatus();
    }
  }, [profile]);

  const fetchRegistrationStatus = async () => {
    setLoading(true);
    try {
      const status = await api.getRegistrationStatus();
      setRegistrationStatus(status);
      
      if (!status.registered) {
        // Guard: student must have grade_level set in profile
        if (!profile?.grade_level) {
          setProfileIncomplete(true);
          setLoading(false);
          return;
        }

        // Check if rankings are published for this student's grade
        try {
          const approvalStatus = await api.getRankingApprovalStatus({
            grade_level: profile.grade_level,
            stream: profile.stream || undefined,
          });
          if (!approvalStatus?.approved) {
            setRankingsPublished(false);
            setLoading(false);
            return;
          }
          setRankingsPublished(true);
        } catch {
          setRankingsPublished(false);
          setLoading(false);
          return;
        }

        const allSubjects = await api.getAllSubjects({ 
          grade_level: profile.grade_level,
          stream: profile.stream || undefined,
        });
        setAvailableCourses(allSubjects.slice(0, 7));
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to fetch registration status", variant: "destructive" });
    }
    setLoading(false);
  };

  const handleRegister = async () => {
    if (availableCourses.length === 0) {
      toast({ title: "Error", description: "No courses available", variant: "destructive" });
      return;
    }

    setRegistering(true);
    try {
      const coursesToRegister = availableCourses.map(course => ({
        subject_id: course.id,
        credit_hours: course.credit_hours || 3,
        ects: course.ects || 5,
        instructor: course.teachers && course.teachers.length > 0 ? course.teachers[0].name : 'TBA'
      }));

      await api.registerCourses(coursesToRegister);
      setSuccessModal(true);
      await fetchRegistrationStatus();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to register", variant: "destructive" });
    }
    setRegistering(false);
  };

  if (role !== "student") {
    return <p className="text-destructive">Access denied. This page is for students only.</p>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading registration information...</p>
        </div>
      </div>
    );
  }

  if (registrationStatus?.registered) {
    // Show registration slip
    const { courses } = registrationStatus;
    const totalCreditHours = courses?.reduce((sum, course) => sum + (course.credit_hours || 3), 0) || 0;

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="border-0 shadow-lg">
          <CardHeader className="gradient-primary text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 rounded-xl p-2">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Registration Complete</CardTitle>
                  <p className="text-white/80 text-sm">Academic Year {registrationStatus.academicYear}</p>
                </div>
              </div>
              <Badge className="bg-green-500 text-white border-0">
                REGISTERED SUCCESSFULLY
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {/* Student Info */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-xl">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Name</p>
                <p className="font-semibold">{profile?.full_name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Gender</p>
                <p className="font-semibold capitalize">{profile?.gender || 'M'}</p>
              </div>
            </div>

            {/* Course List */}
            <div>
              <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Registered Courses
              </h3>
              <div className="border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Course Title</TableHead>
                      <TableHead>Course Code</TableHead>
                      <TableHead className="text-center">Cr.Hr</TableHead>
                      <TableHead>Instructor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {courses?.map((course, index) => (
                      <TableRow key={course.id}>
                        <TableCell className="font-medium">{index + 1}</TableCell>
                        <TableCell>{course.subject_name}</TableCell>
                        <TableCell className="font-mono text-sm">{course.subject_code}</TableCell>
                        <TableCell className="text-center">{course.credit_hours || 3}</TableCell>
                        <TableCell>{course.instructor || 'TBA'}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/30 font-bold">
                      <TableCell colSpan={3} className="text-right">Total</TableCell>
                      <TableCell className="text-center">{totalCreditHours}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-6 pt-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Advisor Name and Signature:</p>
                <div className="border-b-2 border-dashed border-muted-foreground/30 pb-1"></div>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Registrar Name and Signature:</p>
                <div className="border-b-2 border-dashed border-muted-foreground/30 pb-1"></div>
              </div>
            </div>

            {/* Note */}
            <div className="text-xs text-muted-foreground italic border-t pt-4">
              This registration slip should not be signed by advisors without checking total credit hours and prerequisite courses.
            </div>

            {/* Print Button */}
            <Button 
              onClick={() => {
                const rows = courses?.map((course, i) => `
                  <tr>
                    <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${i + 1}</td>
                    <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${course.subject_name}</td>
                    <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-family:monospace">${course.subject_code}</td>
                    <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center">${course.credit_hours || 3}</td>
                    <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${course.instructor || 'TBA'}</td>
                  </tr>`).join('') || '';
                const html = `<!DOCTYPE html>
<html><head><title>Registration Slip</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:40px;color:#1a1a1a;max-width:800px;margin:0 auto}
  h1{font-size:20px;margin-bottom:2px}
  .sub{color:#666;font-size:13px;margin-bottom:20px}
  .info{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;padding:12px;background:#f9fafb;border-radius:8px}
  .info-item label{font-size:11px;color:#888;display:block;margin-bottom:2px}
  .info-item span{font-weight:600;font-size:14px}
  table{width:100%;border-collapse:collapse;margin-bottom:20px}
  th{padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#666;border-bottom:2px solid #e5e7eb}
  th:nth-child(4){text-align:center}
  .total-row td{font-weight:bold;background:#f9fafb;padding:8px 10px}
  .sigs{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:24px}
  .sig-line{border-bottom:2px dashed #ccc;padding-bottom:4px;margin-top:24px}
  .sig-label{font-size:12px;color:#666;margin-top:4px}
  .note{font-size:11px;color:#888;font-style:italic;border-top:1px solid #e5e7eb;padding-top:12px;margin-top:12px}
  .badge{display:inline-block;background:#16a34a;color:white;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600}
  @media print{body{padding:20px}}
</style></head><body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start">
    <div><h1>Student Registration Slip</h1><p class="sub">Academic Year ${registrationStatus?.academicYear}</p></div>
    <span class="badge">REGISTERED</span>
  </div>
  <div class="info">
    <div class="info-item"><label>Student Name</label><span>${profile?.full_name || ''}</span></div>
    <div class="info-item"><label>Gender</label><span style="text-transform:capitalize">${profile?.gender || '—'}</span></div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Course Title</th><th>Course Code</th><th style="text-align:center">Cr.Hr</th><th>Instructor</th></tr></thead>
    <tbody>${rows}
      <tr class="total-row"><td colspan="3" style="text-align:right;padding:8px 10px">Total</td><td style="text-align:center;padding:8px 10px">${totalCreditHours}</td><td style="padding:8px 10px"></td></tr>
    </tbody>
  </table>
  <div class="sigs">
    <div><div class="sig-line"></div><p class="sig-label">Advisor Name and Signature</p></div>
    <div><div class="sig-line"></div><p class="sig-label">Registrar Name and Signature</p></div>
  </div>
  <p class="note">This registration slip should not be signed by advisors without checking total credit hours and prerequisite courses.</p>
</body></html>`;
                const w = window.open('', '_blank');
                if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 300); }
              }}
              className="w-full gradient-primary border-0 text-white"
            >
              <FileText className="h-4 w-4 mr-2" />
              Print / Download Registration Slip
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Profile incomplete — student hasn't set grade_level yet
  if (!registrationStatus?.registered && profileIncomplete) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-4">
        <div className="gradient-primary rounded-full p-5 w-20 h-20 mx-auto flex items-center justify-center">
          <GraduationCap className="h-10 w-10 text-white" />
        </div>
        <h2 className="text-2xl font-bold">Complete Your Profile First</h2>
        <p className="text-muted-foreground">
          Please update your profile with your grade level before you can access registration.
        </p>
        <p className="text-sm text-muted-foreground">Go to your profile and fill in your grade information.</p>
      </div>
    );
  }

  // Rankings not published yet — block registration
  if (!registrationStatus?.registered && !rankingsPublished) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-4">
        <div className="gradient-primary rounded-full p-5 w-20 h-20 mx-auto flex items-center justify-center">
          <GraduationCap className="h-10 w-10 text-white" />
        </div>
        <h2 className="text-2xl font-bold">Registration Not Open Yet</h2>
        <p className="text-muted-foreground">
          Your grade rankings have not been published yet. Registration will open once the director approves and publishes the rankings for your grade.
        </p>
        <p className="text-sm text-muted-foreground">Please check back later.</p>
      </div>
    );
  }

  // Show registration form (promotion confirmation)
  const totalCreditHours = availableCourses.reduce((sum, course) => sum + (course.credit_hours || 3), 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="border-0 shadow-md">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="gradient-primary rounded-xl p-2">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle>Student Registration</CardTitle>
              <p className="text-sm text-muted-foreground">Academic Year {registrationStatus?.academicYear}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Promotion Info Card */}
          <div className="p-6 bg-gradient-to-br from-primary/10 to-accent/10 rounded-xl border-2 border-primary/20">
            <div className="flex items-start gap-4">
              <div className="bg-primary rounded-full p-3">
                <GraduationCap className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg mb-2">Confirm Your Registration</h3>
                <p className="text-muted-foreground mb-4">
                  You have been promoted to the next grade level. Please confirm your registration for the academic year {registrationStatus?.academicYear} by clicking the button below.
                </p>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="bg-background/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Student Name</p>
                    <p className="font-semibold">{profile?.full_name}</p>
                  </div>
                  <div className="bg-background/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Student ID</p>
                    <p className="font-semibold font-mono">{profile?.username}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Course List */}
          {availableCourses.length > 0 && (
            <div>
              <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Available Courses for Your Grade
              </h3>
              <div className="border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Course Title</TableHead>
                      <TableHead>Course Code</TableHead>
                      <TableHead className="text-center">Cr.Hr</TableHead>
                      <TableHead>Instructor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {availableCourses.map((course, index) => (
                      <TableRow key={course.id}>
                        <TableCell className="font-medium">{index + 1}</TableCell>
                        <TableCell>{course.subject_name}</TableCell>
                        <TableCell className="font-mono text-sm">{course.subject_code}</TableCell>
                        <TableCell className="text-center">{course.credit_hours || 3}</TableCell>
                        <TableCell>{course.teachers && course.teachers.length > 0 ? course.teachers[0].name : 'TBA'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-3 flex items-center justify-between px-4 py-2 bg-muted/30 rounded-lg">
                <span className="font-semibold">Total:</span>
                <span className="text-sm"><span className="font-semibold">{totalCreditHours}</span> Credit Hours</span>
              </div>
            </div>
          )}

          {/* Warning */}
          <div className="flex items-start gap-3 p-4 bg-warning/10 border border-warning/30 rounded-xl">
            <div className="bg-warning rounded-full p-1 mt-0.5">
              <span className="text-white text-xs font-bold">!</span>
            </div>
            <div>
              <p className="font-semibold text-warning mb-1">Important Notice</p>
              <p className="text-sm text-warning/80">
                By clicking "Register", you confirm your attendance for the academic year {registrationStatus?.academicYear}. 
                If you do not register, the system will mark you as not attending this year.
              </p>
            </div>
          </div>

          {/* Register Button */}
          <Button
            onClick={handleRegister}
            disabled={registering || availableCourses.length === 0}
            className="w-full h-12 text-lg gradient-primary border-0 text-white"
          >
            {registering ? "Registering..." : "Confirm Registration"}
          </Button>
        </CardContent>
      </Card>

      {/* Success Modal */}
      <Dialog open={successModal} onOpenChange={(open) => {
        setSuccessModal(open);
        if (!open) {
          // When modal closes, force a refresh to show the registration slip
          fetchRegistrationStatus();
        }
      }}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-md text-center">
          <DialogHeader className="items-center">
            <div className="mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 p-4">
              <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
            </div>
            <DialogTitle className="text-2xl">Registration Successful!</DialogTitle>
            <DialogDescription className="text-base">
              You have successfully registered for academic year {registrationStatus?.academicYear}.
              Your registration slip is now available.
            </DialogDescription>
          </DialogHeader>
          <Button 
            onClick={() => setSuccessModal(false)} 
            className="w-full gradient-primary border-0 text-white mt-4"
          >
            View Registration Slip
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
