/**
 * AFFIMATIK by Pawarna — Video Style Registry API Endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllVideoStyles, filterVideoStyles, getVideoStyle } from '@/lib/styles/registry';
import { SmartStyleMatcher } from '@/lib/engine/smart-match';
import { AICreativeDirector } from '@/lib/engine/creative-director';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const styleId = searchParams.get('id');
  const category = searchParams.get('category') as any;
  const engine = searchParams.get('engine') as any;
  const duration = searchParams.get('duration') ? Number(searchParams.get('duration')) as 10 | 15 : undefined;
  const hasVoice = searchParams.get('hasVoice') !== null ? searchParams.get('hasVoice') === 'true' : undefined;
  const search = searchParams.get('search') || undefined;

  // Single style detail
  if (styleId) {
    const style = getVideoStyle(styleId);
    if (!style) {
      return NextResponse.json({ error: `Gaya video '${styleId}' tidak ditemui.` }, { status: 404 });
    }
    return NextResponse.json({ style });
  }

  // Filter styles
  const styles = filterVideoStyles({
    category,
    engine,
    duration,
    hasVoice,
    searchQuery: search,
  });

  return NextResponse.json({
    count: styles.length,
    styles,
  });
}

/**
 * Smart Style Match Recommendation
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { productName, productCategory, productFacts } = body;

    const profile = AICreativeDirector.extractProductProfile({
      productName,
      productCategory,
      productFacts,
    });

    const allStyles = getAllVideoStyles();
    const recommendations = SmartStyleMatcher.recommend(profile, allStyles);

    return NextResponse.json({
      productProfile: profile,
      recommendations,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
