"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/auth-provider";
import type { Database } from "@/lib/types/database";

type StaffMember = Database["public"]["Tables"]["hr_staff"]["Row"];
type AttendanceEvent = Database["public"]["Tables"]["attendance_events"]["Row"];
type LeaveRequest = Database["public"]["Tables"]["attendance_leave_requests"]["Row"];
type Schedule = Database["public"]["Tables"]["attendance_schedules"]["Row"];
type Assignment = Database["public"]["Tables"]["hr_assignments"]["Row"];

export interface StaffSelfData {
  staff: StaffMember | null;
  assignments: (Assignment & {
    hr_departments?: { name: string; code: string } | null;
    hr_positions?: { name: string; code: string } | null;
  })[];
  todayEvents: AttendanceEvent[];
  recentEvents: AttendanceEvent[];
  leaveRequests: LeaveRequest[];
  schedules: Schedule[];
  loading: boolean;
  refresh: () => void;
}

export function useStaffSelfData(): StaffSelfData {
  const { user, profile, hasStaffRecord } = useAuth();
  const [staff, setStaff] = useState<StaffMember | null>(null);
  const [assignments, setAssignments] = useState<StaffSelfData["assignments"]>([]);
  const [todayEvents, setTodayEvents] = useState<AttendanceEvent[]>([]);
  const [recentEvents, setRecentEvents] = useState<AttendanceEvent[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const initializedRef = useRef(false);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id || !profile?.institution_id) {
        setLoading(false);
        return;
      }
      if (!hasStaffRecord) {
        setLoading(false);
        return;
      }
      if (!initializedRef.current) initializedRef.current = true;
      setLoading(true);
      try {
        // Resolve staff via profile_id — never send staff_id from the frontend
        const { data: staffData } = await supabase
          .from("hr_staff")
          .select("*")
          .eq("profile_id", user.id)
          .eq("institution_id", profile.institution_id)
          .maybeSingle();

        if (cancelled || !staffData) {
          if (!cancelled) setLoading(false);
          return;
        }

        setStaff(staffData as StaffMember);
        const sid = (staffData as StaffMember).id;

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const recentStart = new Date();
        recentStart.setDate(recentStart.getDate() - 30);

        const [asgRes, todayRes, recentRes, leaveRes, schedRes] = await Promise.all([
          supabase
            .from("hr_assignments")
            .select("*, hr_departments(name, code), hr_positions(name, code)")
            .eq("staff_id", sid)
            .order("start_date", { ascending: false }),
          supabase
            .from("attendance_events")
            .select("*")
            .eq("staff_id", sid)
            .gte("server_timestamp", todayStart.toISOString())
            .lte("server_timestamp", todayEnd.toISOString())
            .order("server_timestamp", { ascending: false }),
          supabase
            .from("attendance_events")
            .select("*")
            .eq("staff_id", sid)
            .gte("server_timestamp", recentStart.toISOString())
            .order("server_timestamp", { ascending: false })
            .limit(50),
          supabase
            .from("attendance_leave_requests")
            .select("*")
            .eq("staff_id", sid)
            .order("created_at", { ascending: false }),
          supabase
            .from("attendance_schedules")
            .select("*")
            .eq("staff_id", sid)
            .eq("is_active", true)
            .order("day_of_week", { ascending: true }),
        ]);

        if (cancelled) return;

        setAssignments((asgRes.data ?? []) as StaffSelfData["assignments"]);
        setTodayEvents((todayRes.data ?? []) as AttendanceEvent[]);
        setRecentEvents((recentRes.data ?? []) as AttendanceEvent[]);
        setLeaveRequests((leaveRes.data ?? []) as LeaveRequest[]);
        setSchedules((schedRes.data ?? []) as Schedule[]);
      } catch {
        // ignore — keep existing state
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, profile?.institution_id, hasStaffRecord, refreshKey]);

  return {
    staff,
    assignments,
    todayEvents,
    recentEvents,
    leaveRequests,
    schedules,
    loading,
    refresh,
  };
}
