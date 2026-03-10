import { useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/services/api";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { User, CreditCard, ShieldCheck, Pencil, Save, X, Lock, CheckCircle2, Camera, AtSign, Eye, EyeOff } from "lucide-react";

export default function About() {
  const { profile, role, user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newLoginUsername, setNewLoginUsername] = useState("");
  const [changingLogin, setChangingLogin] = useState(false);
  const [successModal, setSuccessModal] = useState<{ open: boolean; title: string; message: string }>({ 
    open: false, title: "", message: "" 
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = role === "admin" || role === "registrar" || role === "director";
  const initials = profile?.full_name?.split(" ").map((n) => n[0]).join("").toUpperCase() || "?";

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Error", description: "Please select an image file.", variant: "destructive" });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Error", description: "Image must be less than 2MB.", variant: "destructive" });
      return;
    }

    setUploadingImage(true);
    try {
      await api.uploadProfileImage(file);
      setSuccessModal({ 
        open: true, 
        title: "Photo Updated", 
        message: "Your profile photo has been updated successfully." 
      });
      await refreshProfile();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to upload image", variant: "destructive" });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      toast({ title: "Error", description: "Full name is required.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await api.updateProfile({ full_name: fullName.trim() });
      setSuccessModal({ 
        open: true, 
        title: "Profile Updated", 
        message: "Your profile has been updated successfully." 
      });
      await refreshProfile();
      setEditing(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to update profile", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFullName(profile?.full_name || "");
    setEditing(false);
  };

  const infoItems = [
    { icon: User, label: "Full Name", value: profile?.full_name, editable: true },
    { icon: User, label: "Username", value: user?.username, editable: isAdmin },
    { icon: CreditCard, label: "ID Number", value: user?.username, editable: isAdmin },
    { icon: ShieldCheck, label: "Status", value: profile?.is_active ? "Active" : "Inactive", editable: false },
  ];

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />

      {/* Profile Header */}
      <Card className="border-0 shadow-md overflow-hidden">
        <div className="gradient-hero h-28 relative">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
            <div className="relative group">
              <Avatar className="h-24 w-24 border-4 border-card shadow-xl">
                <AvatarImage src={profile?.profile_image || undefined} />
                <AvatarFallback className="gradient-primary text-white text-2xl font-extrabold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                <Camera className="h-6 w-6 text-white" />
              </button>
              {profile?.profile_image && (
                <button
                  onClick={async () => {
                    if (!user) return;
                    setUploadingImage(true);
                    try {
                      await api.deleteProfileImage();
                      setSuccessModal({ 
                        open: true, 
                        title: "Photo Removed", 
                        message: "Your profile photo has been removed." 
                      });
                      await refreshProfile();
                    } catch (error: any) {
                      toast({ title: "Error", description: error.message || "Failed to remove image", variant: "destructive" });
                    } finally {
                      setUploadingImage(false);
                    }
                  }}
                  disabled={uploadingImage}
                  className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-md z-10"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
        <CardContent className="pt-16 pb-6 text-center">
          <h1 className="text-2xl font-extrabold text-foreground">{profile?.full_name}</h1>
          <Badge className="mt-2 gradient-primary border-0 text-white capitalize text-xs px-3 py-0.5">
            {role}
          </Badge>
          {!editing && (
            <p className="text-xs text-muted-foreground mt-2">Hover on photo to change</p>
          )}
        </CardContent>
      </Card>

      {/* Profile Details */}
      <Card className="border-0 shadow-md">
        <CardContent className="pt-6 divide-y divide-border">
          {infoItems.map(({ icon: Icon, label, value, editable }) => (
            <div key={label} className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0">
              <div className="bg-muted rounded-xl p-2.5">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
                {editing && editable && label === "Full Name" ? (
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="mt-1 h-8 text-sm font-semibold"
                  />
                ) : (
                  <p className="font-semibold text-foreground">{value || "—"}</p>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Edit / Save Buttons */}
      <div className="flex gap-3">
        {editing ? (
          <>
            <Button onClick={handleCancel} variant="outline" className="flex-1 rounded-xl" disabled={saving}>
              <X className="h-4 w-4 mr-1.5" /> Cancel
            </Button>
            <Button onClick={handleSave} className="flex-1 rounded-xl gradient-primary border-0 text-white" disabled={saving}>
              <Save className="h-4 w-4 mr-1.5" /> {saving ? "Saving..." : "Save Changes"}
            </Button>
          </>
        ) : (
          <Button onClick={() => setEditing(true)} className="w-full rounded-xl gradient-primary border-0 text-white">
            <Pencil className="h-4 w-4 mr-1.5" /> Edit Profile
          </Button>
        )}
      </div>

      {/* Change Password */}
      <Card className="border-0 shadow-md">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="gradient-accent rounded-xl p-2.5">
              <Lock className="h-4 w-4 text-white" />
            </div>
            <p className="font-bold text-foreground">Change Password</p>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Current Password</Label>
            <div className="relative">
              <Input
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">New Password</Label>
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
          <Button
            onClick={async () => {
              if (!currentPassword) {
                toast({ title: "Error", description: "Current password is required.", variant: "destructive" });
                return;
              }
              if (newPassword.length < 6) {
                toast({ title: "Error", description: "New password must be at least 6 characters.", variant: "destructive" });
                return;
              }
              setChangingPassword(true);
              try {
                await api.changePassword(currentPassword, newPassword);
                setSuccessModal({ 
                  open: true, 
                  title: "Password Changed", 
                  message: "Your password has been changed successfully." 
                });
                setCurrentPassword("");
                setNewPassword("");
              } catch (error: any) {
                toast({ title: "Error", description: error.message || "Failed to change password", variant: "destructive" });
              } finally {
                setChangingPassword(false);
              }
            }}
            disabled={changingPassword}
            className="w-full rounded-xl gradient-accent border-0 text-white"
          >
            {changingPassword ? "Changing..." : "Change Password"}
          </Button>
        </CardContent>
      </Card>

      {/* Change Login Username - Admin only */}
      {isAdmin && (
        <Card className="border-0 shadow-md">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="gradient-warm rounded-xl p-2.5">
                <AtSign className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="font-bold text-foreground">Change Login Username</p>
                <p className="text-xs text-muted-foreground">Current: {user?.username || "—"}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">New Login Username</Label>
              <Input
                value={newLoginUsername}
                onChange={(e) => setNewLoginUsername(e.target.value)}
                placeholder="Enter new login username"
              />
            </div>
            <Button
              onClick={async () => {
                if (!newLoginUsername.trim()) {
                  toast({ title: "Error", description: "Username cannot be empty.", variant: "destructive" });
                  return;
                }
                setChangingLogin(true);
                try {
                  await api.changeUsername(newLoginUsername.trim());
                  setSuccessModal({ 
                    open: true, 
                    title: "Username Updated", 
                    message: `Your username has been changed to ${newLoginUsername.trim()}. Please use this username for your next login.` 
                  });
                  await refreshProfile();
                  setNewLoginUsername("");
                } catch (error: any) {
                  toast({ title: "Error", description: error.message || "Failed to change username", variant: "destructive" });
                } finally {
                  setChangingLogin(false);
                }
              }}
              disabled={changingLogin}
              className="w-full rounded-xl gradient-warm border-0 text-white"
            >
              {changingLogin ? "Updating..." : "Update Login Username"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Success Modal */}
      <Dialog open={successModal.open} onOpenChange={(open) => setSuccessModal(prev => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-sm text-center">
          <DialogHeader className="items-center">
            <div className="mx-auto mb-2 rounded-full bg-green-100 dark:bg-green-900/30 p-3">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <DialogTitle className="text-xl">{successModal.title}</DialogTitle>
            <DialogDescription>{successModal.message}</DialogDescription>
          </DialogHeader>
          <DialogClose asChild>
            <Button className="w-full rounded-xl gradient-primary border-0 text-white mt-2">Done</Button>
          </DialogClose>
        </DialogContent>
      </Dialog>
    </div>
  );
}
