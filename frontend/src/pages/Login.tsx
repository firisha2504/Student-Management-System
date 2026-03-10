import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { GraduationCap, LogIn, AlertTriangle, Eye, EyeOff, Sun, Moon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/hooks/useTheme";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, systemLocked } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await signIn(username, password);
    if (error) {
      toast({ title: "Login Failed", description: error, variant: "destructive" });
    }
    setIsLoading(false);
  };

  if (systemLocked) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-hero p-4">
        <Card className="w-full max-w-md border-0 shadow-2xl">
          <CardContent className="pt-10 pb-10 text-center">
            <div className="mx-auto gradient-warm rounded-2xl p-4 w-fit mb-6">
              <AlertTriangle className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-3">System Locked</h2>
            <p className="text-muted-foreground leading-relaxed">
              The system is currently locked by the administrator.<br />
              Please contact your school admin for access.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center gradient-hero p-4 relative overflow-hidden">
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

      <Card className="w-full max-w-md border-0 shadow-2xl relative z-10">
        <CardContent className="pt-10 pb-8 px-8">
          <div className="text-center mb-8">
            <div className="mx-auto gradient-primary rounded-2xl p-4 w-fit mb-5 shadow-lg shadow-primary/25">
              <GraduationCap className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
              Melka Grade System
            </h1>
            <p className="text-muted-foreground mt-1.5 text-sm">Sign in to your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-semibold">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="h-11 rounded-xl bg-muted/50 border-border/60 focus:bg-card transition-colors"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 rounded-xl bg-muted/50 border-border/60 focus:bg-card transition-colors pr-10"
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
              type="submit"
              className="w-full h-11 rounded-xl gradient-primary border-0 text-white font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all"
              disabled={isLoading}
            >
              <LogIn className="mr-2 h-4 w-4" />
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Contact your administrator if you need an account
          </p>
          <p className="text-center text-xs text-muted-foreground mt-2">
            Are you a teacher?{" "}
            <a href="/teacher-request" className="text-primary font-semibold hover:underline">Register here</a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
