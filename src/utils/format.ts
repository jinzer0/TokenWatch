export function formatInteger(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatUsd(value: number | null): string {
  if (value === null) {
    return 'unknown';
  }
  return `$${value.toFixed(6)}`;
}

export function formatTable(rows: string[][]): string {
  if (rows.length === 0) {
    return '';
  }
  const widths = rows[0].map((_, column) =>
    Math.max(...rows.map((row) => String(row[column] ?? '').length))
  );
  return rows
    .map((row, index) => {
      const line = row.map((cell, column) => cell.padEnd(widths[column] ?? 0)).join('  ');
      if (index === 0) {
        const divider = widths.map((width) => '-'.repeat(width)).join('  ');
        return `${line}\n${divider}`;
      }
      return line;
    })
    .join('\n');
}
