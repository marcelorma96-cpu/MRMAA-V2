-- UnoMesa: facturación compartida. Ejecutar UNA vez en Supabase SQL Editor.
-- No borra tablas ni registros. No recalcula suscripciones/trials existentes.
-- Las funciones de escritura son exclusivas del servidor (service_role).
BEGIN;
CREATE TABLE IF NOT EXISTS public.v2_store_identity (
 restaurant_id uuid PRIMARY KEY REFERENCES public.v2_restaurants(id) ON DELETE CASCADE,
 account_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.v2_store_purchases (
 provider text NOT NULL CHECK(provider IN ('apple','google_play')),
 mode text NOT NULL CHECK(mode IN ('test','live')),
 external_id text NOT NULL,
 restaurant_id uuid NOT NULL REFERENCES public.v2_restaurants(id) ON DELETE CASCADE,
 purchase_reference text NOT NULL, -- Google token: PRIVATE, service_role only
 product_id text NOT NULL,
 is_ended boolean NOT NULL DEFAULT false,
 verified_until timestamptz,
 checked_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(provider,mode,external_id)
);
CREATE INDEX IF NOT EXISTS v2_store_purchases_restaurant_idx ON public.v2_store_purchases(restaurant_id);
ALTER TABLE public.v2_store_identity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_store_purchases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.v2_store_identity,public.v2_store_purchases FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.v2_store_identity,public.v2_store_purchases TO service_role;

CREATE OR REPLACE FUNCTION public.v2_billing_source(p_restaurant uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE b jsonb; a public.v2_payment_accounts;
BEGIN
 b:=to_jsonb(public.v2_account_billing(p_restaurant));
 IF b->>'id' IS DISTINCT FROM p_restaurant::text THEN RAISE EXCEPTION 'BILLING_ACCESS'; END IF;
 SELECT * INTO a FROM public.v2_payment_accounts WHERE restaurant_id=p_restaurant;
 RETURN jsonb_build_object('provider',a.provider,'mode',a.mode,'can_checkout',CASE WHEN a.external_subscription_id IS NULL THEN true ELSE coalesce((SELECT s.is_ended FROM public.v2_store_purchases s WHERE s.provider=a.provider AND s.mode=a.mode AND s.external_id=a.external_subscription_id),false) END);
END $$;
REVOKE ALL ON FUNCTION public.v2_billing_source(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.v2_billing_source(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.v2_store_prepare(p_restaurant uuid,p_owner uuid,p_provider text,p_mode text,p_lease uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.v2_restaurants; a public.v2_payment_accounts; token uuid;
BEGIN
 IF p_provider NOT IN ('apple','google_play') OR p_mode NOT IN ('test','live') THEN RAISE EXCEPTION 'STORE_CONFIG'; END IF;
 SELECT * INTO r FROM public.v2_restaurants WHERE id=p_restaurant FOR UPDATE;
 IF r.id IS NULL OR r.owner_id<>p_owner OR r.access_status IN ('suspended','deleted') OR public.v2_billing_exempt(p_restaurant) THEN RAISE EXCEPTION 'STORE_ACCESS'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.v2_billing_state WHERE restaurant_id=p_restaurant AND lease_token=p_lease) THEN RAISE EXCEPTION 'STORE_LOCK'; END IF;
 SELECT * INTO a FROM public.v2_payment_accounts WHERE restaurant_id=p_restaurant FOR UPDATE;
 IF r.lemon_subscription_id IS NOT NULL OR r.stripe_subscription_id IS NOT NULL OR (a.restaurant_id IS NOT NULL AND (a.provider<>p_provider OR a.mode<>p_mode OR a.owner_id<>p_owner)) THEN RAISE EXCEPTION 'STORE_PROVIDER_CONFLICT'; END IF;
 INSERT INTO public.v2_payment_accounts(restaurant_id,owner_id,provider,mode,plan_code,billing_cycle)
 VALUES(p_restaurant,p_owner,p_provider,p_mode,r.plan_code,coalesce(r.billing_cycle,'month')) ON CONFLICT(restaurant_id) DO NOTHING;
 INSERT INTO public.v2_store_identity(restaurant_id) VALUES(p_restaurant) ON CONFLICT DO NOTHING;
 SELECT account_token INTO token FROM public.v2_store_identity WHERE restaurant_id=p_restaurant;
 RETURN token;
END $$;
REVOKE ALL ON FUNCTION public.v2_store_prepare(uuid,uuid,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.v2_store_prepare(uuid,uuid,text,text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.v2_store_apply(p_restaurant uuid,p_lease uuid,p_provider text,p_mode text,p_external text,p_reference text,p_product text,p_plan text,p_cycle text,p_active boolean,p_until timestamptz,p_cancel boolean,p_replace boolean DEFAULT false,p_ended boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a public.v2_payment_accounts; bound uuid;
BEGIN
 PERFORM 1 FROM public.v2_restaurants WHERE id=p_restaurant FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM public.v2_billing_state WHERE restaurant_id=p_restaurant AND lease_token=p_lease) THEN RAISE EXCEPTION 'STORE_LOCK'; END IF;
 IF public.v2_billing_exempt(p_restaurant) THEN RAISE EXCEPTION 'STORE_EXEMPT'; END IF;
 SELECT * INTO a FROM public.v2_payment_accounts WHERE restaurant_id=p_restaurant FOR UPDATE;
 IF a.restaurant_id IS NULL OR a.provider<>p_provider OR a.mode<>p_mode OR p_plan NOT IN ('basic','intermediate','advanced') OR p_cycle NOT IN ('month','year') OR p_until IS NULL THEN RAISE EXCEPTION 'STORE_BINDING'; END IF;
 IF a.external_subscription_id IS NOT NULL AND a.external_subscription_id<>p_external AND NOT p_replace THEN RETURN false; END IF;
 INSERT INTO public.v2_store_purchases(provider,mode,external_id,restaurant_id,purchase_reference,product_id)
 VALUES(p_provider,p_mode,p_external,p_restaurant,p_reference,p_product) ON CONFLICT(provider,mode,external_id) DO NOTHING;
 SELECT restaurant_id INTO bound FROM public.v2_store_purchases WHERE provider=p_provider AND mode=p_mode AND external_id=p_external FOR UPDATE;
 IF bound<>p_restaurant THEN RAISE EXCEPTION 'STORE_ALREADY_CLAIMED'; END IF;
 UPDATE public.v2_store_purchases SET checked_at=now(),product_id=p_product,is_ended=p_ended,verified_until=p_until WHERE provider=p_provider AND mode=p_mode AND external_id=p_external;
 UPDATE public.v2_payment_accounts SET external_subscription_id=p_external,plan_code=p_plan,billing_cycle=p_cycle WHERE restaurant_id=p_restaurant;
 UPDATE public.v2_restaurants SET plan_code=p_plan,billing_cycle=p_cycle,
 subscription_status=CASE WHEN p_active AND p_until>now() THEN 'active' ELSE 'cancelled' END,
 billing_current_period_end=p_until,billing_cancel_at_period_end=p_cancel,grace_ends_at=NULL
 WHERE id=p_restaurant;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.v2_store_apply(uuid,uuid,text,text,text,text,text,text,text,boolean,timestamptz,boolean,boolean,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.v2_store_apply(uuid,uuid,text,text,text,text,text,text,text,boolean,timestamptz,boolean,boolean,boolean) TO service_role;
COMMIT;
