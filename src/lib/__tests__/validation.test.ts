import { describe, it, expect } from 'vitest';
import { validateProduct } from '../validation';

const VALID: Parameters<typeof validateProduct>[0] = {
  name: 'Filtro aceite',
  category: 'Automotriz',
  description: 'Motor V6',
  unit: 'pza',
  imageUrl: 'https://example.com/img.jpg',
  stock: 10,
  purchasePrice: 50,
  salePrice: 100,
  reorderPoint: 2,
};

describe('validateProduct', () => {
  it('returns no errors for a fully valid product', () => {
    expect(validateProduct(VALID)).toHaveLength(0);
  });

  it('allows zero for numeric fields', () => {
    const errors = validateProduct({ ...VALID, stock: 0, reorderPoint: 0, purchasePrice: 0, salePrice: 0 });
    expect(errors).toHaveLength(0);
  });

  it('requires name', () => {
    expect(validateProduct({ ...VALID, name: '' }).some(e => e.field === 'name')).toBe(true);
  });

  it('requires category', () => {
    expect(validateProduct({ ...VALID, category: '' }).some(e => e.field === 'category')).toBe(true);
  });

  it('requires description', () => {
    expect(validateProduct({ ...VALID, description: '' }).some(e => e.field === 'description')).toBe(true);
  });

  it('requires unit', () => {
    expect(validateProduct({ ...VALID, unit: '' }).some(e => e.field === 'unit')).toBe(true);
  });

  it('requires imageUrl', () => {
    expect(validateProduct({ ...VALID, imageUrl: '' }).some(e => e.field === 'imageUrl')).toBe(true);
  });

  it('rejects negative stock', () => {
    expect(validateProduct({ ...VALID, stock: -1 }).some(e => e.field === 'stock')).toBe(true);
  });

  it('rejects negative purchasePrice', () => {
    expect(validateProduct({ ...VALID, purchasePrice: -5 }).some(e => e.field === 'purchasePrice')).toBe(true);
  });

  it('rejects NaN salePrice', () => {
    expect(validateProduct({ ...VALID, salePrice: NaN }).some(e => e.field === 'salePrice')).toBe(true);
  });

  it('rejects undefined numeric fields', () => {
    expect(validateProduct({ ...VALID, stock: undefined }).some(e => e.field === 'stock')).toBe(true);
    expect(validateProduct({ ...VALID, reorderPoint: undefined }).some(e => e.field === 'reorderPoint')).toBe(true);
  });
});
