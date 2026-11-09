export type CustomerFailureCategory = 'provider_unavailable' | 'provider_rejected' | 'media_invalid' | 'generation_failed';

export type CustomerFailure = {
  category: CustomerFailureCategory;
  headline: string;
  message: string;
  creditNotice: string;
  retryGuidance: string;
};

export function describeCustomerFailure(raw: unknown): CustomerFailure {
  const detail = raw instanceof Error ? raw.message : String(raw || '');

  if (/timeout|timed out|econn|network|fetch failed|http 429|http 5\d\d|gateway|unavailable|temporar|server|pelayan ai sedang terganggu|tidak dapat menyelesaikan sambungan/i.test(detail)) {
    return {
      category: 'provider_unavailable',
      headline: 'Pelayan AI Sedang Terganggu',
      message: 'Pelayan penjana video AI tidak dapat menyelesaikan sambungan kali ini. Tugasan AffiMatik anda sudah ditutup dengan selamat.',
      creditNotice: 'Kredit untuk tugasan ini telah dipulangkan secara automatik.',
      retryGuidance: 'Tunggu beberapa minit sebelum cuba lagi. Elakkan menekan Jana berulang kali ketika pelayan masih sibuk.',
    };
  }

  if (/moderation|policy|blocked|rejected|unsafe|content/i.test(detail)) {
    return {
      category: 'provider_rejected',
      headline: 'Input Tidak Dapat Diproses',
      message: 'Pelayan penjana video AI tidak menerima imej atau arahan untuk tugasan ini.',
      creditNotice: 'Kredit untuk tugasan ini telah dipulangkan secara automatik.',
      retryGuidance: 'Semak imej dan arahan, kemudian cuba semula dengan kandungan yang lebih jelas dan selamat.',
    };
  }

  if (/bukan mp4|trek video|saiz mp4|video tersimpan|tempoh atau audio|media|download/i.test(detail)) {
    return {
      category: 'media_invalid',
      headline: 'Video Diterima Tetapi Tidak Lengkap',
      message: 'Pelayan AI menghasilkan output, tetapi fail itu tidak melepasi pemeriksaan video AffiMatik.',
      creditNotice: 'Kredit untuk tugasan ini telah dipulangkan secara automatik.',
      retryGuidance: 'Cuba semula kemudian. AffiMatik tidak akan mengenakan kredit untuk fail yang tidak boleh digunakan.',
    };
  }

  return {
    category: 'generation_failed',
    headline: 'Pelayan AI Tidak Dapat Menyiapkan Video',
    message: 'Tugasan ini tidak dapat diselesaikan oleh pelayan penjana video AI. Ini boleh berlaku apabila pelayan sibuk atau generation ditolak tanpa sebab terperinci.',
    creditNotice: 'Kredit untuk tugasan ini telah dipulangkan secara automatik.',
    retryGuidance: 'Cuba semula selepas beberapa minit. Jika berulang, gunakan imej atau gaya lain sementara pelayan pulih.',
  };
}

export function customerFailureMessage(raw: unknown): string {
  const failure = describeCustomerFailure(raw);
  return `${failure.headline}. ${failure.message} ${failure.creditNotice} ${failure.retryGuidance}`;
}
