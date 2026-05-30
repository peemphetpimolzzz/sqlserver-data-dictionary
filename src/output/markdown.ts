import { DatabaseModel } from '../model/types';

export function renderMarkdown(model: DatabaseModel): string {
  const lines: string[] = [
    `# Data Dictionary — ${model.name}`,
    '',
    `_Generated: ${model.generatedAt}_`,
    '',
  ];

  for (const table of model.tables) {
    lines.push(`## ${table.schema}.${table.name}`, '');
    if (table.description) {
      lines.push(`> ${table.description}`, '');
    }
    lines.push('| # | Column | Type | Nullable | PK | FK | Default | Description |');
    lines.push('|---|--------|------|----------|----|----|---------|-------------|');
    for (const column of table.columns) {
      const fk = column.foreignKey
        ? `${column.foreignKey.referencedSchema}.${column.foreignKey.referencedTable}.${column.foreignKey.referencedColumn}`
        : '';
      lines.push(
        `| ${column.ordinal} | ${column.name} | ${column.dataType} | ${column.nullable ? 'Yes' : ''} | ` +
          `${column.isPrimaryKey ? 'PK' : ''} | ${fk} | ${escapePipe(column.defaultValue ?? '')} | ` +
          `${escapePipe(column.description ?? '')} |`,
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}

function escapePipe(value: string): string {
  return value.replace(/\|/g, '\\|');
}
