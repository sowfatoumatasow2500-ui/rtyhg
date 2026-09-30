"use client";

import { useState, useEffect, useCallback } from "react";
import { useStaffSelfData } from "@/lib/hooks/use-staff-self-data";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/loading-state";
import { EmptyState } from "@/components/shared/empty-state";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LogIn, LogOut, MapPin, Clock } from "lucide-react";

const METHOD_LABELS: Record<string, string> = {
  employee_qr: "QR Employé",
  terminal_qr: "QR Terminal",
  fingerprint: "Empreinte",
  manual: "Saisie manuelle",
};

export default function MyAttendancePage() {
  const { hasStaffRecord } = useAuth();
  const { staff, recentEvents, loading, refresh } = useStaffSelfData();
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split("T")[0]);
  const [filteredEvents, setFilteredEvents] = useState<typeof recentEvents>([]);

  const fetchDay = useCallback(async () => {
    if (!staff) return;
    const dayStart = new Date(dateFilter + "T00:00:00");
    const dayEnd = new Date(dateFilter + "T23:59:59");
    const { supabase } = await import("@/lib/supabase/client");
    const { data } = await supabase
      .from("attendance_events")
      .select("*")
      .eq("staff_id", staff.id)
      .gte("server_timestamp", dayStart.toISOString())
      .lte("server_timestamp", dayEnd.toISOString())
      .order("server_timestamp", { ascending: false });
    setFilteredEvents(data ?? []);
  }, [staff, dateFilter]);

  useEffect(() => {
    if (staff) fetchDay();
  }, [fetchDay, staff]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading) {
    return <div><PageHeader title="Mon pointage" description="Historique de mes entrées et sorties" /><LoadingState /></div>;
  }

  if (!hasStaffRecord || !staff) {
    return (
      <div>
        <PageHeader title="Mon pointage" />
        <Card className="p-6">
          <EmptyState title="Aucun enregistrement de personnel lié" message="Votre compte n'est pas lié à un enregistrement de personnel." />
        </Card>
      </div>
    );
  }

  const events = dateFilter === new Date().toISOString().split("T")[0] ? recentEvents : filteredEvents;
  const clockIn = events.find((e) => e.event_type === "clock_in");
  const clockOut = [...events].reverse().find((e) => e.event_type === "clock_out");
  const isPresent = !!clockIn && !clockOut;

  const formatTime = (ts: string) => new Date(ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div>
      <PageHeader title="Mon pointage" description="Historique de mes entrées et sorties" />

      <div className="space-y-6">
        {/* Today's status */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <LogIn className="w-4 h-4 text-green-600" />
              <span className="text-sm font-semibold">Arrivée</span>
            </div>
            {clockIn ? (
              <p className="text-2xl font-bold text-green-600">{formatTime(clockIn.server_timestamp)}</p>
            ) : (
              <p className="text-2xl font-bold text-muted-foreground">—</p>
            )}
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <LogOut className="w-4 h-4 text-red-500" />
              <span className="text-sm font-semibold">Départ</span>
            </div>
            {clockOut ? (
              <p className="text-2xl font-bold text-red-500">{formatTime(clockOut.server_timestamp)}</p>
            ) : (
              <p className="text-2xl font-bold text-muted-foreground">—</p>
            )}
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-semibold">Statut</span>
            </div>
            {isPresent ? (
              <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-base px-3 py-1">Présent</Badge>
            ) : clockOut ? (
              <Badge variant="secondary" className="text-base px-3 py-1">Sorti</Badge>
            ) : (
              <Badge variant="outline" className="text-base px-3 py-1">Non pointé</Badge>
            )}
          </Card>
        </div>

        {/* Date filter */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">Date :</span>
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full sm:w-[180px]"
            />
          </div>
        </Card>

        {/* Events table */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">
            Pointages du {new Date(dateFilter).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </h3>
          {events.length === 0 ? (
            <EmptyState title="Aucun pointage" message={`Aucun pointage enregistré pour le ${new Date(dateFilter).toLocaleDateString("fr-FR")}.`} />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Heure</TableHead>
                    <TableHead>Méthode</TableHead>
                    <TableHead>Localisation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>
                        {e.event_type === "clock_in" ? (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                            <LogIn className="w-3 h-3 mr-1" /> Entrée
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                            <LogOut className="w-3 h-3 mr-1" /> Sortie
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm font-mono">{formatTime(e.server_timestamp)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{METHOD_LABELS[e.method] ?? e.method}</Badge>
                      </TableCell>
                      <TableCell>
                        {e.latitude != null && e.longitude != null ? (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {Number(e.latitude).toFixed(4)}, {Number(e.longitude).toFixed(4)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
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
    </div>
  );
}
