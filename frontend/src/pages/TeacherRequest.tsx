import { useState } from "react";
import { api } from "@/services/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap, Send, CheckCircle2, Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

export default function TeacherRequest() {
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subjectSpecialization, setSubjectSpecialization] = useState("");
  const [qualifications, setQualifications] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim()) {
      toast({ title: "Error", description: "Please enter your full name.", variant: "destructive" });
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      toast({ title: "Error", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    try {
      await api.submitTeacherRequest({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        subject_specialization: subjectSpecialization.trim() || undefined,
        qualifications: qualifications.trim() || undefined,
        experience_years: experienceYears ? parseInt(experienceYears) : undefined,
      });

      setSubmitted(true);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to submit request", variant: "destructive" });
    }
    
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-hero p-4">
        <Card className="w-full max-w-md border-0 shadow-2xl">
          <CardContent className="pt-10 pb-10 text-center space-y-4">
            <div className="mx-auto gradient-accent rounded-2xl p-4 w-fit">
              <CheckCircle2 className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Request Submitted!</h2>
            <p className="text-muted-foreground leading-relaxed text-sm">
              Thank you, <span className="font-semibold text-foreground">{fullName}</span>. Your teacher registration request has been submitted. 
              The admin will review your request and send your login credentials to <span className="font-semibold text-foreground">{email}</span> if approved.
            </p>
            <Button
              onClick={() => window.location.href = "/login"}
              variant="outline"
              className="rounded-xl mt-4"
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-hero p-4 relative overflow-hidden">
      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="absolute top-5 right-5 z-20 bg-white/10 backdrop-blur-sm rounded-xl p-2.5 text-white/70 hover:text-white transition-colors"
      >
        {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
      </button>

      {/* Decorative blobs */}
      <div className="absolute top-[-120px] right-[-80px] w-[400px] h-[400px] rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute bottom-[-100px] left-[-60px] w-[350px] h-[350px] rounded-full bg-accent/10 blur-3xl" />

      <div className="max-w-lg mx-auto pt-8 relative z-10">
        <div className="text-center mb-8">
          <div className="mx-auto gradient-primary rounded-2xl p-4 w-fit mb-5 shadow-lg shadow-primary/25">
            <GraduationCap className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Teacher Registration</h1>
          <p className="text-white/60 mt-1.5 text-sm">Submit your details to request a teacher account</p>
        </div>

        <Card className="border-0 shadow-2xl">
          <CardContent className="pt-8 pb-8 px-6 sm:px-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Personal Info */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Full Name *</Label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                    className="h-11 rounded-xl bg-muted/50"
                    maxLength={255}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Email Address *</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.email@example.com"
                    className="h-11 rounded-xl bg-muted/50"
                    maxLength={255}
                  />
                  <p className="text-xs text-muted-foreground">Your login credentials will be sent to this email if approved</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Phone (Optional)</Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+251 9XX XXX XXXX"
                    className="h-11 rounded-xl bg-muted/50"
                    maxLength={20}
                  />
                </div>
              </div>

              {/* Professional Info */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Subject Specialization (Optional)</Label>
                  <Input
                    value={subjectSpecialization}
                    onChange={(e) => setSubjectSpecialization(e.target.value)}
                    placeholder="e.g., Mathematics, Physics, English"
                    className="h-11 rounded-xl bg-muted/50"
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Years of Experience (Optional)</Label>
                  <Input
                    type="number"
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(e.target.value)}
                    placeholder="e.g., 5"
                    className="h-11 rounded-xl bg-muted/50"
                    min="0"
                    max="50"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Qualifications (Optional)</Label>
                  <Textarea
                    value={qualifications}
                    onChange={(e) => setQualifications(e.target.value)}
                    placeholder="Describe your educational background, certifications, and relevant qualifications..."
                    className="rounded-xl bg-muted/50 min-h-[100px]"
                    maxLength={500}
                  />
                  <p className="text-xs text-muted-foreground">{qualifications.length}/500 characters</p>
                </div>
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-11 rounded-xl gradient-primary border-0 text-white font-semibold shadow-lg shadow-primary/25"
              >
                <Send className="h-4 w-4 mr-2" />
                {submitting ? "Submitting..." : "Submit Registration Request"}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Already have an account?{" "}
                <a href="/login" className="text-primary font-semibold hover:underline">Sign In</a>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
