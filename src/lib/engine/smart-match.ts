/**
 * AFFIMATIK by Pawarna — Smart Style Match
 * Intelligent, deterministic style recommendation engine based on product format & complexity
 */

import { ProductProfile } from './types';
import { VideoStyle } from '../styles/types';

export interface StyleRecommendation {
  style: VideoStyle;
  matchScore: number; // 0 - 100
  matchReason: string;
}

export class SmartStyleMatcher {
  /**
   * Recommends the 3 most suitable styles for a given product profile
   */
  static recommend(product: ProductProfile, styles: VideoStyle[]): StyleRecommendation[] {
    const scored = styles.map((style) => {
      let score = 50;
      let reason = 'Sesuai untuk sebarang produk umum';

      // 1. Wearables / Fashion
      if (product.isWearableOrFashion) {
        if (style.id === 'NX01' || style.id === 'NX02') {
          score += 35;
          reason = 'Sesuai untuk model memperagakan tudung/pakaian sambil memberi ulasan';
        } else if (style.id === 'RH19' || style.id === 'RH17') {
          score += 30;
          reason = 'Pencahayaan tingkap semulajadi mempamerkan kualiti fabrik dengan jelas';
        } else if (style.id === 'NX09' || style.id === 'RH01') {
          score += 15;
          reason = 'Menunjukkan lipatan atau fabrik dari dekat';
        }
      }

      // 2. Liquid, Skincare, Beauty, Bottle/Jar
      else if (product.isLiquidOrPowder || product.packagingFormat === 'bottle' || product.packagingFormat === 'jar') {
        if (style.id === 'RH01' || style.id === 'RH02') {
          score += 40;
          reason = 'Pergerakan condong lembut mempamerkan kilauan botol dan tekstur cecair secara realistik';
        } else if (style.id === 'NX10') {
          score += 38;
          reason = 'Menerangkan fungsi dan bahan aktif yang tertera pada label botol';
        } else if (style.id === 'NX02') {
          score += 35;
          reason = 'Ulasan pencipta sambil memegang botol di paras dada dengan jelas';
        } else if (style.id === 'NX09') {
          score += 30;
          reason = 'Fokus pada botol dengan suara penerangan bahasa Melayu';
        }
      }

      // 3. Problem-solving or everyday consumer goods
      else if (product.packagingFormat === 'box' || product.packagingFormat === 'pouch' || product.packagingFormat === 'general') {
        if (style.id === 'NX05') {
          score += 40;
          reason = 'Menyerlahkan masalah harian yang boleh diselesaikan oleh produk ini';
        } else if (style.id === 'RH03') {
          score += 35;
          reason = 'Interaksi mengangkat dan meletakkan bungkusan di atas meja secara kemas';
        } else if (style.id === 'NX01') {
          score += 32;
          reason = 'Gaya santai bercerita tentang kelebihan produk kepada penonton';
        } else if (style.id === 'RH04') {
          score += 28;
          reason = 'Mengambil bungkusan dari rak rumah menampakkan suasana penggunaan sebenar';
        }
      }

      // 4. Gadgets / Electronics
      else if (product.packagingFormat === 'gadget') {
        if (style.id === 'RH17') {
          score += 42;
          reason = 'Susunan atas meja kerja moden amat sepadan dengan peranti elektronik';
        } else if (style.id === 'NX07') {
          score += 35;
          reason = 'Menjawab persoalan teknikal atau fungsi utama gajet secara direct';
        } else if (style.id === 'RH02') {
          score += 30;
          reason = 'Menunjukkan rekaan kemas dan port sambungan fizikal peranti';
        }
      }

      // Prioritize tested & verified styles
      if (style.qualityStatus === 'quality_verified' || style.qualityStatus === 'video_tested') {
        score += 5;
      }

      return {
        style,
        matchScore: Math.min(score, 100),
        matchReason: reason,
      };
    });

    // Sort descending by score
    scored.sort((a, b) => b.matchScore - a.matchScore);

    // Return top 3 recommendations
    return scored.slice(0, 3);
  }
}
