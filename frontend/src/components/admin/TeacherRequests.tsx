import { Card, CardContent } from "@/components/ui/card";
import { ClipboardList } from "lucide-react";

interface Props {
  onUserCreated: () => void;
}

export default function TeacherRequests({ onUserCreated }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Teacher Requests</h2>
        <p className="text-sm text-muted-foreground">Manage teacher account requests</p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="pt-6 pb-6 text-center">
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="bg-muted rounded-full p-4">
              <ClipboardList className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">Teacher Requests Coming Soon</p>
              <p className="text-sm text-muted-foreground max-w-md">
                This feature allows teachers to submit requests for accounts. 
                Admins can review and approve/reject requests here.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
