"use client";

import { useStaffSelfData } from "@/lib/hooks/use-staff-self-data";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/loading-state";
import { EmptyState } from "@/components/shared/empty-state";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarDays, Clock, CalendarOff, LogIn, LogOut } from "lucide-react";

const DAY_NAMES = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

export default function MySchedulePage() {
  const { hasStaffRecord } = useAuth();
  const { staff, schedules, leaveRequests, recentEvents, loading } = useStaffSelfData();

  if (loading) {
    return <div><PageHeader title="Ma disponibilité" description="Mon planning et mes horaires" /><LoadingState /></div>;
  }

  if (!hasStaffRecord || !staff) {
    return (
      <div>
        <PageHeader title="Ma disponibilité" />
        <Card className="p-6">
          <EmptyState title="Aucun enregistrement de personnel lié" message="Votre compte n'est pas lié à un enregistrement de personnel." />
        </Card>
      </div>
    );
  }

  const activeSchedules = schedules.filter((s) => s.is_active).sort((a, b) => a.day_of_week - b.day_of_week);
  const approvedLeaves = leaveRequests.filter((r) => r.status === "approved");
  const today = new Date();
  const todayDow = today.getDay();
  const todaySchedule = activeSchedules.find((s) => s.day_of_week === todayDow);

  return (
    <div>
      <PageHeader title="Ma disponibilité" description="Mon planning, mes horaires et mon historique" />

      <div className="space-y-6">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Aujourd'hui — {today.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</h3>
          </div>
          {todaySchedule ? (
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="text-sm">{DAY_NAMES[todayDow]}</Badge>
              <span className="text-sm font-mono">{todaySchedule.start_time.slice(0, 5)} - {todaySchedule.end_time.slice(0, 5)}</span>
              <Badge variant="outline">Tolérance: {todaySchedule.grace_minutes} min</Badge>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun horaire prévu pour aujourd'hui.</p>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Mon planning hebdomadaire</h3>
          {activeSchedules.length === 0 ? (
            <EmptyState title="Aucun horaire" message="Aucun horaire de travail défini pour le moment." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Jour</TableHead>
                    <TableHead>Début</TableHead>
                    <TableHead>Fin</TableHead>
                    <TableHead>Tolérance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeSchedules.map((s) => (
                    <TableRow key={s.id} className={s.day_of_week === todayDow ? "bg-primary/5" : ""}>
                      <TableCell className="font-medium">{DAY_NAMES[s.day_of_week]}</TableCell>
                      <TableCell className="font-mono text-sm">{s.start_time.slice(0, 5)}</TableCell>
                      <TableCell className="font-mono text-sm">{s.end_time.slice(0, 5)}</TableCell>
                      <TableCell><Badge variant="outline">{s.grace_minutes} min</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <CalendarOff className="w-4 h-4 text-purple-600" />
            <h3 className="text-sm font-semibold">Mes congés approuvés</h3>
          </div>
          {approvedLeaves.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Aucun congé approuvé.</p>
          ) : (
            <div className="space-y-2">
              {approvedLeaves.map((l) => (
                <div key={l.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <CalendarOff className="w-4 h-4 text-purple-500" />
                    <span className="text-sm font-medium">
                      {new Date(l.start_date).toLocaleDateString("fr-FR")} — {new Date(l.end_date).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  <Badge variant="outline">{l.leave_type}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-semibold">Mon historique de pointage (30 derniers jours)</h3>
          </div>
          {!recentEvents || recentEvents.length === 0 ? (
            <EmptyState title="Aucun pointage" message="Aucun pointage enregistré sur les 30 derniers jours." />
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {recentEvents.slice(0, 30).map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    {e.event_type === "clock_in" ? (
                      <LogIn className="w-4 h-4 text-green-600" />
                    ) : (
                      <LogOut className="w-4 h-4 text-red-500" />
                    )}
                    <span className="text-sm font-medium">
                      {e.event_type === "clock_in" ? "Entrée" : "Sortie"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{e.method}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(e.server_timestamp).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
