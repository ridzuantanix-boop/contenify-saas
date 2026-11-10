BEGIN;

CREATE TABLE IF NOT EXISTS public.creator_profiles(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 name TEXT NOT NULL CHECK(char_length(name) BETWEEN 1 AND 100),version INT NOT NULL DEFAULT 1,settings JSONB NOT NULL DEFAULT '{}'::jsonb,
 is_default BOOLEAN NOT NULL DEFAULT false,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS creator_profiles_one_default ON public.creator_profiles(workspace_id) WHERE is_default;
CREATE INDEX IF NOT EXISTS creator_profiles_workspace ON public.creator_profiles(workspace_id,updated_at DESC);

CREATE TABLE IF NOT EXISTS public.product_folders(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 name TEXT NOT NULL CHECK(char_length(name) BETWEEN 1 AND 100),created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,name)
);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES public.product_folders(id) ON DELETE SET NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS confirmed_facts JSONB NOT NULL DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS products_folder ON public.products(workspace_id,folder_id,created_at DESC);

CREATE TABLE IF NOT EXISTS public.auto_factory_batches(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,user_id UUID NOT NULL,
 name TEXT NOT NULL DEFAULT 'Auto Factory Run',mode TEXT NOT NULL CHECK(mode IN('QUICK_BULK','AUTO_MIX','DAILY_AUTO')),
 status TEXT NOT NULL DEFAULT 'READY' CHECK(status IN('READY','RUNNING','PAUSED','PAUSED_CREDITS','COMPLETED','CANCELLED','FAILED')),
 creator_profile_id UUID REFERENCES public.creator_profiles(id) ON DELETE SET NULL,creator_profile_version INT,preset_id UUID REFERENCES public.creator_presets(id) ON DELETE SET NULL,
 schedule_id UUID,style_ids JSONB NOT NULL,seed TEXT NOT NULL,videos_per_product INT NOT NULL CHECK(videos_per_product BETWEEN 1 AND 10),
 total_jobs INT NOT NULL,total_possible_credits INT NOT NULL,idempotency_key TEXT NOT NULL,
 admitted_jobs INT NOT NULL DEFAULT 0,completed_jobs INT NOT NULL DEFAULT 0,failed_jobs INT NOT NULL DEFAULT 0,last_admitted_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),UNIQUE(workspace_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS auto_factory_batches_workspace ON public.auto_factory_batches(workspace_id,created_at DESC);

CREATE TABLE IF NOT EXISTS public.auto_factory_items(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),batch_id UUID NOT NULL REFERENCES public.auto_factory_batches(id) ON DELETE CASCADE,
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
 product_image_id UUID NOT NULL REFERENCES product_images(id) ON DELETE RESTRICT,creator_profile_id UUID REFERENCES public.creator_profiles(id) ON DELETE SET NULL,
 selected_style_id TEXT NOT NULL,ordinal INT NOT NULL,job_id UUID REFERENCES video_jobs(id) ON DELETE SET NULL,
 status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','CLAIMED','ADMITTED','COMPLETED','FAILED','CANCELLED','SKIPPED')),
 claim_token UUID,claim_until TIMESTAMPTZ,immutable_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,error_message TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),UNIQUE(batch_id,product_id,ordinal)
);
CREATE INDEX IF NOT EXISTS auto_factory_items_dispatch ON public.auto_factory_items(status,created_at) WHERE status IN('PENDING','CLAIMED');
CREATE INDEX IF NOT EXISTS auto_factory_items_workspace ON public.auto_factory_items(workspace_id,batch_id,status);

CREATE TABLE IF NOT EXISTS public.daily_auto_schedules(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,user_id UUID NOT NULL,
 name TEXT NOT NULL,folder_id UUID NOT NULL REFERENCES public.product_folders(id) ON DELETE CASCADE,creator_profile_id UUID REFERENCES public.creator_profiles(id) ON DELETE SET NULL,
 preset_id UUID REFERENCES public.creator_presets(id) ON DELETE SET NULL,style_ids JSONB NOT NULL,mode TEXT NOT NULL CHECK(mode IN('QUICK_BULK','AUTO_MIX')),
 videos_per_day INT NOT NULL CHECK(videos_per_day BETWEEN 1 AND 30),videos_per_product INT NOT NULL CHECK(videos_per_product BETWEEN 1 AND 10),
 start_time_local TIME NOT NULL,timezone TEXT NOT NULL DEFAULT 'Asia/Kuala_Lumpur',max_daily_credits INT NOT NULL CHECK(max_daily_credits>=10),
 reuse_completed_products BOOLEAN NOT NULL DEFAULT false,stop_date DATE,is_active BOOLEAN NOT NULL DEFAULT true,last_run_date DATE,next_run_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS daily_auto_one_active_folder ON public.daily_auto_schedules(workspace_id,folder_id) WHERE is_active;
CREATE TABLE IF NOT EXISTS public.daily_auto_runs(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),schedule_id UUID NOT NULL REFERENCES public.daily_auto_schedules(id) ON DELETE CASCADE,
 workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,run_date DATE NOT NULL,batch_id UUID REFERENCES public.auto_factory_batches(id) ON DELETE SET NULL,
 status TEXT NOT NULL,reason TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),UNIQUE(schedule_id,run_date)
);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='auto_factory_schedule_fk' AND conrelid='public.auto_factory_batches'::regclass) THEN
  ALTER TABLE public.auto_factory_batches ADD CONSTRAINT auto_factory_schedule_fk FOREIGN KEY(schedule_id) REFERENCES public.daily_auto_schedules(id) ON DELETE SET NULL;
 END IF;
END $$;
ALTER TABLE public.video_jobs ADD COLUMN IF NOT EXISTS auto_factory_batch_id UUID REFERENCES public.auto_factory_batches(id) ON DELETE SET NULL;
ALTER TABLE public.video_jobs ADD COLUMN IF NOT EXISTS creator_profile_id UUID REFERENCES public.creator_profiles(id) ON DELETE SET NULL;
ALTER TABLE public.video_jobs ADD COLUMN IF NOT EXISTS generation_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS video_jobs_auto_factory_batch ON public.video_jobs(auto_factory_batch_id,status);

CREATE OR REPLACE FUNCTION public.set_creator_profile_default(p_workspace_id UUID,p_profile_id UUID) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE creator_profiles SET is_default=false,updated_at=now() WHERE workspace_id=p_workspace_id AND is_default;
 IF p_profile_id IS NOT NULL THEN UPDATE creator_profiles SET is_default=true,updated_at=now() WHERE id=p_profile_id AND workspace_id=p_workspace_id;IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','PROFILE_NOT_FOUND');END IF;END IF;
 RETURN jsonb_build_object('success',true);
END $$;

CREATE OR REPLACE FUNCTION public.create_auto_factory_batch_atomic(p_workspace_id UUID,p_user_id UUID,p_batch_id UUID,p_name TEXT,p_mode TEXT,p_profile_id UUID,p_preset_id UUID,p_style_ids JSONB,p_seed TEXT,p_videos_per_product INT,p_idempotency_key TEXT,p_items JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_count INT;v_available INT;v_existing UUID;v_profile_version INT;v_profile_settings JSONB;v_preset_settings JSONB;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext(p_workspace_id::text));
 SELECT id INTO v_existing FROM auto_factory_batches WHERE workspace_id=p_workspace_id AND idempotency_key=p_idempotency_key;
 IF FOUND THEN RETURN jsonb_build_object('success',true,'duplicate',true,'batch_id',v_existing);END IF;
 IF p_mode NOT IN('QUICK_BULK','AUTO_MIX','DAILY_AUTO') OR p_videos_per_product<1 OR p_videos_per_product>10 OR jsonb_typeof(p_items)<>'array' THEN RETURN jsonb_build_object('success',false,'error','INVALID_BATCH');END IF;
 v_count:=jsonb_array_length(p_items);IF v_count<1 OR v_count>60 THEN RETURN jsonb_build_object('success',false,'error','BATCH_SIZE_LIMIT','max',60);END IF;
 IF EXISTS(SELECT 1 FROM jsonb_to_recordset(p_items) x(product_id UUID,product_image_id UUID,style_id TEXT,ordinal INT,snapshot JSONB) LEFT JOIN products p ON p.id=x.product_id AND p.workspace_id=p_workspace_id LEFT JOIN product_images i ON i.id=x.product_image_id AND i.product_id=x.product_id AND i.workspace_id=p_workspace_id WHERE p.id IS NULL OR i.id IS NULL) THEN RETURN jsonb_build_object('success',false,'error','INVALID_PRODUCT_SCOPE');END IF;
 SELECT balance-reserved_balance INTO v_available FROM credit_wallets WHERE workspace_id=p_workspace_id FOR UPDATE;
 IF coalesce(v_available,0)<v_count*10 THEN RETURN jsonb_build_object('success',false,'error','INSUFFICIENT_CREDITS','required',v_count*10,'available',coalesce(v_available,0));END IF;
 IF p_profile_id IS NOT NULL THEN SELECT version,settings INTO v_profile_version,v_profile_settings FROM creator_profiles WHERE id=p_profile_id AND workspace_id=p_workspace_id;IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','PROFILE_NOT_FOUND');END IF;END IF;
 IF p_profile_id IS NOT NULL AND p_preset_id IS NOT NULL THEN RETURN jsonb_build_object('success',false,'error','PROFILE_AND_PRESET_CONFLICT');END IF;
 IF p_preset_id IS NOT NULL THEN SELECT settings INTO v_preset_settings FROM creator_presets WHERE id=p_preset_id AND workspace_id=p_workspace_id;IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','PRESET_NOT_FOUND');END IF;END IF;
 INSERT INTO auto_factory_batches(id,workspace_id,user_id,name,mode,creator_profile_id,creator_profile_version,preset_id,style_ids,seed,videos_per_product,total_jobs,total_possible_credits,idempotency_key)
 VALUES(p_batch_id,p_workspace_id,p_user_id,left(coalesce(nullif(trim(p_name),''),'Auto Factory Run'),100),p_mode,p_profile_id,v_profile_version,p_preset_id,p_style_ids,p_seed,p_videos_per_product,v_count,v_count*10,p_idempotency_key);
 INSERT INTO auto_factory_items(batch_id,workspace_id,product_id,product_image_id,creator_profile_id,selected_style_id,ordinal,immutable_snapshot)
 SELECT p_batch_id,p_workspace_id,x.product_id,x.product_image_id,p_profile_id,x.style_id,x.ordinal,
  coalesce(x.snapshot,'{}'::jsonb)||jsonb_build_object(
   'creatorProfile',CASE WHEN p_profile_id IS NULL THEN NULL ELSE jsonb_build_object('id',p_profile_id,'version',v_profile_version,'settings',v_profile_settings) END,
   'legacyPreset',CASE WHEN p_preset_id IS NULL THEN NULL ELSE jsonb_build_object('id',p_preset_id,'settings',v_preset_settings) END)
 FROM jsonb_to_recordset(p_items) x(product_id UUID,product_image_id UUID,style_id TEXT,ordinal INT,snapshot JSONB);
 RETURN jsonb_build_object('success',true,'batch_id',p_batch_id,'total_jobs',v_count,'total_possible_credits',v_count*10);
END $$;

CREATE OR REPLACE FUNCTION public.claim_auto_factory_item_atomic(p_lease_seconds INT DEFAULT 300) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_item RECORD;v_token UUID;
BEGIN
 UPDATE auto_factory_items SET status='PENDING',claim_token=NULL,claim_until=NULL,updated_at=now() WHERE status='CLAIMED' AND claim_until<now();
 SELECT i.* INTO v_item FROM auto_factory_items i JOIN auto_factory_batches b ON b.id=i.batch_id
 WHERE i.status='PENDING' AND b.status IN('READY','RUNNING')
 AND NOT EXISTS(SELECT 1 FROM video_jobs j WHERE j.workspace_id=i.workspace_id AND j.status IN('QUEUED','SUBMITTING','PROCESSING','QA_PENDING'))
 ORDER BY coalesce(b.last_admitted_at,'epoch'::timestamptz),i.created_at,i.ordinal FOR UPDATE OF i SKIP LOCKED LIMIT 1;
 IF NOT FOUND THEN RETURN jsonb_build_object('success',true,'claimed',false);END IF;
 v_token:=gen_random_uuid();UPDATE auto_factory_items SET status='CLAIMED',claim_token=v_token,claim_until=now()+make_interval(secs=>least(greatest(p_lease_seconds,60),600)),updated_at=now() WHERE id=v_item.id;
 UPDATE auto_factory_batches SET status='RUNNING',last_admitted_at=now(),updated_at=now() WHERE id=v_item.batch_id;
 RETURN jsonb_build_object('success',true,'claimed',true,'item_id',v_item.id,'batch_id',v_item.batch_id,'workspace_id',v_item.workspace_id,'product_id',v_item.product_id,'product_image_id',v_item.product_image_id,'style_id',v_item.selected_style_id,'claim_token',v_token);
END $$;

REVOKE ALL ON public.creator_profiles,public.product_folders,public.auto_factory_batches,public.auto_factory_items,public.daily_auto_schedules,public.daily_auto_runs FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.creator_profiles,public.product_folders,public.auto_factory_batches,public.auto_factory_items,public.daily_auto_schedules,public.daily_auto_runs TO service_role;
REVOKE ALL ON FUNCTION public.set_creator_profile_default(UUID,UUID),public.create_auto_factory_batch_atomic(UUID,UUID,UUID,TEXT,TEXT,UUID,UUID,JSONB,TEXT,INT,TEXT,JSONB),public.claim_auto_factory_item_atomic(INT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_creator_profile_default(UUID,UUID),public.create_auto_factory_batch_atomic(UUID,UUID,UUID,TEXT,TEXT,UUID,UUID,JSONB,TEXT,INT,TEXT,JSONB),public.claim_auto_factory_item_atomic(INT) TO service_role;
COMMIT;
