import { useState } from "react";
// Supabase removed - replace with your backend API
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap, Send, CheckCircle2, Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

const GRADE_OPTIONS = [9, 10, 11, 12];
const COMMON_SUBJECTS = [
  "Mathematics", "Physics", "Chemistry", "Biology",
  "English", "Amharic", "Afan Oromo", "History",
  "Geography", "Civics", "Economics", "ICT",
  "HPE", "Art",
];

export default function TeacherRequest() {
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedGrades, setSelectedGrades] = useState<number[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [customSubject, setCustomSubject] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const toggleGrade = (g: number) => {
    setSelectedGrades(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  };

  const toggleSubject = (s: string) => {
    setSelectedSubjects(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const addCustomSubject = () => {
    const trimmed = customSubject.trim();
    if (trimmed && !selectedSubjects.includes(trimmed)) {
      setSelectedSubjects(prev => [...prev, trimmed]);
      setCustomSubject("");
    }
  };

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
    if (selectedGrades.length === 0) {
      toast({ title: "Error", description: "Please select at least one grade level.", variant: "destructive" });
      return;
    }
    if (selectedSubjects.length === 0) {
      toast({ title: "Error", description: "Please select at least one subject.", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.from("teacher_requests" as any).insert({
      full_name: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim() || null,
      subject_names: selectedSubjects,
      grade_levels: selectedGrades.sort((a, b) => a - b),
      status: "pending",
    } as any);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setSubmitted(true);
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
              The admin will review your request and send your login credentials to <span className="font-semibold text-foreground">{email}</span>.
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
                    maxLength={100}
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
                  <p className="text-xs text-muted-foreground">Your login credentials will be sent to this email</p>
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

              {/* Grade Levels */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Grade Levels You Can Teach *</Label>
                <div className="grid grid-cols-4 gap-2">
                  {GRADE_OPTIONS.map(g => (
                    <label key={g} className="flex items-center gap-2 p-2.5 rounded-xl border hover:bg-muted/50 cursor-pointer transition-colors">
                      <Checkbox
                        checked={selectedGrades.includes(g)}
                        onCheckedChange={() => toggleGrade(g)}
                      />
                      <span className="text-sm font-medium">Grade {g}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Subjects */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Subjects You Can Teach *</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {COMMON_SUBJECTS.map(s => (
                    <label key={s} className="flex items-center gap-2 p-2 rounded-xl hover:bg-muted/50 cursor-pointer transition-colors">
                      <Checkbox
                        checked={selectedSubjects.includes(s)}
                        onCheckedChange={() => toggleSubject(s)}
                      />
                      <span className="text-sm">{s}</span>
                    </label>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    placeholder="Add other subject..."
                    className="rounded-xl"
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomSubject())}
                  />
                  <Button type="button" variant="outline" className="rounded-xl shrink-0" onClick={addCustomSubject}>
                    Add
                  </Button>
                </div>
                {selectedSubjects.filter(s => !COMMON_SUBJECTS.includes(s)).map(s => (
                  <span key={s} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium px-2.5 py-1 rounded-full mr-1">
                    {s}
                    <button type="button" onClick={() => toggleSubject(s)} className="ml-1 text-primary/60 hover:text-primary">✕</button>
                  </span>
                ))}
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
