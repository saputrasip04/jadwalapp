// src/lib/export-xlsx.ts
import * as XLSX from 'xlsx';

export function exportTableToXLSX(data: unknown[][], fileName: string, sheetName = 'Jadwal') {
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

export function exportMultiSheetXLSX(sheets: Record<string, unknown[][]>, fileName: string) {
  const wb = XLSX.utils.book_new();
  for (const [name, data] of Object.entries(sheets)) {
    // Batasi nama sheet maks 31 karakter (aturan Excel)
    const safeName = name.substring(0, 31).replace(/[\\/?*[\]]/g, '_');
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, safeName);
  }
}

export function exportHtmlTableToXLSX(table: HTMLElement, fileName: string) {
  const wb = XLSX.utils.table_to_book(table);
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}
