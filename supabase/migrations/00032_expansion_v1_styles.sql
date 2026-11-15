-- AffiMatik Expansion V1: additive canonical parent rows for NX21-NX30.
-- video_jobs.preset_id references prompt_presets(id), so each staged style
-- needs a parent row before an isolated generation can be admitted.

INSERT INTO public.prompt_presets (
  id, name, category, description, target_duration_seconds,
  supported_providers, is_official, is_active, system_rules, template_text, version
)
VALUES
  ('NX21','Kurung Catwalk','fashion','Persembahan baju kurung penuh dengan langkah dan gerakan fabrik yang natural.',15,'["nexabot"]'::jsonb,TRUE,TRUE,'Use the canonical compiler, Pawarna Creative DNA, Shariah Lock, identity and scale locks.','Compiled dynamically by the canonical AffiMatik masterprompt engine.',11),
  ('NX22','Kebaya Elegance','fashion','Showcase kebaya labuh yang sopan dengan fokus pada detail dan jatuhan fabrik.',15,'["nexabot"]'::jsonb,TRUE,TRUE,'Use the canonical compiler, Pawarna Creative DNA, Shariah Lock, identity and scale locks.','Compiled dynamically by the canonical AffiMatik masterprompt engine.',11),
  ('NX23','Tudung Styling','fashion','Paparan drape dan coverage tudung dengan aurat terpelihara sepanjang video.',15,'["nexabot"]'::jsonb,TRUE,TRUE,'Use the canonical compiler, Pawarna Creative DNA, Shariah Lock, identity and scale locks.','Compiled dynamically by the canonical AffiMatik masterprompt engine.',11),
  ('NX24','OOTD Mirror Review','fashion','Review OOTD cermin yang authentic oleh presenter Muslimah yang sopan.',15,'["nexabot"]'::jsonb,TRUE,TRUE,'Use the canonical compiler, Pawarna Creative DNA, Shariah Lock, identity and scale locks.','Compiled dynamically by the canonical AffiMatik masterprompt engine.',11),
  ('NX25','Kids Outfit Showcase','fashion','Showcase kidswear pada hanger, mannequin atau flat-lay tanpa child actor.',15,'["nexabot"]'::jsonb,TRUE,TRUE,'Use the canonical compiler, Pawarna Creative DNA, Shariah Lock, identity and scale locks.','Compiled dynamically by the canonical AffiMatik masterprompt engine.',11),
  ('NX26','Boutique Collection','fashion','Persembahan butik yang mengekalkan setiap warna, corak dan varian dirujuk.',15,'["nexabot"]'::jsonb,TRUE,TRUE,'Use the canonical compiler, Pawarna Creative DNA, Shariah Lock, identity and scale locks.','Compiled dynamically by the canonical AffiMatik masterprompt engine.',11),
  ('NX27','Kuali Cooking Demo','product_usage','Demo cookware dengan haba, utensil dan fizik pengendalian yang believable.',15,'["nexabot"]'::jsonb,TRUE,TRUE,'Use the canonical compiler, Pawarna Creative DNA, Shariah Lock, identity and scale locks.','Compiled dynamically by the canonical AffiMatik masterprompt engine.',11),
  ('NX28','Air Fryer Demo','product_usage','Urutan air fryer yang logik dengan reka bentuk dan kawalan sebenar terpelihara.',15,'["nexabot"]'::jsonb,TRUE,TRUE,'Use the canonical compiler, Pawarna Creative DNA, Shariah Lock, identity and scale locks.','Compiled dynamically by the canonical AffiMatik masterprompt engine.',11),
  ('NX29','Kitchen Appliance Review','creator_review','Review appliance dapur berdasarkan ciri yang kelihatan dan fakta disahkan.',15,'["nexabot"]'::jsonb,TRUE,TRUE,'Use the canonical compiler, Pawarna Creative DNA, Shariah Lock, identity and scale locks.','Compiled dynamically by the canonical AffiMatik masterprompt engine.',11),
  ('NX30','Dapur Problem Solver','problem_solution','Tugas dapur relatable diikuti satu penggunaan biasa yang disokong.',15,'["nexabot"]'::jsonb,TRUE,TRUE,'Use the canonical compiler, Pawarna Creative DNA, Shariah Lock, identity and scale locks.','Compiled dynamically by the canonical AffiMatik masterprompt engine.',11)
ON CONFLICT (id) DO NOTHING;

