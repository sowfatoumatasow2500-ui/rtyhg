"use client";

import { useState, useEffect, useCallback } from "react";
import { useStaffSelfData } from "@/lib/hooks/use-staff-self-data";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/loading-state";
import { EmptyState } from "@/components/shared/empty-state";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase/client";
import { CalendarOff, Plus, Loader as Loader2 } from "lucide-react";

const LEAVE_TYPES: Record<string, string> = {
  vacation: "Congé payé",
  sick: "Maladie",
  personal: "Affaire personnelle",
  unpaid: "Congé sans solde",
  other: "Autre",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  approved: "Approuvé",
  rejected: "Refusé",
  cancelled: "Annulé",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  approved: "bg-green-100 text-green-700 hover:bg-green-100",
  rejected: "bg-red-100 text-red-700 hover:bg-red-100",
  cancelled: "bg-slate-100 text-slate-600 hover:bg-slate-100",
};

export default function MyLeavePage() {
  const { hasStaffRecord, user, profile } = useAuth();
  const { staff, leaveRequests, loading, refresh } = useStaffSelfData();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ leave_type: "vacation", start_date: "", end_date: "", reason: "" });
  const [saving, setSaving] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const handleSave = async () => {
    if (!staff || !profile?.institution_id || !form.start_date || !form.end_date) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("attendance_leave_requests").insert({
        institution_id: profile.institution_id,
        staff_id: staff.id,
        leave_type: form.leave_type,
        start_date: form.start_date,
        end_date: form.end_date,
        reason: form.reason || null,
        status: "pending",
      });
      if (error) throw error;
      toast({ title: "Demande de congé créée" });
      setDialogOpen(false);
      setForm({ leave_type: "vacation", start_date: "", end_date: "", reason: "" });
      refresh();
    } catch (err) {
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Une erreur est survenue", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    try {
      const { error } = await supabase
        .from("attendance_leave_requests")
        .update({ status: "cancelled" })
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Demande annulée" });
      refresh();
    } catch (err) {
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Une erreur est survenue", variant: "destructive" });
    } finally {
      setCancellingId(null);
    }
  };

  if (loading) {
    return <div><PageHeader title="Mes congés" description="Mes demandes de congés" /><LoadingState /></div>;
  }

  if (!hasStaffRecord || !staff) {
    return (
      <div>
        <PageHeader title="Mes congés" />
        <Card className="p-6">
          <EmptyState title="Aucun enregistrement de personnel lié" message="Votre compte n'est pas lié à un enregistrement de personnel." />
        </Card>
      </div>
    );
  }

  const pendingCount = leaveRequests.filter((r) => r.status === "pending").length;

  return (
    <div>
      <PageHeader
        title="Mes congés"
        description="Créer et suivre mes demandes de congés"
        action={<Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 mr-2" /> Nouvelle demande</Button>}
      />

      <div className="space-y-6">
        {pendingCount > 0 && (
          <Card className="p-4 border-amber-200 bg-amber-50">
            <p className="text-sm text-amber-800">
              <strong>{pendingCount}</strong> demande(s) en attente d'approbation.
            </p>
          </Card>
        )}

        <Card className="p-4">
          {leaveRequests.length === 0 ? (
            <EmptyState
              title="Aucune demande"
              message="Aucune demande de congé pour le moment."
              action={<Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 mr-2" /> Nouvelle demande</Button>}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Début</TableHead>
                    <TableHead>Fin</TableHead>
                    <TableHead>Motif</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaveRequests.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell><Badge variant="outline">{LEAVE_TYPES[r.leave_type] ?? r.leave_type}</Badge></TableCell>
                      <TableCell className="text-sm">{new Date(r.start_date).toLocaleDateString("fr-FR")}</TableCell>
                      <TableCell className="text-sm">{new Date(r.end_date).toLocaleDateString("fr-FR")}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{r.reason ?? "—"}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[r.status] ?? ""}>
                          {STATUS_LABELS[r.status] ?? r.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {r.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7 text-destructive"
                            disabled={cancellingId === r.id}
                            onClick={() => handleCancel(r.id)}
                          >
                            {cancellingId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Annuler"}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvelle demande de congé</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Type de congé</Label>
              <Select value={form.leave_type} onValueChange={(v) => setForm({ ...form, leave_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vacation">Congé payé</SelectItem>
                  <SelectItem value="sick">Maladie</SelectItem>
                  <SelectItem value="personal">Affaire personnelle</SelectItem>
                  <SelectItem value="unpaid">Congé sans solde</SelectItem>
                  <SelectItem value="other">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start">Date de début</Label>
                <Input id="start" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end">Date de fin</Label>
                <Input id="end" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Motif (optionnel)</Label>
              <Input id="reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Motif de la demande..." />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Annuler</Button></DialogClose>
            <Button onClick={handleSave} disabled={saving || !form.start_date || !form.end_date}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CalendarOff className="w-4 h-4 mr-2" />}
              Créer la demande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
