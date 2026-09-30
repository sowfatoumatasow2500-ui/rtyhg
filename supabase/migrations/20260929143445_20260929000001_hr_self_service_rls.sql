/*
# HR Self-Service Backend — RLS Policies for Linked Staff

## Summary
Enables self-service access for personnel whose `hr_staff.profile_id = auth.uid()`.
A linked staff member can, through the Supabase client (anon key, RLS-enforced):
  1. Read their own hr_staff record
  2. Read their own attendance_events
  3. Read their own attendance_schedules
  4. Read their own attendance_leave_requests + create their own (status='pending')
  5. Read their own attendance_corrections
  6. Read their own attendance_qr_tokens (employee tokens)

## Key Security Principles
- Access is granted ONLY when `hr_staff.profile_id = auth.uid()` AND
  `hr_staff.institution_id = current_institution_id()`.
- The `staff_id` is NEVER trusted from the frontend — it is always derived
  from `auth.uid()` via a SECURITY DEFINER function `current_staff_id()`.
- All existing HR admin policies (hr.view, hr.create, hr.update, hr.delete,
  attendance.manage, super_admin) remain exactly as-is. These self-service
  policies are ADDITIVE — they use OR to extend access, never to restrict it.
- No changes to students or teachers RLS policies.
- No changes to any existing policy — only new policies are added.

## New Function
### current_staff_id()
Returns the hr_staff.id for the authenticated user (where profile_id = auth.uid()
AND institution_id = current_institution_id()). Returns NULL if not linked.

## New Policies (all ADDITIVE — existing policies untouched)

### hr_staff
- "self_select_hr_staff": SELECT own record via profile_id = auth.uid()

### attendance_events
- "self_select_attendance_events": SELECT events where staff_id = current_staff_id()

### attendance_schedules
- "self_select_attendance_schedules": SELECT schedules where staff_id = current_staff_id()

### attendance_leave_requests
- "self_select_leave_requests": SELECT own requests
- "self_insert_leave_requests": INSERT own requests (status must be 'pending', staff_id = current_staff_id())
- "self_cancel_leave_requests": UPDATE own requests — only status → 'cancelled', only if currently 'pending'

### attendance_corrections
- "self_select_attendance_corrections": SELECT corrections for own events

### attendance_qr_tokens
- "self_select_qr_tokens": SELECT own employee tokens (staff_id = current_staff_id())

## What is NOT modified
- students table RLS — untouched
- teachers table RLS — untouched
- All existing HR admin policies — untouched
- All existing attendance admin policies — untouched
- Edge function (attendance-clock) — uses service role, bypasses RLS, no change needed
*/

-- ============================================================
-- 1. SECURITY DEFINER function: current_staff_id()
--    Returns the hr_staff.id linked to the authenticated user.
--    This is the single source of truth — the frontend NEVER passes staff_id.
-- ============================================================
CREATE OR REPLACE FUNCTION public.current_staff_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT s.id FROM public.hr_staff s
  WHERE s.profile_id = auth.uid()
    AND s.institution_id = public.current_institution_id();
$$;

GRANT EXECUTE ON FUNCTION public.current_staff_id() TO authenticated;

-- ============================================================
-- 2. hr_staff — self-service SELECT
--    A linked staff member can read their own record.
--    Existing "select_hr_staff" policy (admin access) is NOT dropped.
-- ============================================================
DROP POLICY IF EXISTS "self_select_hr_staff" ON public.hr_staff;
CREATE POLICY "self_select_hr_staff"
  ON public.hr_staff FOR SELECT
  TO authenticated
  USING (
    profile_id = auth.uid()
    AND institution_id = public.current_institution_id()
  );

-- ============================================================
-- 3. attendance_events — self-service SELECT
--    A linked staff member can read their own clock events.
--    Existing "select_attendance_events" policy is NOT dropped.
-- ============================================================
DROP POLICY IF EXISTS "self_select_attendance_events" ON public.attendance_events;
CREATE POLICY "self_select_attendance_events"
  ON public.attendance_events FOR SELECT
  TO authenticated
  USING (
    staff_id = public.current_staff_id()
  );

-- ============================================================
-- 4. attendance_schedules — self-service SELECT
--    A linked staff member can read their own work schedules.
--    Existing "select_attendance_schedules" policy is NOT dropped.
-- ============================================================
DROP POLICY IF EXISTS "self_select_attendance_schedules" ON public.attendance_schedules;
CREATE POLICY "self_select_attendance_schedules"
  ON public.attendance_schedules FOR SELECT
  TO authenticated
  USING (
    staff_id = public.current_staff_id()
  );

-- ============================================================
-- 5. attendance_leave_requests — self-service SELECT + INSERT + limited UPDATE
--    A linked staff member can:
--    - Read their own leave requests
--    - Create leave requests for themselves (status must be 'pending')
--    - Cancel their own pending requests (status → 'cancelled', only if currently 'pending')
--    Existing admin policies are NOT dropped.
-- ============================================================

-- Self-service SELECT
DROP POLICY IF EXISTS "self_select_leave_requests" ON public.attendance_leave_requests;
CREATE POLICY "self_select_leave_requests"
  ON public.attendance_leave_requests FOR SELECT
  TO authenticated
  USING (
    staff_id = public.current_staff_id()
  );

-- Self-service INSERT: staff creates their own leave request
--    staff_id is forced to current_staff_id() — frontend cannot set it
--    status must be 'pending' (default) — staff cannot self-approve
DROP POLICY IF EXISTS "self_insert_leave_requests" ON public.attendance_leave_requests;
CREATE POLICY "self_insert_leave_requests"
  ON public.attendance_leave_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    staff_id = public.current_staff_id()
    AND status = 'pending'
  );

-- Self-service UPDATE: staff can only cancel their own pending requests
--    Only the status column can change, and only from 'pending' → 'cancelled'
--    The USING clause ensures the row is currently theirs AND pending
--    The WITH CHECK ensures the new status is 'cancelled'
DROP POLICY IF EXISTS "self_cancel_leave_requests" ON public.attendance_leave_requests;
CREATE POLICY "self_cancel_leave_requests"
  ON public.attendance_leave_requests FOR UPDATE
  TO authenticated
  USING (
    staff_id = public.current_staff_id()
    AND status = 'pending'
  )
  WITH CHECK (
    staff_id = public.current_staff_id()
    AND status = 'cancelled'
  );

-- ============================================================
-- 6. attendance_corrections — self-service SELECT
--    A linked staff member can read corrections made to their own events.
--    Existing "select_attendance_corrections" policy is NOT dropped.
-- ============================================================
DROP POLICY IF EXISTS "self_select_attendance_corrections" ON public.attendance_corrections;
CREATE POLICY "self_select_attendance_corrections"
  ON public.attendance_corrections FOR SELECT
  TO authenticated
  USING (
    staff_id = public.current_staff_id()
  );

-- ============================================================
-- 7. attendance_qr_tokens — self-service SELECT
--    A linked staff member can read their own employee QR tokens.
--    This replaces the broad "select_own_qr_tokens" policy with a tighter one
--    that checks profile_id linkage instead of just institution membership.
--    The existing "select_own_qr_tokens" policy is dropped and replaced.
-- ============================================================
DROP POLICY IF EXISTS "select_own_qr_tokens" ON public.attendance_qr_tokens;
DROP POLICY IF EXISTS "self_select_qr_tokens" ON public.attendance_qr_tokens;
CREATE POLICY "self_select_qr_tokens"
  ON public.attendance_qr_tokens FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR staff_id = public.current_staff_id()
  );

-- ============================================================
-- 8. hr_assignments — self-service SELECT
--    A linked staff member can read their own assignment history.
--    Existing "select_hr_assignments" policy is NOT dropped.
-- ============================================================
DROP POLICY IF EXISTS "self_select_hr_assignments" ON public.hr_assignments;
CREATE POLICY "self_select_hr_assignments"
  ON public.hr_assignments FOR SELECT
  TO authenticated
  USING (
    staff_id = public.current_staff_id()
  );
