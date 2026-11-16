/** Customer-facing metadata for the 30 official AffiMatik styles. */
export const STYLE_MARKETING_IDS = [
  'NX01', 'NX02', 'NX03', 'NX05', 'NX07', 'NX09', 'NX10',
  'RH01', 'RH02', 'RH03', 'RH04', 'RH17', 'RH19',
  'NX11', 'NX12', 'NX13', 'NX14', 'NX15', 'NX16', 'NX17',
  'NX21', 'NX22', 'NX23', 'NX24', 'NX25', 'NX26', 'NX27', 'NX28', 'NX29', 'NX30',
] as const;

export type StyleMarketingId = (typeof STYLE_MARKETING_IDS)[number];
export type StyleMarketingCategory =
  | 'Review & Creator'
  | 'Demo & Produk'
  | 'POV'
  | 'Lifestyle'
  | 'Cerita & Masalah'
  | 'Soft Sell'
  | 'Fesyen'
  | 'Dapur';

export interface StyleMarketingMetadata {
  id: StyleMarketingId;
  title: string;
  description: string;
  tagline: string;
  tags: readonly [string, string] | readonly [string, string, string];
  categoryLabel: StyleMarketingCategory;
  thumbnailPath: `/style-posters/${StyleMarketingId}.webp`;
  previewPath: `/api/style-samples/${StyleMarketingId}`;
  niches: readonly string[];
  creativeDirectionRef: `style:${StyleMarketingId}`;
  previewStatus: 'verified_media' | 'development_placeholder';
}

type MetadataSeed = Omit<
  StyleMarketingMetadata,
  'id' | 'thumbnailPath' | 'previewPath' | 'creativeDirectionRef' | 'previewStatus'
> & { previewStatus?: StyleMarketingMetadata['previewStatus'] };

function defineStyle(id: StyleMarketingId, seed: MetadataSeed): StyleMarketingMetadata {
  return {
    id,
    ...seed,
    thumbnailPath: `/style-posters/${id}.webp`,
    previewPath: `/api/style-samples/${id}`,
    creativeDirectionRef: `style:${id}`,
    previewStatus: seed.previewStatus ?? 'verified_media',
  };
}

export const STYLE_MARKETING_METADATA: Record<StyleMarketingId, StyleMarketingMetadata> = {
  NX01: defineStyle('NX01', { title: 'Sembang Kawan Santai', description: 'Creator borak macam kawan sambil berkongsi kegunaan produk secara natural.', tagline: 'Mesra, natural, mudah percaya', tags: ['Creator', 'Mesra', 'BM Malaysia'], categoryLabel: 'Review & Creator', niches: ['Semua produk'] }),
  NX02: defineStyle('NX02', { title: 'Review Sambil Pegang', description: 'Presenter pegang produk dan terangkan satu fungsi penting dengan ringkas dan jelas.', tagline: 'Fungsi utama, terus jelas', tags: ['Review', 'Produk di tangan', 'Praktikal'], categoryLabel: 'Review & Creator', niches: ['Semua produk'] }),
  NX03: defineStyle('NX03', { title: 'Reaksi Pandang Pertama', description: 'Reaksi spontan apabila melihat produk, tanpa berpura-pura sudah mencubanya.', tagline: 'Rasa ingin tahu yang jujur', tags: ['Reaksi', 'Spontan', 'Jujur'], categoryLabel: 'Review & Creator', niches: ['Semua produk'] }),
  NX05: defineStyle('NX05', { title: 'Masalah Harian & Produk', description: 'Mulakan dengan masalah biasa, kemudian perkenalkan produk sebagai pilihan relevan.', tagline: 'Masalah relatable, pilihan relevan', tags: ['Masalah harian', 'Relatable', 'Pilihan'], categoryLabel: 'Cerita & Masalah', niches: ['Semua produk'] }),
  NX07: defineStyle('NX07', { title: 'Soalan Buyer, Jawapan Ringkas', description: 'Jawab satu soalan biasa tentang produk dengan gaya mesra dan mudah faham.', tagline: 'Satu soalan, satu jawapan jelas', tags: ['Q&A', 'Buyer', 'Fakta'], categoryLabel: 'Review & Creator', niches: ['Semua produk'] }),
  NX09: defineStyle('NX09', { title: 'Produk Bergerak + Voiceover', description: 'Fokus pada produk yang digerakkan perlahan sambil suara latar menerangkan kegunaannya.', tagline: 'Produk fokus, suara santai', tags: ['Hand demo', 'Voiceover', 'Produk fokus'], categoryLabel: 'Demo & Produk', niches: ['Semua produk'] }),
  NX10: defineStyle('NX10', { title: 'Fakta Pada Label', description: 'Tonjolkan satu maklumat yang jelas tertera pada label produk dengan voiceover.', tagline: 'Fakta terlihat, penerangan tepat', tags: ['Label', 'Voiceover', 'Fakta'], categoryLabel: 'Demo & Produk', niches: ['Produk berbungkus', 'Makanan & minuman', 'Kesihatan & kecantikan'] }),
  RH01: defineStyle('RH01', { title: 'Goyang Produk Natural', description: 'Tangan gerakkan produk perlahan ke kiri dan kanan dengan voiceover minimum.', tagline: 'Gerakan kecil, fokus maksimum', tags: ['Hand demo', 'Natural', 'Voiceover'], categoryLabel: 'Demo & Produk', niches: ['Semua produk'] }),
  RH02: defineStyle('RH02', { title: 'Putar Sudut Produk Perlahan', description: 'Gerakan tilt kecil untuk memperlihatkan bentuk produk sebelum diletakkan semula.', tagline: 'Lihat bentuk dari sudut natural', tags: ['Tilt', 'Tabletop', 'Bentuk produk'], categoryLabel: 'Demo & Produk', niches: ['Produk berbungkus', 'Kecantikan', 'Gajet', 'Barangan rumah'] }),
  RH03: defineStyle('RH03', { title: 'Ambil, Pegang & Letak', description: 'Tangan ambil produk dari meja, tunjuk seketika dan letak semula secara natural.', tagline: 'Skala sebenar melalui gerakan tangan', tags: ['Pick up', 'Tabletop', 'Natural'], categoryLabel: 'Demo & Produk', niches: ['Produk berbungkus', 'Gajet', 'Barangan rumah'] }),
  RH04: defineStyle('RH04', { title: 'Ambil Produk Dari Rak', description: 'Tunjukkan produk diambil dari rak rumah seperti rutin harian yang sebenar.', tagline: 'Rutin rak yang terasa nyata', tags: ['Rak rumah', 'Lifestyle', 'Hand demo'], categoryLabel: 'Lifestyle', niches: ['Barangan rumah', 'Makanan & minuman', 'Kesihatan & kecantikan'] }),
  RH17: defineStyle('RH17', { title: 'Produk Dalam Setup Meja', description: 'Paparkan produk dalam suasana meja kerja atau belajar yang kemas dan realistik.', tagline: 'Produk menyatu dalam ruang kerja', tags: ['Meja kerja', 'Lifestyle', 'Produktiviti'], categoryLabel: 'Lifestyle', niches: ['Gajet', 'Lampu', 'Alat tulis', 'Aksesori'] }),
  RH19: defineStyle('RH19', { title: 'Produk Dalam Cahaya Tingkap', description: 'Tonjolkan rupa produk menggunakan cahaya siang yang lembut dan natural.', tagline: 'Rupa jujur dalam cahaya natural', tags: ['Daylight', 'Produk fokus', 'Natural'], categoryLabel: 'Demo & Produk', niches: ['Semua produk'] }),
  NX11: defineStyle('NX11', { title: 'POV Tengok Produk', description: 'Rakaman sudut pandang pengguna ketika melihat dan menilai produk secara dekat.', tagline: 'Lihat produk dari mata buyer', tags: ['POV', 'Buyer', 'Produk dekat'], categoryLabel: 'POV', niches: ['Semua produk'] }),
  NX12: defineStyle('NX12', { title: 'Jumpa Barang Menarik', description: 'Creator berkongsi penemuan produk dengan reaksi ceria dan rasa ingin tahu.', tagline: 'Tenaga discovery yang genuine', tags: ['Discovery', 'Creator', 'Ceria'], categoryLabel: 'Review & Creator', niches: ['Semua produk'] }),
  NX13: defineStyle('NX13', { title: 'Borak Santai Di Dapur', description: 'Creator cerita tentang produk makanan, minuman atau barang dapur dalam suasana rumah.', tagline: 'Cerita dapur yang terasa dekat', tags: ['Dapur', 'Creator', 'Lifestyle'], categoryLabel: 'Lifestyle', niches: ['Makanan & minuman', 'Peralatan dapur', 'Pembersihan'] }),
  NX14: defineStyle('NX14', { title: 'Review Di Meja Kerja', description: 'Presenter cerita tentang produk yang relevan dengan kerja atau belajar.', tagline: 'Review fokus untuk rutin produktif', tags: ['Meja kerja', 'Review', 'Produktiviti'], categoryLabel: 'Lifestyle', niches: ['Gajet', 'Lampu', 'Alat tulis', 'Aksesori'] }),
  NX15: defineStyle('NX15', { title: 'Cerita Masalah Pendek', description: 'Penceritaan ringkas tentang situasi harian sebelum menunjukkan produk yang sesuai.', tagline: 'Cerita pendek, penyelesaian relevan', tags: ['Story', 'Masalah harian', 'Relatable'], categoryLabel: 'Cerita & Masalah', niches: ['Semua produk'] }),
  NX16: defineStyle('NX16', { title: 'Soft Sell Tanpa Paksa', description: 'Cadangan produk secara lembut, santai dan tidak terlalu menjual.', tagline: 'Cadangan ringan, tiada tekanan', tags: ['Soft sell', 'Santai', 'Lifestyle'], categoryLabel: 'Soft Sell', niches: ['Semua produk'] }),
  NX17: defineStyle('NX17', { title: 'Recommend Secara Spontan', description: 'Creator teringat satu produk berguna lalu berkongsi sebab yang relevan secara spontan.', tagline: 'Cadangan spontan yang product-specific', tags: ['Recommend', 'Spontan', 'Creator'], categoryLabel: 'Review & Creator', niches: ['Semua produk'] }),
  NX21: defineStyle('NX21', { title: 'Kurung Catwalk', description: 'Persembahan penuh baju kurung dengan langkah perlahan dan gerakan fabrik yang natural.', tagline: 'Potongan kurung jelas, gerakan sopan', tags: ['Baju kurung', 'Full look', 'Muslimah'], categoryLabel: 'Fesyen', niches: ['Baju kurung', 'Pakaian Muslimah'], previewStatus: 'verified_media' }),
  NX22: defineStyle('NX22', { title: 'Kebaya Elegance', description: 'Showcase kebaya labuh yang sopan dengan fokus pada jahitan, tekstur dan jatuhan fabrik.', tagline: 'Detail kebaya labuh yang elegan', tags: ['Kebaya labuh', 'Detail fabrik', 'Muslimah'], categoryLabel: 'Fesyen', niches: ['Kebaya labuh', 'Pakaian acara'], previewStatus: 'verified_media' }),
  NX23: defineStyle('NX23', { title: 'Tudung Styling', description: 'Paparan drape, liputan dan rupa fabrik tudung tanpa membuka aurat sepanjang video.', tagline: 'Drape tudung jelas dan sopan', tags: ['Tudung', 'Drape', 'Coverage'], categoryLabel: 'Fesyen', niches: ['Tudung', 'Hijab', 'Aksesori Muslimah'], previewStatus: 'verified_media' }),
  NX24: defineStyle('NX24', { title: 'OOTD Mirror Review', description: 'Review OOTD gaya telefon pintar di hadapan cermin oleh presenter Muslimah yang natural.', tagline: 'OOTD real, bukan runway', tags: ['OOTD', 'Mirror review', 'Muslimah'], categoryLabel: 'Fesyen', niches: ['Pakaian Muslimah', 'Set pakaian'], previewStatus: 'verified_media' }),
  NX25: defineStyle('NX25', { title: 'Kids Outfit Showcase', description: 'Pakaian kanak-kanak dipamer pada hanger, mannequin atau flat-lay tanpa memerlukan wajah kanak-kanak.', tagline: 'Kidswear jelas tanpa child actor', tags: ['Kidswear', 'Hanger', 'Flat-lay'], categoryLabel: 'Fesyen', niches: ['Pakaian kanak-kanak'], previewStatus: 'verified_media' }),
  NX26: defineStyle('NX26', { title: 'Boutique Collection', description: 'Persembahan butik yang bergerak antara siluet dan detail pakaian tanpa mencipta varian baharu.', tagline: 'Rasa butik, identiti pakaian kekal', tags: ['Boutique', 'Garment detail', 'Collection'], categoryLabel: 'Fesyen', niches: ['Pakaian Muslimah', 'Koleksi butik'], previewStatus: 'verified_media' }),
  NX27: defineStyle('NX27', { title: 'Kuali Cooking Demo', description: 'Demo kuali atau pan dalam dapur Malaysia dengan fizik perkakas, haba dan makanan yang believable.', tagline: 'Demo memasak yang realistik', tags: ['Kuali', 'Cooking demo', 'Dapur'], categoryLabel: 'Dapur', niches: ['Kuali', 'Pan', 'Cookware'], previewStatus: 'verified_media' }),
  NX28: defineStyle('NX28', { title: 'Air Fryer Demo', description: 'Urutan penggunaan air fryer yang munasabah sambil mengekalkan reka bentuk dan kawalan sebenar.', tagline: 'Air fryer dalam rutin sebenar', tags: ['Air fryer', 'Appliance', 'Demo'], categoryLabel: 'Dapur', niches: ['Air fryer'], previewStatus: 'verified_media' }),
  NX29: defineStyle('NX29', { title: 'Kitchen Appliance Review', description: 'Review kontekstual untuk rice cooker, microwave, oven atau perkakas dapur setara.', tagline: 'Perkakas dapur dinilai dalam konteks', tags: ['Appliance', 'Review', 'Dapur'], categoryLabel: 'Dapur', niches: ['Rice cooker', 'Microwave', 'Oven', 'Perkakas dapur'], previewStatus: 'verified_media' }),
  NX30: defineStyle('NX30', { title: 'Dapur Problem Solver', description: 'Mulakan dengan tugas dapur yang relatable lalu tunjuk penggunaan biasa produk secara praktikal.', tagline: 'Masalah dapur, penggunaan praktikal', tags: ['Problem solver', 'Praktikal', 'Dapur'], categoryLabel: 'Dapur', niches: ['Peralatan dapur', 'Cookware', 'Kitchen tools'], previewStatus: 'verified_media' }),
};

export function getStyleMarketingMetadata(id: string): StyleMarketingMetadata | undefined {
  return STYLE_MARKETING_METADATA[id as StyleMarketingId];
}

export const ALL_STYLE_MARKETING_METADATA = STYLE_MARKETING_IDS.map(
  (id) => STYLE_MARKETING_METADATA[id]
);
