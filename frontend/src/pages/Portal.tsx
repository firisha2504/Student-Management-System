import { useAuth } from "@/hooks/useAuth";
import StudentPortal from "@/components/StudentPortal";
import TeacherPortal from "@/components/TeacherPortal";

export default function Portal() {
  const { role } = useAuth();

  if (role === "student") return <StudentPortal />;
  if (role === "teacher") return <TeacherPortal />;

  return <p className="text-muted-foreground">Access denied.</p>;
}
