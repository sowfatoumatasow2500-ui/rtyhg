"use client";

import { useStaffSelfData } from "@/lib/hooks/use-staff-self-data";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/loading-state";
import { EmptyState } from "@/components/shared/empty-state";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getStaffDisplayName, getStaffInitials } from "@/lib/hr/staff-utils";
import {
  LogIn, LogOut, Clock, CalendarOff, QrCode, CalendarDays,
  AlertTriangle, CheckCircle2, Briefcase, Building2,
} from "lucide-react";
import Link from "next/link";

const STATUS_LABELS: Record<string, string> = {
  active: "Actif",
  on_leave: "En congé",
  terminated: "Licencié",
  retired: "Retraité",
};

const EMPLOYMENT_LABELS: Record<string, string> = {
  cdi: "CDI",
  cdd: "CDD",
  internship: "Stage",
  consultant: "Consultant",
};

export default function MyHrDashboardPage() {
  const { hasStaffRecord } = useAuth();
  const { staff, assignments, todayEvents, recentEvents, leaveRequests, schedules, loading } = useStaffSelfData();

  if (loading) {
    return (
      <div>
        <PageHeader title="Mon espace RH" description="Mes informations et mon pointage" />
        <LoadingState />
      </div>
    );
  }

  if (!hasStaffRecord || !staff) {
    return (
      <div>
        <PageHeader title="Mon espace RH" />
        <Card className="p-6">
          <EmptyState
            title="Aucun enregistrement de personnel lié"
            message="Votre compte n'est pas lié à un enregistrement de personnel. Contactez un administrateur RH."
          />
        </Card>
      </div>
    );
  }

  const displayName = getStaffDisplayName(staff);
  const initials = getStaffInitials(staff);
  const todayClockIn = todayEvents.find((e) => e.event_type === "clock_in");
  const todayClockOut = [...todayEvents].reverse().find((e) => e.event_type === "clock_out");
  const isPresent = !!todayClockIn && !todayClockOut;
  const pendingLeaves = leaveRequests.filter((r) => r.status === "pending");
  const approvedLeaves = leaveRequests.filter((r) => r.status === "approved");
  const primaryAssignment = assignments.find((a) => a.is_primary && !a.end_date) ?? assignments[0];

  const formatTime = (ts: string) => new Date(ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div>
      <PageHeader title="Mon espace RH" description="Mes informations, mon pointage et mes congés" />

      <div className="space-y-6">
        {/* Identity card */}
        <Card className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <Avatar className="w-16 h-16">
              {staff.photo_url && <AvatarImage src={staff.photo_url} alt={displayName} />}
              <AvatarFallback className="bg-primary text-white text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-lg font-semibold">{displayName}</h2>
              <p className="text-sm text-muted-foreground">{staff.staff_number}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge variant={staff.status === "active" ? "default" : "secondary"}>
                  {STATUS_LABELS[staff.status] ?? staff.status}
                </Badge>
                {staff.employment_type && (
                  <Badge variant="outline">{EMPLOYMENT_LABELS[staff.employment_type] ?? staff.employment_type}</Badge>
                )}
                {primaryAssignment?.hr_departments?.name && (
                  <Badge variant="outline">
                    <Building2 className="w-3 h-3 mr-1" />
                    {primaryAssignment.hr_departments.name}
                  </Badge>
                )}
                {primaryAssignment?.hr_positions?.name && (
                  <Badge variant="outline">
                    <Briefcase className="w-3 h-3 mr-1" />
                    {primaryAssignment.hr_positions.name}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-4 border-t">
            <div>
              <p className="text-xs text-muted-foreground">Email personnel</p>
              <p className="text-sm font-medium mt-0.5">{staff.personal_email ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Téléphone</p>
              <p className="text-sm font-medium mt-0.5">{staff.personal_phone ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Date d'embauche</p>
              <p className="text-sm font-medium mt-0.5">{new Date(staff.hire_date).toLocaleDateString("fr-FR")}</p>
            </div>
          </div>
        </Card>

        {/* Today's status */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <LogIn className="w-4 h-4 text-green-600" />
              <span className="text-sm font-semibold">Arrivée aujourd'hui</span>
            </div>
            {todayClockIn ? (
              <p className="text-2xl font-bold text-green-600">{formatTime(todayClockIn.server_timestamp)}</p>
            ) : (
              <p className="text-2xl font-bold text-muted-foreground">—</p>
            )}
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <LogOut className="w-4 h-4 text-red-500" />
              <span className="text-sm font-semibold">Départ aujourd'hui</span>
            </div>
            {todayClockOut ? (
              <p className="text-2xl font-bold text-red-500">{formatTime(todayClockOut.server_timestamp)}</p>
            ) : (
              <p className="text-2xl font-bold text-muted-foreground">—</p>
            )}
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-semibold">Statut actuel</span>
            </div>
            {isPresent ? (
              <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-base px-3 py-1">
                <CheckCircle2 className="w-4 h-4 mr-1" /> Présent
              </Badge>
            ) : todayClockOut ? (
              <Badge variant="secondary" className="text-base px-3 py-1">Sorti</Badge>
            ) : (
              <Badge variant="outline" className="text-base px-3 py-1">Non pointé</Badge>
            )}
          </Card>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Button asChild variant="outline" className="h-auto py-4 justify-start">
            <Link href="/app/hr/me/qr">
              <QrCode className="w-5 h-5 mr-3 text-primary" />
              <div className="text-left">
                <p className="text-sm font-medium">Mon QR pointage</p>
                <p className="text-xs text-muted-foreground">Générer mon QR</p>
              </div>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto py-4 justify-start">
            <Link href="/app/hr/me/attendance">
              <Clock className="w-5 h-5 mr-3 text-primary" />
              <div className="text-left">
                <p className="text-sm font-medium">Mon pointage</p>
                <p className="text-xs text-muted-foreground">Historique</p>
              </div>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto py-4 justify-start">
            <Link href="/app/hr/me/leave">
              <CalendarOff className="w-5 h-5 mr-3 text-primary" />
              <div className="text-left">
                <p className="text-sm font-medium">Mes congés</p>
                <p className="text-xs text-muted-foreground">
                  {pendingLeaves.length > 0 ? `${pendingLeaves.length} en attente` : "Demandes"}
                </p>
              </div>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto py-4 justify-start">
            <Link href="/app/hr/me/schedule">
              <CalendarDays className="w-5 h-5 mr-3 text-primary" />
              <div className="text-left">
                <p className="text-sm font-medium">Ma disponibilité</p>
                <p className="text-xs text-muted-foreground">Planning et horaires</p>
              </div>
            </Link>
          </Button>
        </div>

        {/* Pending leaves alert */}
        {pendingLeaves.length > 0 && (
          <Card className="p-4 border-amber-200 bg-amber-50">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <p className="text-sm text-amber-800">
                Vous avez <strong>{pendingLeaves.length}</strong> demande(s) de congé en attente d'approbation.
              </p>
            </div>
          </Card>
        )}

        {/* Recent events */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Mes derniers pointages</h3>
          {todayEvents.length === 0 && recentEvents.length === 0 ? (
            <EmptyState title="Aucun pointage" message="Aucun pointage enregistré récemment." />
          ) : (
            <div className="space-y-2">
              {(recentEvents.length > 0 ? recentEvents : todayEvents).slice(0, 10).map((e) => (
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

        {/* Leave summary */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Mes congés récents</h3>
          {leaveRequests.length === 0 ? (
            <EmptyState title="Aucune demande" message="Aucune demande de congé pour le moment." />
          ) : (
            <div className="space-y-2">
              {leaveRequests.slice(0, 5).map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">
                      {new Date(r.start_date).toLocaleDateString("fr-FR")} — {new Date(r.end_date).toLocaleDateString("fr-FR")}
                    </p>
                    {r.reason && <p className="text-xs text-muted-foreground">{r.reason}</p>}
                  </div>
                  <Badge variant={
                    r.status === "approved" ? "default" :
                    r.status === "pending" ? "secondary" :
                    r.status === "rejected" ? "destructive" : "outline"
                  }>
                    {r.status === "approved" ? "Approuvé" : r.status === "pending" ? "En attente" : r.status === "rejected" ? "Refusé" : "Annulé"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
