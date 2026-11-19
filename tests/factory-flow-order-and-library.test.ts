import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const factory = fs.readFileSync('src/app/(dashboard)/factory/page.tsx', 'utf8');
const selector = fs.readFileSync('src/components/factory/creator-profile-selector.tsx', 'utf8');

describe('Jana Video guided order and reusable product assets', () => {
  it('orders the four primary steps around the customer journey', () => {
    const creator = factory.indexOf('<CreatorProfileSelector');
    const product = factory.indexOf('id="product-step"');
    const style = factory.indexOf('id="style-step"');
    const creative = factory.indexOf('id="cta-step"');
    expect(creator).toBeGreaterThan(-1);
    expect(creator).toBeLessThan(product);
    expect(product).toBeLessThan(style);
    expect(style).toBeLessThan(creative);
    expect(selector).toContain('Pilih Creator Profile');
    expect(selector).toContain('>1</span>');
  });

  it('offers existing workspace product assets without re-uploading', () => {
    expect(factory).toContain("fetch('/api/products', { cache: 'no-store' })");
    expect(factory).toContain('Pilih dari Product Library');
    expect(factory).toContain('Product Library Anda');
    expect(factory).toContain('selectProductAsset(asset)');
    expect(factory).toContain('Tiada upload semula diperlukan.');
  });

  it('selects a style from the whole accessible card', () => {
    expect(factory).toContain('role="radiogroup"');
    expect(factory).toContain('role="radio"');
    expect(factory).toContain('onClick={() => selectVideoStyle(style.id)}');
    expect(factory).toContain("event.key === 'Enter' || event.key === ' '");
    expect(factory).not.toContain("{isSelected ? 'Dipilih' : 'Pilih Gaya'}");
  });

  it('keeps the 30-style picker short with favorites, recent styles and category filters', () => {
    expect(factory).toContain('Kegemaran');
    expect(factory).toContain('Baru Digunakan');
    expect(factory).toContain('affimatik:style-favorites-v1');
    expect(factory).toContain('affimatik:recent-styles-v1');
    expect(factory).toContain('displayedStyles.slice(0, 6)');
    expect(factory).toContain('Lihat Semua ${displayedStyles.length} Gaya');
    expect(factory).toContain('setStyleCategoryFilter(item.id)');
    expect(factory).toContain('setStylePickerExpanded(false)');
  });

  it('confirms the chosen style only after the style picker', () => {
    const picker = factory.indexOf('id="style-step"');
    const confirmation = factory.indexOf('data-testid="selected-style-confirmation"');
    expect(confirmation).toBeGreaterThan(picker);
    expect(factory).toContain('Gaya dipilih');
    expect(factory).toContain('Tukar Gaya');
    expect(factory).toContain('<SummaryRow label="Gaya" value={selectedStyle.name}');
  });

  it('keeps long mobile journeys navigable and moves users to live status after submission', () => {
    expect(factory).toContain('aria-label="Navigasi pantas Jana Video"');
    expect(factory).toContain('aria-label="Pergi ke Dashboard"');
    expect(factory).toContain('id="generation-status"');
    expect(factory).toContain("statusSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })");
    expect(factory).toContain('aria-label="Kembali ke atas"');
  });

  it('lets users prepare another video without cancelling the background job', () => {
    expect(factory).toContain('const prepareNextVideo = () =>');
    expect(factory).toContain('Jana Video Lain');
    expect(factory).toContain('Video ini terus diproses di background dan kekal dalam Senarai Tugasan.');
    expect(factory).not.toContain('images.length === 0 || hasActiveSubmission');
  });
});
