import { canExportCSV } from '@/lib/permissions/registry';

/**
 * Universal Secure CSV Exporter for ICON TECH PRO ERP
 * Provides 1-click browser CSV download for all tables.
 * Hardened with RFC 4180 compliance, formula injection prevention, and optional RBAC enforcement.
 */
export function exportToCSV<T extends Record<string, any>>(
  filename: string,
  rows: T[],
  columns: {
    key: keyof T | string;
    label: string;
    format?: (val: any, row: T) => string;
  }[],
  userRole?: string | null
) {
  if (userRole !== undefined && userRole !== null && !canExportCSV(userRole)) {
    alert('Access Denied: Exporting CSV records requires Managing Director, Admin / BDM, or Accounts privileges.');
    return;
  }

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
        let strVal = String(val);

        // Security Hardening: Prevent CSV Formula Injection (=, +, -, @, \t, \r)
        if (/^[=+\-@\t\r]/.test(strVal)) {
          strVal = `'${strVal}`;
        }

        return `"${strVal.replace(/"/g, '""')}"`;
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
