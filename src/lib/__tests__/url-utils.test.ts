import { describe, it, expect } from 'vitest';
import { sanitizeDriveUrl } from '../url-utils';

describe('sanitizeDriveUrl', () => {
  it('returns empty string unchanged', () => {
    expect(sanitizeDriveUrl('')).toBe('');
    expect(sanitizeDriveUrl('   ')).toBe('');
  });

  it('leaves non-Drive URLs unchanged', () => {
    const url = 'https://example.com/image.jpg';
    expect(sanitizeDriveUrl(url)).toBe(url);
  });

  it('leaves already-converted uc URLs unchanged', () => {
    const url = 'https://drive.google.com/uc?export=view&id=abc123';
    expect(sanitizeDriveUrl(url)).toBe(url);
  });

  it('converts /file/d/{ID}/view with query params', () => {
    const input = 'https://drive.google.com/file/d/abc123XYZ/view?usp=sharing';
    expect(sanitizeDriveUrl(input)).toBe('https://drive.google.com/uc?export=view&id=abc123XYZ');
  });

  it('converts /file/d/{ID}/view without query params', () => {
    const input = 'https://drive.google.com/file/d/abc123XYZ/view';
    expect(sanitizeDriveUrl(input)).toBe('https://drive.google.com/uc?export=view&id=abc123XYZ');
  });

  it('converts /open?id={ID} pattern', () => {
    const input = 'https://drive.google.com/open?id=abc123XYZ';
    expect(sanitizeDriveUrl(input)).toBe('https://drive.google.com/uc?export=view&id=abc123XYZ');
  });

  it('trims surrounding whitespace before processing', () => {
    const input = '  https://drive.google.com/file/d/abc123/view  ';
    expect(sanitizeDriveUrl(input)).toBe('https://drive.google.com/uc?export=view&id=abc123');
  });
});
