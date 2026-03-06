import type { InventoryItem } from './types';

export interface ValidationError {
  field: string;
  message: string;
}

export function validateProduct(
  data: Partial<InventoryItem>,
): ValidationError[] {
  const errors: ValidationError[] = [];

  const requiredStrings: Array<[keyof InventoryItem, string]> = [
    ['name', 'Nombre'],
    ['category', 'Categoría'],

    ['description', 'Descripción'],
    ['unit', 'Unidad'],
    ['imageUrl', 'URL de imagen'],
  ];

  for (const [field, label] of requiredStrings) {
    const val = data[field];
    if (typeof val !== 'string' || !val.trim()) {
      errors.push({ field, message: `${label} es obligatorio` });
    }
  }

  const numericFields: Array<[keyof InventoryItem, string]> = [
    ['stock', 'Stock'],
    ['purchasePrice', 'Precio de compra'],
    ['salePrice', 'Precio de venta'],
    ['reorderPoint', 'Punto de reorden'],
  ];

  for (const [field, label] of numericFields) {
    const val = data[field];
    if (val == null || typeof val !== 'number' || isNaN(val)) {
      errors.push({ field, message: `${label} es obligatorio` });
    } else if (val < 0) {
      errors.push({ field, message: `${label} debe ser >= 0` });
    }
  }

  return errors;
}
