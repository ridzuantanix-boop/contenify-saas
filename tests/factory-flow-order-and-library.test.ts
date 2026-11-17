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
    expect(factory).toContain('onClick={() => setSelectedStyleId(style.id)}');
    expect(factory).toContain("event.key === 'Enter' || event.key === ' '");
    expect(factory).not.toContain("{isSelected ? 'Dipilih' : 'Pilih Gaya'}");
  });

  it('confirms the chosen style only after the style picker', () => {
    const picker = factory.indexOf('id="style-step"');
    const confirmation = factory.indexOf('data-testid="selected-style-confirmation"');
    expect(confirmation).toBeGreaterThan(picker);
    expect(factory).toContain('Gaya dipilih');
    expect(factory).toContain('Tukar Gaya');
    expect(factory).toContain('<SummaryRow label="Gaya" value={selectedStyle.name}');
  });
});
