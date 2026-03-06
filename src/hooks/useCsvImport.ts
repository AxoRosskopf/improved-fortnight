'use client';

import { useState, useCallback } from 'react';
import Papa from 'papaparse';
import { InventoryItem } from '@/lib/types';
import { CsvFormat, detectFormat, parseRows } from '@/lib/csv-parser';

export interface CsvImportState {
  preview: InventoryItem[] | null;
  errors: Array<{ row: number; message: string }>;
  isLoading: boolean;
  format: CsvFormat | null;
  parse: (file: File, category?: 'Automotriz' | 'Tapicería') => void;
  confirm: () => InventoryItem[];
  reset: () => void;
}

export function useCsvImport(): CsvImportState {
  const [preview, setPreview] = useState<InventoryItem[] | null>(null);
  const [errors, setErrors] = useState<Array<{ row: number; message: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [format, setFormat] = useState<CsvFormat | null>(null);

  const parse = useCallback(
    (file: File, category?: 'Automotriz' | 'Tapicería') => {
      setIsLoading(true);
      setPreview(null);
      setErrors([]);
      setFormat(null);

      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        // Limpia los espacios al inicio y final en el nombre de las columnas 
        // para que "Precio de compra " haga match perfecto con "Precio de compra"
        transformHeader: (header) => header.trim(), 
        
        // Saltea cualquier fila basura por encima de las cabeceras reales.
        // Busca la primera línea que contenga "Nombre" o "Producto" y procesa a partir de ahí.
        beforeFirstChunk: (chunk) => {
          const lines = chunk.split(/\r?\n/);
          const headerIdx = lines.findIndex(line => line.includes('Nombre') || line.includes('Producto'));
          if (headerIdx > 0) {
            return lines.slice(headerIdx).join('\n');
          }
          return chunk;
        },
        complete(results) {
          const headers = results.meta.fields ?? [];
          const detectedFormat = detectFormat(headers);
          setFormat(detectedFormat);

          const { products, errors: parseErrors } = parseRows(results.data, category);
          setPreview(products);
          setErrors(parseErrors);
          setIsLoading(false);
        },
        error(err) {
          setErrors([{ row: 0, message: `Error al leer el archivo: ${err.message}` }]);
          setIsLoading(false);
        },
      });
    },
    [],
  );

  const confirm = useCallback((): InventoryItem[] => {
    const result = preview ?? [];
    setPreview(null);
    setErrors([]);
    setFormat(null);
    return result;
  }, [preview]);

  const reset = useCallback(() => {
    setPreview(null);
    setErrors([]);
    setIsLoading(false);
    setFormat(null);
  }, []);

  return { preview, errors, isLoading, format, parse, confirm, reset };
}