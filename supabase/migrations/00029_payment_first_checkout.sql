-- Payment-first checkout: provision a zero-credit workspace for a newly-created
-- Supabase identity before mailbox confirmation. Generation remains blocked by
-- the application session until the email callback creates a verified session.
BEGIN;

CREATE OR REPLACE FUNCTION public.provision_pending_checkout_account_atomic(
  p_user_id UUID, p_email TEXT, p_full_name TEXT DEFAULT '', p_whatsapp TEXT DEFAULT '')
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE v_auth RECORD; v_workspace UUID; v_profile RECORD;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  SELECT id, email, email_confirmed_at INTO v_auth FROM auth.users WHERE id = p_user_id;
  IF NOT FOUND OR lower(v_auth.email) <> lower(p_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Auth identity mismatch');
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  v_workspace := v_profile.default_workspace_id;
  IF v_workspace IS NULL THEN
    SELECT workspace_id INTO v_workspace FROM public.workspace_members
      WHERE user_id = p_user_id ORDER BY created_at LIMIT 1;
  END IF;
  IF v_workspace IS NULL THEN
    INSERT INTO public.workspaces(name, slug, owner_id, status)
    VALUES (
      left(coalesce(nullif(trim(p_full_name), ''), split_part(p_email, '@', 1)) || ' Workspace', 255),
      'ws-' || replace(p_user_id::text, '-', ''), p_user_id, 'active')
    RETURNING id INTO v_workspace;
  END IF;

  INSERT INTO public.profiles(id, email, full_name, whatsapp, tier, default_workspace_id)
  VALUES (p_user_id, lower(p_email),
    left(coalesce(nullif(trim(p_full_name), ''), split_part(p_email, '@', 1)), 255),
    left(coalesce(p_whatsapp, ''), 50), 'free', v_workspace)
  ON CONFLICT (id) DO UPDATE
    SET default_workspace_id = coalesce(public.profiles.default_workspace_id, EXCLUDED.default_workspace_id);
  INSERT INTO public.workspace_members(workspace_id, user_id, role)
  VALUES (v_workspace, p_user_id, 'owner') ON CONFLICT (workspace_id, user_id) DO NOTHING;

  -- Explicit zero balance: no Free Trial and no zero-value ledger entry.
  INSERT INTO public.credit_wallets(
    workspace_id, balance, reserved_balance, lifetime_granted, lifetime_spent, created_at, updated_at)
  VALUES (v_workspace, 0, 0, 0, 0, now(), now()) ON CONFLICT (workspace_id) DO NOTHING;

  RETURN jsonb_build_object('success', true, 'workspace_id', v_workspace,
    'email_confirmed', v_auth.email_confirmed_at IS NOT NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.provision_pending_checkout_account_atomic(UUID, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_pending_checkout_account_atomic(UUID, TEXT, TEXT, TEXT)
  TO service_role;
COMMIT;
