/*
# Attendance QR Tokens — single-use, short-lived tokens for QR-based clocking

## Summary
Adds a `attendance_qr_tokens` table to support the employee_qr and terminal_qr
methods. Tokens are server-generated, short-lived, single-use, and renewable.

## New Table: attendance_qr_tokens
- token (uuid, unique) — the random token embedded in the QR code
- token_type ('employee' or 'terminal')
- staff_id (FK → hr_staff, nullable) — set for employee QR
- terminal_id (FK → attendance_terminals, nullable) — set for terminal QR
- expires_at (timestamptz) — when the token becomes invalid
- used_at (timestamptz, nullable) — when consumed (NULL = unused)

## Security
- RLS enabled. Tokens managed via edge function (service role bypasses RLS).
- Authenticated users can read their own tokens.
*/

CREATE TABLE IF NOT EXISTS public.attendance_qr_tokens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  token           uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  token_type      text NOT NULL,
  staff_id        uuid REFERENCES public.hr_staff(id) ON DELETE CASCADE,
  terminal_id     uuid REFERENCES public.attendance_terminals(id) ON DELETE CASCADE,
  expires_at      timestamptz NOT NULL,
  used_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT qr_token_type_check CHECK (token_type IN ('employee', 'terminal')),
  CONSTRAINT qr_token_staff_or_terminal CHECK (
    (token_type = 'employee' AND staff_id IS NOT NULL) OR
    (token_type = 'terminal' AND terminal_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_qr_tokens_token ON public.attendance_qr_tokens (token);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_expires ON public.attendance_qr_tokens (expires_at);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_staff ON public.attendance_qr_tokens (staff_id);

ALTER TABLE public.attendance_qr_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_qr_tokens" ON public.attendance_qr_tokens;
CREATE POLICY "select_own_qr_tokens"
  ON public.attendance_qr_tokens FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR staff_id IN (
      SELECT s.id FROM public.hr_staff s
      WHERE s.institution_id = public.current_institution_id()
    )
    OR terminal_id IN (
      SELECT t.id FROM public.attendance_terminals t
      WHERE t.institution_id = public.current_institution_id()
    )
  );

DROP POLICY IF EXISTS "insert_qr_tokens" ON public.attendance_qr_tokens;
CREATE POLICY "insert_qr_tokens"
  ON public.attendance_qr_tokens FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR institution_id = public.current_institution_id()
  );

DROP POLICY IF EXISTS "update_qr_tokens" ON public.attendance_qr_tokens;
CREATE POLICY "update_qr_tokens"
  ON public.attendance_qr_tokens FOR UPDATE
  TO authenticated
  USING (
    public.is_super_admin()
    OR institution_id = public.current_institution_id()
  )
  WITH CHECK (
    public.is_super_admin()
    OR institution_id = public.current_institution_id()
  );

DROP POLICY IF EXISTS "delete_qr_tokens" ON public.attendance_qr_tokens;
CREATE POLICY "delete_qr_tokens"
  ON public.attendance_qr_tokens FOR DELETE
  TO authenticated
  USING (
    public.is_super_admin()
    OR institution_id = public.current_institution_id()
  );
