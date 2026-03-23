'use client';

import { useState, useCallback } from 'react';
import { createSheetItem, updateSheetItem, deleteSheetItem, createLog } from '@/lib/sheets-api-client';
import { useToast } from '@/hooks/useToast';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import type { InventoryItem } from '@/lib/types';

export function useSheetsSync(
  sheetId: string,
  setItems: React.Dispatch<React.SetStateAction<InventoryItem[]>>,
) {
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { userName } = useCurrentUser();

  const save = useCallback(
    async (item: InventoryItem, isNew: boolean, allItems: InventoryItem[]): Promise<boolean> => {
      setIsSaving(true);
      try {
        if (isNew) {
          const sibling = allItems.find((i) => i.category === item.category && i._sheetMeta);
          if (!sibling?._sheetMeta) {
            toast(
              `No se encontró un producto con categoría "${item.category}" para determinar la hoja. Elige una categoría existente.`,
              'error',
            );
            return false;
          }
          const { sheetName, format } = sibling._sheetMeta;
          const { rowIndex } = await createSheetItem(sheetId, sheetName, item, format);
          setItems((prev) => [...prev, { ...item, _sheetMeta: { sheetName, rowIndex, format } }]);
          void createLog(sheetId, { timestamp: new Date().toISOString(), userName: userName ?? 'Desconocido', action: 'Creó', itemName: item.name, sheetName });
        } else {
          const meta = item._sheetMeta;
          if (!meta) {
            toast('Este producto no tiene datos de hoja. No se puede actualizar.', 'error');
            return false;
          }
          await updateSheetItem(sheetId, meta.sheetName, meta.rowIndex, item, meta.format);
          setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
          void createLog(sheetId, { timestamp: new Date().toISOString(), userName: userName ?? 'Desconocido', action: 'Editó', itemName: item.name, sheetName: meta.sheetName });
        }
        return true;
      } catch (err) {
        toast((err as Error).message, 'error');
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [sheetId, setItems, toast, userName],
  );

  const remove = useCallback(
    async (item: InventoryItem): Promise<void> => {
      if (!item._sheetMeta) return;
      const { sheetName, rowIndex } = item._sheetMeta;
      setIsSaving(true);
      try {
        await deleteSheetItem(sheetId, sheetName, rowIndex);
        // Fix row drift: after deleting row N, all rows > N in the same sheet shift down by 1
        setItems((prev) =>
          prev
            .filter((i) => i.id !== item.id)
            .map((i) =>
              i._sheetMeta?.sheetName === sheetName && i._sheetMeta.rowIndex > rowIndex
                ? { ...i, _sheetMeta: { ...i._sheetMeta, rowIndex: i._sheetMeta.rowIndex - 1 } }
                : i,
            ),
        );
        void createLog(sheetId, { timestamp: new Date().toISOString(), userName: userName ?? 'Desconocido', action: 'Eliminó', itemName: item.name, sheetName });
      } catch (err) {
        toast((err as Error).message, 'error');
      } finally {
        setIsSaving(false);
      }
    },
    [sheetId, setItems, toast, userName],
  );

  return { save, remove, isSaving };
}
