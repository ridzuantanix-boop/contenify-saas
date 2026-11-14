-- AffiMatik receipt-upload hotfix.
-- Additive: expands private evidence formats/size without changing any order,
-- wallet, ledger, entitlement, affiliate or payment-verification state.
BEGIN;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_receipt_size_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_receipt_size_check
  CHECK (receipt_size_bytes IS NULL OR (receipt_size_bytes >= 8 AND receipt_size_bytes <= 26214400));

DO $migration$
DECLARE
  v_original TEXT;
  v_updated TEXT;
BEGIN
  SELECT pg_get_functiondef('public.provision_qr_order_atomic(uuid,text,text,text,bigint)'::regprocedure)
    INTO v_original;
  IF v_original IS NULL THEN
    RAISE EXCEPTION 'provision_qr_order_atomic is missing';
  END IF;

  v_updated := regexp_replace(
    v_original,
    'p_receipt_mime_type\s+NOT\s+IN\s*\([^)]*\)',
    'p_receipt_mime_type NOT IN(''image/jpeg'',''image/png'',''image/webp'',''image/gif'',''image/heic'',''image/heif'',''image/bmp'',''image/tiff'',''application/pdf'')',
    'i'
  );
  v_updated := regexp_replace(
    v_updated,
    'p_receipt_size_bytes\s*>\s*5242880',
    'p_receipt_size_bytes>26214400',
    'i'
  );

  IF v_updated = v_original OR position('26214400' IN v_updated) = 0 OR position('image/heic' IN v_updated) = 0 THEN
    RAISE EXCEPTION 'Existing QR function did not match the reviewed validation contract';
  END IF;
  EXECUTE v_updated;
END
$migration$;

REVOKE ALL ON FUNCTION public.provision_qr_order_atomic(UUID,TEXT,TEXT,TEXT,BIGINT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.provision_qr_order_atomic(UUID,TEXT,TEXT,TEXT,BIGINT) TO service_role;

COMMIT;
