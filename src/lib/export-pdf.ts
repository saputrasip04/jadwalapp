// src/lib/export-pdf.ts
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function exportSchedulePDF(
  title: string,
  subtitle: string,
  headers: string[],
  rows: (string | number)[][],
  fileName: string,
  orientation: 'portrait' | 'landscape' = 'landscape'
) {
  const doc = new jsPDF({ orientation, unit: 'pt', format: 'a4' });

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 40, 40);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(subtitle, 40, 58);

  autoTable(doc, {
    startY: 70,
    head: [headers],
    body: rows,
    theme: 'grid',
    headStyles: {
      fillColor: [1, 113, 196],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
    },
    styles: {
      fontSize: 8,
      cellPadding: 4,
      valign: 'middle',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  doc.save(`${fileName}.pdf`);
}
