import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Lock, GraduationCap, Info, Eye, EyeOff } from "lucide-react";
import SuccessModal from "@/components/SuccessModal";

export default function Register() {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [gradeLevel, setGradeLevel] = useState<string>(profile?.grade_level?.toString() || "");
  const [stream, setStream] = useState<string>(profile?.stream || "");
  const [section, setSection] = useState<string>((profile as any)?.section || "");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [successModal, setSuccessModal] = useState<{ title: string; description?: string } | null>(null);

  const showSuccess = (title: string, description?: string) => setSuccessModal({ title, description });

  const hasGradeSet = !!profile?.grade_level;
  const needsStream = gradeLevel === "11" || gradeLevel === "12";
  
  // Student promoted to grade 11+ but hasn't picked a stream yet
  const needsStreamSelection = hasGradeSet && (profile?.grade_level === 11 || profile?.grade_level === 12) && !profile?.stream;

  const handleSaveProfile = async () => {
    if (hasGradeSet) return; // Already locked

    if (!gradeLevel) {
      toast({ title: "Error", description: "Please select a grade level.", variant: "destructive" });
      return;
    }
    if (needsStream && !stream) {
      toast({ title: "Error", description: "Please select a stream.", variant: "destructive" });
      return;
    }
    if (!section) {
      toast({ title: "Error", description: "Please select a section.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const updates: any = {
        grade_level: parseInt(gradeLevel),
        section,
      };
      
      if (needsStream) {
        updates.stream = stream;
      }

      // Update student profile via backend API
      await api.updateProfile(updates);
      
      showSuccess("Success", "Grade level saved! This cannot be changed.");
      await refreshProfile();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      // Note: Backend requires current password, but for student self-service we'll need to add a field
      // For now, show a message that they need to contact admin
      toast({ 
        title: "Contact Admin", 
        description: "Please contact your administrator to change your password.",
        variant: "default"
      });
      setNewPassword("");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Grade Selection - locked after first save */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className={`rounded-xl p-1.5 ${hasGradeSet ? "bg-muted" : "gradient-primary"}`}>
              <GraduationCap className="h-4 w-4 text-white" />
            </div>
            Grade & Stream
            {hasGradeSet && (
              <Badge variant="secondary" className="ml-auto text-xs">
                <Lock className="h-3 w-3 mr-1" /> Locked
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Username</Label>
            <Input value={profile?.username || ""} disabled className="bg-muted/50" />
          </div>

          {hasGradeSet ? (
            <>
              <div className="space-y-2">
                <Label>Grade Level</Label>
                <Input value={`Grade ${profile?.grade_level}`} disabled className="bg-muted/50" />
              </div>
              {(profile as any)?.section && (
                <div className="space-y-2">
                  <Label>Section</Label>
                  <Input value={(profile as any).section.charAt(0).toUpperCase() + (profile as any).section.slice(1)} disabled className="bg-muted/50" />
                </div>
              )}
              {profile?.stream ? (
                <div className="space-y-2">
                  <Label>Stream</Label>
                  <Input value={profile.stream.charAt(0).toUpperCase() + profile.stream.slice(1)} disabled className="bg-muted/50" />
                </div>
              ) : needsStreamSelection ? (
                <div className="space-y-2">
                  <Label>Stream <span className="text-destructive">*</span></Label>
                  <Select value={stream} onValueChange={setStream}>
                    <SelectTrigger><SelectValue placeholder="Select stream" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Science">Natural Science</SelectItem>
                      <SelectItem value="Arts">Social Science</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-start gap-2 rounded-xl bg-warning/10 p-3">
                    <Info className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                    <p className="text-sm text-warning font-medium">
                      ⚠️ You've been promoted to Grade {profile?.grade_level}! Please select your stream. This cannot be changed later.
                    </p>
                  </div>
                  <Button
                    onClick={async () => {
                      if (!stream) {
                        toast({ title: "Error", description: "Please select a stream.", variant: "destructive" });
                        return;
                      }
                      setSaving(true);
                      try {
                        await api.updateProfile({ stream });
                        showSuccess("Success", "Stream saved!");
                        await refreshProfile();
                      } catch (error: any) {
                        toast({ title: "Error", description: error.message || "Failed to save stream", variant: "destructive" });
                      } finally {
                        setSaving(false);
                      }
                    }}
                    disabled={saving}
                    className="w-full gradient-primary border-0 text-white"
                  >
                    {saving ? "Saving..." : "Save Stream"}
                  </Button>
                </div>
              ) : null}
              {!needsStreamSelection && (
                <div className="flex items-start gap-2 rounded-xl bg-muted/50 p-3">
                  <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    Grade and stream are locked after first selection. Contact your admin if you need to change them.
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Grade Level</Label>
                <Select value={gradeLevel} onValueChange={(v) => { setGradeLevel(v); if (v !== "11" && v !== "12") setStream(""); }}>
                  <SelectTrigger><SelectValue placeholder="Select grade" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="9">Grade 9</SelectItem>
                    <SelectItem value="10">Grade 10</SelectItem>
                    <SelectItem value="11">Grade 11</SelectItem>
                    <SelectItem value="12">Grade 12</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {needsStream && (
                <div className="space-y-2">
                  <Label>Stream</Label>
                  <Select value={stream} onValueChange={setStream}>
                    <SelectTrigger><SelectValue placeholder="Select stream" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Science">Science</SelectItem>
                      <SelectItem value="Arts">Arts</SelectItem>
                      <SelectItem value="Commerce">Commerce</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Section</Label>
                <Select value={section} onValueChange={setSection}>
                  <SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="oromo">Oromo</SelectItem>
                    <SelectItem value="amharic">Amharic</SelectItem>
                    <SelectItem value="somali">Somali</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-start gap-2 rounded-xl bg-warning/10 p-3">
                <Info className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                <p className="text-sm text-warning font-medium">
                  ⚠️ Choose carefully! Once saved, your grade and stream cannot be changed.
                </p>
              </div>
              <Button onClick={handleSaveProfile} disabled={saving} className="w-full gradient-primary border-0 text-white">
                {saving ? "Saving..." : "Save Grade & Stream"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Password Change - always available */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="gradient-accent rounded-xl p-1.5">
              <Lock className="h-4 w-4 text-white" />
            </div>
            Change Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>New Password</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 6 chars)"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button onClick={handleChangePassword} disabled={saving} className="w-full gradient-accent border-0 text-white">
            Change Password
          </Button>
        </CardContent>
      </Card>

      <SuccessModal
        open={!!successModal}
        onClose={() => setSuccessModal(null)}
        title={successModal?.title || ""}
        description={successModal?.description}
      />
    </div>
  );
}
