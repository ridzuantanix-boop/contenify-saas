export const OFFICIAL_COLLECTION_VERSION = '1.0';

export type OfficialAvatar = {
  id: string;
  name: string;
  description: string;
  gender: 'female' | 'male';
  ageGroup: 'young' | 'mature' | 'senior';
  personality: 'friendly' | 'professional';
  category: string;
  suggestedNiches: string[];
  thumbnailUrl: string;
  referenceUrl: string;
  imageUrl: string;
  consentConfirmed: true;
  official: true;
  readOnly: true;
  source: 'official';
  version: string;
};

export type OfficialBackground = {
  id: string;
  name: string;
  description: string;
  category: 'living' | 'kitchen' | 'beauty' | 'workspace' | 'lifestyle' | 'automotive' | 'outdoor';
  suggestedNiches: string[];
  thumbnailUrl: string;
  referenceUrl: string;
  imageUrl: string;
  official: true;
  readOnly: true;
  source: 'official';
  version: string;
};

const avatar = (
  code: string,
  slug: string,
  name: string,
  gender: OfficialAvatar['gender'],
  ageGroup: OfficialAvatar['ageGroup'],
  personality: OfficialAvatar['personality'],
  description: string,
  suggestedNiches: string[],
): OfficialAvatar => ({
  id: `official-avatar-${code}`,
  name,
  description,
  gender,
  ageGroup,
  personality,
  category: `${ageGroup}-${gender}`,
  suggestedNiches,
  thumbnailUrl: `/official-assets/avatars/thumbs/${slug}.webp`,
  referenceUrl: `/official-assets/avatars/${slug}.webp`,
  imageUrl: `/official-assets/avatars/thumbs/${slug}.webp`,
  consentConfirmed: true,
  official: true,
  readOnly: true,
  source: 'official',
  version: OFFICIAL_COLLECTION_VERSION,
});

export const OFFICIAL_AVATARS: OfficialAvatar[] = [
  avatar('a01', 'a01-aina-mesra', 'Aina Mesra', 'female', 'young', 'friendly', 'Pencipta muda yang ceria dan mudah didekati.', ['beauty', 'fashion', 'home']),
  avatar('a02', 'a02-nadia-profesional', 'Nadia Profesional', 'female', 'young', 'professional', 'Penyampai muda yang tenang dan kemas.', ['wellness', 'gadgets', 'office']),
  avatar('a03', 'a03-mariam-mesra', 'Mariam Mesra', 'female', 'mature', 'friendly', 'Personaliti matang yang hangat dan ekspresif.', ['kitchen', 'home', 'wellness']),
  avatar('a04', 'a04-farah-profesional', 'Farah Profesional', 'female', 'mature', 'professional', 'Penyampai matang yang yakin dan dipercayai.', ['beauty', 'wellness', 'office']),
  avatar('a05', 'a05-halimah-ceria', 'Halimah Ceria', 'female', 'senior', 'friendly', 'Personaliti senior yang ramah dan ceria.', ['kitchen', 'home', 'gardening']),
  avatar('a06', 'a06-salmah-tenang', 'Salmah Tenang', 'female', 'senior', 'professional', 'Penyampai senior yang tenang dan meyakinkan.', ['wellness', 'home', 'gardening']),
  avatar('a07', 'a07-amir-mesra', 'Amir Mesra', 'male', 'young', 'friendly', 'Pencipta muda yang santai dan bertenaga.', ['gadgets', 'automotive', 'lifestyle']),
  avatar('a08', 'a08-danish-profesional', 'Danish Profesional', 'male', 'young', 'professional', 'Penyampai muda yang fokus dan profesional.', ['gadgets', 'office', 'automotive']),
  avatar('a09', 'a09-hakim-mesra', 'Hakim Mesra', 'male', 'mature', 'friendly', 'Personaliti matang yang ramah dan bersahaja.', ['home', 'automotive', 'lifestyle']),
  avatar('a10', 'a10-rizal-profesional', 'Rizal Profesional', 'male', 'mature', 'professional', 'Penyampai matang yang kemas dan berwibawa.', ['office', 'gadgets', 'automotive']),
  avatar('a11', 'a11-rahman-ceria', 'Rahman Ceria', 'male', 'senior', 'friendly', 'Personaliti senior yang ceria dan mesra.', ['home', 'gardening', 'automotive']),
  avatar('a12', 'a12-ismail-tenang', 'Ismail Tenang', 'male', 'senior', 'professional', 'Penyampai senior yang tenang dan diyakini.', ['wellness', 'home', 'office']),
];

const background = (
  code: string,
  slug: string,
  name: string,
  category: OfficialBackground['category'],
  description: string,
  suggestedNiches: string[],
): OfficialBackground => ({
  id: `official-background-${code}`,
  name,
  description,
  category,
  suggestedNiches,
  thumbnailUrl: `/official-assets/backgrounds/thumbs/${slug}.webp`,
  referenceUrl: `/official-assets/backgrounds/${slug}.webp`,
  imageUrl: `/official-assets/backgrounds/thumbs/${slug}.webp`,
  official: true,
  readOnly: true,
  source: 'official',
  version: OFFICIAL_COLLECTION_VERSION,
});

export const OFFICIAL_BACKGROUNDS: OfficialBackground[] = [
  background('b01', 'b01-ruang-tamu-beige', 'Ruang Tamu Beige', 'living', 'Ruang tamu beige hangat dengan ruang presenter yang lapang.', ['home', 'beauty', 'fashion']),
  background('b02', 'b02-ruang-tamu-cerah', 'Ruang Tamu Cerah', 'living', 'Ruang tamu minimalis cerah dan realistik.', ['home', 'wellness', 'lifestyle']),
  background('b03', 'b03-dapur-putih', 'Dapur Moden Putih', 'kitchen', 'Dapur putih praktikal dengan kaunter kosong.', ['kitchen', 'home']),
  background('b04', 'b04-dapur-kayu', 'Dapur Kayu Natural', 'kitchen', 'Dapur kayu natural dengan cahaya siang.', ['kitchen', 'home']),
  background('b05', 'b05-beauty-vanity', 'Beauty Vanity', 'beauty', 'Meja solek neutral yang bersih dan estetik.', ['beauty', 'fashion']),
  background('b06', 'b06-skincare-bathroom', 'Skincare Bathroom', 'beauty', 'Kaunter bilik air moden untuk produk penjagaan diri.', ['beauty', 'wellness']),
  background('b07', 'b07-creator-desk', 'Creator Desk', 'workspace', 'Meja pencipta minimalis dengan ruang demo produk.', ['gadgets', 'beauty', 'lifestyle']),
  background('b08', 'b08-office-desk', 'Office Profesional', 'workspace', 'Meja kerja profesional yang kemas dan dipercayai.', ['office', 'gadgets', 'wellness']),
  background('b09', 'b09-gaming-rgb', 'Gaming Room RGB', 'workspace', 'Bilik gaming realistik dengan cahaya RGB lembut.', ['gadgets', 'gaming']),
  background('b10', 'b10-bilik-tidur', 'Bilik Tidur Cozy', 'living', 'Bilik tidur hangat, kemas dan selesa.', ['home', 'beauty', 'fashion']),
  background('b11', 'b11-studio-ugc', 'Studio UGC Neutral', 'workspace', 'Sudut UGC neutral dengan ruang aksi besar.', ['beauty', 'gadgets', 'lifestyle']),
  background('b12', 'b12-rak-produk', 'Sudut Rak Produk', 'lifestyle', 'Rak produk neutral dengan ruang paparan kosong.', ['home', 'beauty', 'gadgets']),
  background('b13', 'b13-home-cafe', 'Home Café Corner', 'lifestyle', 'Sudut kopi rumah yang hangat dan santai.', ['kitchen', 'home', 'lifestyle']),
  background('b14', 'b14-dining-table', 'Dining Table', 'lifestyle', 'Meja makan cerah dengan permukaan luas.', ['kitchen', 'home']),
  background('b15', 'b15-garaj-automotif', 'Garaj Automotif', 'automotive', 'Garaj rumah praktikal dengan ruang demonstrasi.', ['automotive', 'gadgets']),
  background('b16', 'b16-interior-kereta', 'Interior Kereta', 'automotive', 'Interior kereta moden yang diparkir dengan selamat.', ['automotive', 'gadgets']),
  background('b17', 'b17-taman-rumah', 'Taman Rumah', 'outdoor', 'Taman tropika rumah Malaysia yang terang dan lapang.', ['gardening', 'home', 'wellness']),
  background('b18', 'b18-patio-outdoor', 'Patio Outdoor', 'outdoor', 'Patio berbumbung yang santai dan realistik.', ['gardening', 'home', 'lifestyle']),
];

export const findOfficialAvatar = (id: string | null | undefined) => OFFICIAL_AVATARS.find((item) => item.id === id) || null;
export const findOfficialBackground = (id: string | null | undefined) => OFFICIAL_BACKGROUNDS.find((item) => item.id === id) || null;
export const isOfficialAssetId = (value: unknown) => typeof value === 'string' && Boolean(findOfficialAvatar(value) || findOfficialBackground(value));

function bytesToDataUri(bytes: Uint8Array, mimeType: string) {
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    chunks.push(String.fromCharCode(...Array.from(bytes.subarray(offset, offset + 0x8000))));
  }
  return `data:${mimeType};base64,${btoa(chunks.join(''))}`;
}

export async function officialAssetDataUri(req: Request, relativePath: string): Promise<string> {
  if (!relativePath.startsWith('/official-assets/') || relativePath.includes('..')) throw new Error('Laluan aset rasmi tidak sah.');
  const headers: Record<string, string> = {};
  const cookie = req.headers.get('cookie');
  const stagingKey = req.headers.get('x-affimatik-staging-key');
  if (cookie) headers.cookie = cookie;
  if (stagingKey) headers['x-affimatik-staging-key'] = stagingKey;
  const response = await fetch(new URL(relativePath, req.url), { headers, cache: 'force-cache' });
  const mimeType = response.headers.get('content-type')?.split(';')[0] || '';
  if (!response.ok || mimeType !== 'image/webp') throw new Error('Aset rasmi tidak dapat disahkan sebelum penjanaan. Tiada kredit ditolak.');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length < 100 || bytes.length > 1024 * 1024) throw new Error('Saiz aset rasmi tidak sah. Tiada kredit ditolak.');
  return bytesToDataUri(bytes, mimeType);
}
