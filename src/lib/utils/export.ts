/**
 * Universal CSV Exporter for ICON TECH PRO ERP
 * Provides 1-click browser CSV download for all tables.
 */
export function exportToCSV<T extends Record<string, any>>(
  filename: string,
  rows: T[],
  columns: {
    key: keyof T | string;
    label: string;
    format?: (val: any, row: T) => string;
  }[]
) {
  if (!rows || rows.length === 0) {
    alert('No data available to export.');
    return;
  }

  const headerRow = columns.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(',');
  const dataRows = rows.map((row) => {
    return columns
      .map((c) => {
        let val = (row as any)[c.key];
        if (c.format) {
          val = c.format(val, row);
        }
        if (val === null || val === undefined) {
          val = '';
        }
        return `"${String(val).replace(/"/g, '""')}"`;
      })
      .join(',');
  });

  const csvContent = [headerRow, ...dataRows].join('\r\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
