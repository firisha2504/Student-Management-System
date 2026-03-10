import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { api } from "@/services/api";

type AppRole = "student" | "teacher" | "admin" | "registrar" | "director" | "parent";

interface Profile {
  user_id: string;
  username?: string;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  date_of_birth: string | null;
  gender: string | null;
  profile_image: string | null;
  is_active: boolean;
  grade_level?: number;
  stream?: string;
}

interface User {
  id: string;
  username: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  systemLocked: boolean;
  signIn: (username: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [systemLocked] = useState(false);

  const loadProfile = async () => {
    try {
      const data = await api.getProfile();
      setUser(data.user);
      setProfile(data.profile);
      setRole(data.role);
    } catch (error) {
      console.error('Failed to load profile:', error);
      setUser(null);
      setProfile(null);
      setRole(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      loadProfile();
    } else {
      setLoading(false);
    }
  }, []);

  const refreshProfile = async () => {
    await loadProfile();
  };

  const signIn = async (username: string, password: string) => {
    try {
      const data = await api.login(username, password);
      setUser(data.user);
      setRole(data.user.role);
      await loadProfile();
      return { error: null };
    } catch (error: any) {
      return { error: error.message || 'Login failed' };
    }
  };

  const signOut = async () => {
    try {
      await api.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
    setUser(null);
    setProfile(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, role, loading, systemLocked, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
