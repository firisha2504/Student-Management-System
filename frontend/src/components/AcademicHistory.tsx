import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { History } from "lucide-react";

interface AcademicHistoryProps {
  studentId: string;
  studentName?: string;
}

export default function AcademicHistory({ studentId }: AcademicHistoryProps) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Academic history feature is not yet implemented
    // This will be added when the backend API for academic year archiving is ready
    setLoading(false);
  }, [studentId]);

  if (loading) {
    return <p className="text-muted-foreground text-center py-6">Loading academic history...</p>;
  }

  return (
    <Card className="border-0 shadow-md">
      <CardContent className="py-10 text-center">
        <History className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">No academic history available yet.</p>
        <p className="text-xs text-muted-foreground mt-1">Results will appear here after each academic year is archived.</p>
      </CardContent>
    </Card>
  );
}
