import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Copy, Check } from "lucide-react";
import { useState } from "react";

interface Credential {
  name: string;
  username: string;
  password: string;
}

interface SuccessModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  credentials?: Credential[];
}

export default function SuccessModal({ open, onClose, title, description, credentials }: SuccessModalProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const copyCredential = (cred: Credential, index: number) => {
    navigator.clipboard.writeText(`Username: ${cred.username}\nPassword: ${cred.password}`);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const copyAll = () => {
    if (!credentials) return;
    const text = credentials
      .map(c => `Name: ${c.name}\nUsername: ${c.username}\nPassword: ${c.password}`)
      .join("\n\n");
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md text-center p-8 max-h-[80vh] overflow-y-auto">
        <div className="flex flex-col items-center gap-4">
          <div className="gradient-accent rounded-full p-4">
            <CheckCircle2 className="h-8 w-8 text-white" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-foreground">{title}</h2>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>

          {credentials && credentials.length > 0 && (
            <div className="w-full space-y-3 mt-2 text-left">
              <p className="text-xs text-muted-foreground text-center">
                Share these credentials with the teachers
              </p>
              {credentials.map((cred, i) => (
                <div key={i} className="rounded-xl border bg-muted/30 p-3 space-y-1">
                  <p className="text-sm font-semibold text-foreground">{cred.name}</p>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">
                        Username: <span className="font-mono text-foreground">{cred.username}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Password: <span className="font-mono text-foreground">{cred.password}</span>
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => copyCredential(cred, i)}
                    >
                      {copiedIndex === i ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
              {credentials.length > 1 && (
                <Button
                  variant="outline"
                  className="w-full rounded-xl text-sm"
                  onClick={copyAll}
                >
                  {copiedAll ? (
                    <><Check className="h-4 w-4 mr-2 text-green-500" /> Copied All!</>
                  ) : (
                    <><Copy className="h-4 w-4 mr-2" /> Copy All Credentials</>
                  )}
                </Button>
              )}
            </div>
          )}

          <Button
            onClick={onClose}
            className="w-full rounded-xl gradient-primary border-0 text-white h-10 font-semibold mt-2"
          >
            OK
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
