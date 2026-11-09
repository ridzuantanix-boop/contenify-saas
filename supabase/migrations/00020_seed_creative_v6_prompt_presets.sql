-- AffiMatik Creative V6 added seven published Nexabot styles after the original
-- 13-style seed. video_jobs.preset_id is a restrictive foreign key, so every
-- published style must have a corresponding canonical row before admission.
--
-- This migration is deliberately additive: existing prompt rows are preserved.

INSERT INTO public.prompt_presets (
  id,
  name,
  category,
  description,
  target_duration_seconds,
  supported_providers,
  is_official,
  is_active,
  system_rules,
  template_text,
  version
)
VALUES
  ('NX11', 'POV Tengok Produk', 'pov', 'Perspektif pembeli menilai kesesuaian produk tanpa dakwaan telah membeli.', 15, '["nexabot"]'::jsonb, TRUE, TRUE, 'Use the canonical application compiler and all identity, realism, modesty, claim-safety and zero-UI locks.', 'Compiled dynamically by the canonical AffiMatik masterprompt engine.', 6),
  ('NX12', 'Jumpa Barang Menarik', 'creator_review', 'Kongsi barang menarik dengan reaksi ceria tanpa testimoni palsu.', 15, '["nexabot"]'::jsonb, TRUE, TRUE, 'Use the canonical application compiler and all identity, realism, modesty, claim-safety and zero-UI locks.', 'Compiled dynamically by the canonical AffiMatik masterprompt engine.', 6),
  ('NX13', 'Borak Santai Di Dapur', 'lifestyle', 'Perbualan dapur untuk kategori produk yang sesuai tanpa pengalaman penggunaan rekaan.', 15, '["nexabot"]'::jsonb, TRUE, TRUE, 'Use the canonical application compiler and all identity, realism, modesty, claim-safety and zero-UI locks.', 'Compiled dynamically by the canonical AffiMatik masterprompt engine.', 6),
  ('NX14', 'Review Di Meja Kerja', 'lifestyle', 'Konteks kerja atau belajar dengan fungsi produk yang disokong.', 15, '["nexabot"]'::jsonb, TRUE, TRUE, 'Use the canonical application compiler and all identity, realism, modesty, claim-safety and zero-UI locks.', 'Compiled dynamically by the canonical AffiMatik masterprompt engine.', 6),
  ('NX15', 'Cerita Masalah Pendek', 'problem_solution', 'Cerita situasi harian sebelum menunjukkan pilihan produk yang sesuai.', 15, '["nexabot"]'::jsonb, TRUE, TRUE, 'Use the canonical application compiler and all identity, realism, modesty, claim-safety and zero-UI locks.', 'Compiled dynamically by the canonical AffiMatik masterprompt engine.', 6),
  ('NX16', 'Soft Sell Tanpa Paksa', 'soft_sell', 'Cadangan produk yang lembut tanpa urgensi, harga atau dakwaan rekaan.', 15, '["nexabot"]'::jsonb, TRUE, TRUE, 'Use the canonical application compiler and all identity, realism, modesty, claim-safety and zero-UI locks.', 'Compiled dynamically by the canonical AffiMatik masterprompt engine.', 6),
  ('NX17', 'Recommend Secara Spontan', 'creator_review', 'Cadangan spontan dengan satu sebab praktikal tanpa pengalaman peribadi rekaan.', 15, '["nexabot"]'::jsonb, TRUE, TRUE, 'Use the canonical application compiler and all identity, realism, modesty, claim-safety and zero-UI locks.', 'Compiled dynamically by the canonical AffiMatik masterprompt engine.', 6)
ON CONFLICT (id) DO NOTHING;

