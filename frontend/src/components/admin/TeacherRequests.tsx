import { useEffect, useState } from "react";
import { api } from "@/services/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Trash2, Eye, Mail, Phone, GraduationCap, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

interface TeacherRequest {
  id: number;
  full_name: string;
  email: string;
  phone: string | null;
  subject_specialization: string | null;
  qualifications: string | null;
  experience_years: number | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_at: string | null;
  reviewed_by_name: string | null;
}

interface Props {
  onUserCreated: () => void;
}

export default function TeacherRequests({ onUserCreated }: Props) {
  const { toast } = useToast();
  const [requests, setRequests] = useState<TeacherRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [viewingRequest, setViewingRequest] = useState<TeacherRequest | null>(null);
  const [processing, setProcessing] = useState(false);
  const [credentialsDialog, setCredentialsDialog] = useState<{ username: string; password: string; id_number: string } | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const data = await api.getTeacherRequests(filterStatus);
      setRequests(data || []);
    } catch (error: any) {
      console.error('Failed to fetch teacher requests:', error);
      toast({ title: "Error", description: "Failed to load requests", variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, [filterStatus]);

  const handleApprove = async (requestId: number) => {
    setProcessing(true);
    try {
      const result = await api.approveTeacherRequest(requestId);
      toast({ title: "Success", description: "Teacher account created successfully" });
      
      // Show credentials
      setCredentialsDialog({
        username: result.username,
        password: result.password,
        id_number: result.id_number
      });
      
      setViewingRequest(null);
      fetchRequests();
      onUserCreated();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to approve request", variant: "destructive" });
    }
    setProcessing(false);
  };

  const handleReject = async (requestId: number) => {
    setProcessing(true);
    try {
      await api.rejectTeacherRequest(requestId);
      toast({ title: "Success", description: "Request rejected" });
      setViewingRequest(null);
      fetchRequests();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to reject request", variant: "destructive" });
    }
    setProcessing(false);
  };

  const handleDelete = async (requestId: number) => {
    if (!confirm('Are you sure you want to delete this request?')) return;
    
    setProcessing(true);
    try {
      await api.deleteTeacherRequest(requestId);
      toast({ title: "Success", description: "Request deleted" });
      setViewingRequest(null);
      fetchRequests();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to delete request", variant: "destructive" });
    }
    setProcessing(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">Pending</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">Approved</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Teacher Requests</h2>
        <p className="text-sm text-muted-foreground">Manage teacher account requests</p>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant={filterStatus === 'pending' ? 'default' : 'outline'}
          onClick={() => setFilterStatus('pending')}
          className={cn("rounded-xl", filterStatus === 'pending' && "gradient-primary border-0 text-white")}
        >
          Pending
        </Button>
        <Button
          variant={filterStatus === 'approved' ? 'default' : 'outline'}
          onClick={() => setFilterStatus('approved')}
          className={cn("rounded-xl", filterStatus === 'approved' && "gradient-accent border-0 text-white")}
        >
          Approved
        </Button>
        <Button
          variant={filterStatus === 'rejected' ? 'default' : 'outline'}
          onClick={() => setFilterStatus('rejected')}
          className={cn("rounded-xl", filterStatus === 'rejected' && "bg-red-500 border-0 text-white hover:bg-red-600")}
        >
          Rejected
        </Button>
        <Button
          variant={filterStatus === '' ? 'default' : 'outline'}
          onClick={() => setFilterStatus('')}
          className="rounded-xl"
        >
          All
        </Button>
      </div>

      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-center text-muted-foreground">Loading...</p>
          ) : requests.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">No requests found</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/20">
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Specialization</TableHead>
                    <TableHead>Experience</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map(req => (
                    <TableRow key={req.id} className="hover:bg-muted/30">
                      <TableCell className="font-semibold">{req.full_name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{req.email}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{req.phone || '—'}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{req.subject_specialization || '—'}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {req.experience_years ? `${req.experience_years} yrs` : '—'}
                      </TableCell>
                      <TableCell>{getStatusBadge(req.status)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(req.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setViewingRequest(req)}
                            className="rounded-lg text-xs"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {req.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleApprove(req.id)}
                                disabled={processing}
                                className="rounded-lg text-xs gradient-accent border-0 text-white"
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleReject(req.id)}
                                disabled={processing}
                                className="rounded-lg text-xs"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                          {req.status !== 'pending' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDelete(req.id)}
                              disabled={processing}
                              className="rounded-lg text-xs text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Request Dialog */}
      <Dialog open={!!viewingRequest} onOpenChange={() => setViewingRequest(null)}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Request Details</DialogTitle>
          </DialogHeader>
          {viewingRequest && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <GraduationCap className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-muted-foreground">Full Name</p>
                    <p className="text-base font-semibold">{viewingRequest.full_name}</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-muted-foreground">Email</p>
                    <p className="text-base">{viewingRequest.email}</p>
                  </div>
                </div>
                
                {viewingRequest.phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">Phone</p>
                      <p className="text-base">{viewingRequest.phone}</p>
                    </div>
                  </div>
                )}
                
                {viewingRequest.subject_specialization && (
                  <div className="flex items-start gap-3">
                    <GraduationCap className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">Subject Specialization</p>
                      <p className="text-base">{viewingRequest.subject_specialization}</p>
                    </div>
                  </div>
                )}
                
                {viewingRequest.experience_years !== null && (
                  <div className="flex items-start gap-3">
                    <Briefcase className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">Experience</p>
                      <p className="text-base">{viewingRequest.experience_years} years</p>
                    </div>
                  </div>
                )}
                
                {viewingRequest.qualifications && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Qualifications</p>
                    <p className="text-sm bg-muted/30 rounded-lg p-3">{viewingRequest.qualifications}</p>
                  </div>
                )}
                
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    {getStatusBadge(viewingRequest.status)}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm text-muted-foreground">Submitted</span>
                    <span className="text-sm">{new Date(viewingRequest.created_at).toLocaleString()}</span>
                  </div>
                  {viewingRequest.reviewed_at && (
                    <>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm text-muted-foreground">Reviewed</span>
                        <span className="text-sm">{new Date(viewingRequest.reviewed_at).toLocaleString()}</span>
                      </div>
                      {viewingRequest.reviewed_by_name && (
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-sm text-muted-foreground">Reviewed By</span>
                          <span className="text-sm">{viewingRequest.reviewed_by_name}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {viewingRequest.status === 'pending' && (
                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={() => handleApprove(viewingRequest.id)}
                    disabled={processing}
                    className="flex-1 rounded-xl gradient-accent border-0 text-white"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {processing ? "Processing..." : "Approve & Create Account"}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleReject(viewingRequest.id)}
                    disabled={processing}
                    className="flex-1 rounded-xl"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </div>
              )}
              
              {viewingRequest.status !== 'pending' && (
                <Button
                  variant="outline"
                  onClick={() => handleDelete(viewingRequest.id)}
                  disabled={processing}
                  className="w-full rounded-xl text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Request
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Credentials Dialog */}
      <Dialog open={!!credentialsDialog} onOpenChange={() => setCredentialsDialog(null)}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Teacher Account Created</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The teacher account has been created successfully. Please share these credentials with the teacher:
            </p>
            
            <div className="bg-muted/30 rounded-xl p-4 space-y-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">ID Number</p>
                <p className="text-lg font-mono font-bold">{credentialsDialog?.id_number}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Username</p>
                <p className="text-lg font-mono font-bold">{credentialsDialog?.username}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Password</p>
                <p className="text-lg font-mono font-bold">{credentialsDialog?.password}</p>
              </div>
            </div>
            
            <p className="text-xs text-amber-600 bg-amber-500/10 rounded-lg p-3">
              ⚠️ Make sure to save these credentials. They cannot be retrieved later.
            </p>
            
            <DialogClose asChild>
              <Button className="w-full rounded-xl gradient-primary border-0 text-white">
                Close
              </Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
