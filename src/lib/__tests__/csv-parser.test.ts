import { describe, it, expect } from 'vitest';
import { detectFormat, parseRows } from '../csv-parser';

describe('detectFormat', () => {
  it('returns case-a when headers contain "Nombre"', () => {
    expect(detectFormat(['Nombre', 'Cantidad', 'Precio de compra'])).toBe('case-a');
  });

  it('returns case-b when headers contain "Producto"', () => {
    expect(detectFormat(['Categoría', 'Producto', 'UOM'])).toBe('case-b');
  });

  it('returns unknown for unrecognized headers', () => {
    expect(detectFormat(['Column1', 'Column2'])).toBe('unknown');
    expect(detectFormat([])).toBe('unknown');
  });

  it('trims whitespace from headers before detecting', () => {
    expect(detectFormat(['  Nombre  ', 'Cantidad'])).toBe('case-a');
    expect(detectFormat([' Producto ', 'UOM'])).toBe('case-b');
  });
});

describe('parseRows', () => {
  it('returns empty result for empty rows array', () => {
    const result = parseRows([]);
    expect(result.products).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('returns error for unrecognized format', () => {
    const result = parseRows([{ Column1: 'value', Column2: 'other' }]);
    expect(result.products).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });

  it('parses case-a rows: name, stock, unit, prices', () => {
    const rows = [
      {
        Nombre: 'Resistencia 10k',
        Cantidad: '50 pz',
        'Precio de compra': '$1.50',
        'Precio de venta': '$3.00',
        Foto: '',
        'Ficha tecnica': '',
      },
    ];
    const { products, errors } = parseRows(rows);
    expect(errors).toHaveLength(0);
    expect(products).toHaveLength(1);
    expect(products[0].name).toBe('Resistencia 10k');
    expect(products[0].stock).toBe(50);
    expect(products[0].unit).toBe('pz');
    expect(products[0].purchasePrice).toBe(1.5);
    expect(products[0].salePrice).toBe(3.0);
  });

  it('parses case-b rows: name, category, stock, reorderPoint, prices', () => {
    const rows = [
      {
        Producto: 'Filtro aceite',
        Categoría: 'Automotriz',
        Subcategoría: 'Filtros',
        UOM: 'pza',
        'Aplicaciones/Especificación': 'Motor V6',
        'Stock inicial sugerido': '10',
        'Punto de reorden': '3',
        Notas: '',
        Foto: '',
        'Ficha tecnica': '',
        'Precio de compra': '45',
        'Precio de venta': '80',
        'Link de video': '',
      },
    ];
    const { products, errors } = parseRows(rows);
    expect(errors).toHaveLength(0);
    expect(products).toHaveLength(1);
    expect(products[0].name).toBe('Filtro aceite');
    expect(products[0].category).toBe('Automotriz');
    expect(products[0].stock).toBe(10);
    expect(products[0].reorderPoint).toBe(3);
    expect(products[0].purchasePrice).toBe(45);
    expect(products[0].salePrice).toBe(80);
  });

  it('reports an error for rows with an empty name', () => {
    const rows = [
      { Nombre: '', Cantidad: '5', 'Precio de compra': '10', 'Precio de venta': '20', Foto: '', 'Ficha tecnica': '' },
    ];
    const { products, errors } = parseRows(rows);
    expect(products).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].row).toBe(2);
  });

  it('attaches _sheetMeta when rowIndices and sheetName are provided', () => {
    const rows = [
      { Nombre: 'Capacitor', Cantidad: '100', 'Precio de compra': '0.5', 'Precio de venta': '1', Foto: '', 'Ficha tecnica': '' },
    ];
    const { products } = parseRows(rows, { rowIndices: [3], sheetName: 'Electrónica' });
    expect(products[0]._sheetMeta).toEqual({
      sheetName: 'Electrónica',
      rowIndex: 3,
      format: 'case-a',
    });
  });

  it('skips _sheetMeta when no rowIndices/sheetName provided', () => {
    const rows = [
      { Nombre: 'LED', Cantidad: '200', 'Precio de compra': '0.1', 'Precio de venta': '0.5', Foto: '', 'Ficha tecnica': '' },
    ];
    const { products } = parseRows(rows);
    expect(products[0]._sheetMeta).toBeUndefined();
  });

  it('parses prices with comma-separated thousands', () => {
    const rows = [
      { Nombre: 'Motor', Cantidad: '1', 'Precio de compra': '$1,500.00', 'Precio de venta': '$2,000', Foto: '', 'Ficha tecnica': '' },
    ];
    const { products } = parseRows(rows);
    expect(products[0].purchasePrice).toBe(1500);
    expect(products[0].salePrice).toBe(2000);
  });
});
