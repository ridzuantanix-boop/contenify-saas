-- Provision the first workspace and welcome grant only after Supabase Auth confirms email.
-- Existing profiles, workspaces and wallets are preserved.
BEGIN;
CREATE OR REPLACE FUNCTION public.provision_verified_account_atomic(
  p_user_id UUID, p_email TEXT, p_full_name TEXT, p_whatsapp TEXT, p_referral_code TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE v_auth RECORD; v_workspace UUID; v_partner UUID; v_profile RECORD;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  SELECT id,email,email_confirmed_at INTO v_auth FROM auth.users WHERE id=p_user_id;
  IF NOT FOUND OR v_auth.email_confirmed_at IS NULL OR lower(v_auth.email) <> lower(p_email) THEN
    RETURN jsonb_build_object('success',false,'error','Verified email required');
  END IF;
  SELECT * INTO v_profile FROM profiles WHERE id=p_user_id FOR UPDATE;
  v_workspace := v_profile.default_workspace_id;
  IF v_workspace IS NULL THEN
    SELECT workspace_id INTO v_workspace FROM workspace_members WHERE user_id=p_user_id ORDER BY created_at LIMIT 1;
  END IF;
  IF v_workspace IS NULL THEN
    SELECT id INTO v_workspace FROM workspaces WHERE owner_id=p_user_id ORDER BY created_at LIMIT 1;
  END IF;
  IF v_workspace IS NULL THEN
    INSERT INTO workspaces(name,slug,owner_id,status)
    VALUES(left(coalesce(nullif(trim(p_full_name),''),split_part(p_email,'@',1))||' Workspace',255),
      'ws-'||replace(p_user_id::text,'-',''),p_user_id,'active') RETURNING id INTO v_workspace;
  END IF;
  INSERT INTO profiles(id,email,full_name,whatsapp,tier,default_workspace_id)
  VALUES(p_user_id,lower(p_email),left(p_full_name,255),left(p_whatsapp,50),'free',v_workspace)
  ON CONFLICT(id) DO UPDATE SET default_workspace_id=coalesce(profiles.default_workspace_id,EXCLUDED.default_workspace_id);
  INSERT INTO workspace_members(workspace_id,user_id,role)
  VALUES(v_workspace,p_user_id,'owner') ON CONFLICT(workspace_id,user_id) DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM credit_wallets WHERE workspace_id=v_workspace) THEN
    PERFORM provision_wallet_atomic(v_workspace,20);
  END IF;
  IF nullif(trim(p_referral_code),'') IS NOT NULL THEN
    SELECT id INTO v_partner FROM affiliate_partners
    WHERE referral_code=upper(trim(p_referral_code)) AND status='APPROVED' AND user_id<>p_user_id;
    IF v_partner IS NOT NULL THEN
      UPDATE profiles SET referred_by_affiliate_id=v_partner WHERE id=p_user_id AND referred_by_affiliate_id IS NULL;
      INSERT INTO affiliate_referral_events(affiliate_id,event_type,referred_user_id)
      VALUES(v_partner,'REGISTRATION',p_user_id) ON CONFLICT(referred_user_id) DO NOTHING;
    END IF;
  END IF;
  RETURN jsonb_build_object('success',true,'workspace_id',v_workspace);
END $$;
REVOKE ALL ON FUNCTION public.provision_verified_account_atomic(UUID,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_verified_account_atomic(UUID,TEXT,TEXT,TEXT,TEXT) TO service_role;
COMMIT;
