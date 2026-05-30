import ExcelJS from 'exceljs';
import { DatabaseModel, TableModel } from '../model/types';

const HEADER_BG = 'FF1F2937';
const PK_BG = 'FFFEF3C7';

export async function writeWorkbook(model: DatabaseModel, outputPath: string): Promise<void> {
  await buildWorkbook(model).xlsx.writeFile(outputPath);
}

export function buildWorkbook(model: DatabaseModel): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Data Dictionary Generator';
  workbook.created = new Date(model.generatedAt);

  buildOverview(workbook, model);

  const usedNames = new Set<string>();
  for (const table of model.tables) {
    buildTableSheet(workbook, table, uniqueSheetName(`${table.schema}.${table.name}`, usedNames));
  }
  return workbook;
}

function buildOverview(workbook: ExcelJS.Workbook, model: DatabaseModel): void {
  const sheet = workbook.addWorksheet('Overview');
  sheet.columns = [
    { width: 18 },
    { width: 32 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 60 },
  ];

  sheet.mergeCells('A1:F1');
  const title = sheet.getCell('A1');
  title.value = `Data Dictionary — ${model.name}`;
  title.font = { bold: true, size: 16 };

  sheet.getCell('A2').value = `Generated: ${model.generatedAt}`;
  const totalColumns = model.tables.reduce((sum, table) => sum + table.columns.length, 0);
  sheet.getCell('A3').value = `${model.tables.length} tables · ${totalColumns} columns`;

  const header = sheet.getRow(5);
  header.values = ['Schema', 'Table', 'Columns', 'PK cols', 'FK count', 'Description'];
  styleHeader(header);

  model.tables.forEach((table, index) => {
    sheet.getRow(6 + index).values = [
      table.schema,
      table.name,
      table.columns.length,
      table.columns.filter((c) => c.isPrimaryKey).length,
      table.columns.filter((c) => c.foreignKey).length,
      table.description ?? '',
    ];
  });

  sheet.views = [{ state: 'frozen', ySplit: 5 }];
}

function buildTableSheet(workbook: ExcelJS.Workbook, table: TableModel, sheetName: string): void {
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = [
    { width: 6 },
    { width: 28 },
    { width: 20 },
    { width: 10 },
    { width: 6 },
    { width: 30 },
    { width: 10 },
    { width: 10 },
    { width: 22 },
    { width: 50 },
  ];

  sheet.mergeCells('A1:J1');
  const title = sheet.getCell('A1');
  title.value = `${table.schema}.${table.name}`;
  title.font = { bold: true, size: 14 };

  if (table.description) {
    sheet.mergeCells('A2:J2');
    const description = sheet.getCell('A2');
    description.value = table.description;
    description.font = { italic: true, color: { argb: 'FF6B7280' } };
  }

  const headerRowIndex = table.description ? 4 : 3;
  const header = sheet.getRow(headerRowIndex);
  header.values = [
    '#',
    'Column',
    'Data Type',
    'Nullable',
    'PK',
    'Foreign Key',
    'Identity',
    'Computed',
    'Default',
    'Description',
  ];
  styleHeader(header);

  table.columns.forEach((column, index) => {
    const row = sheet.getRow(headerRowIndex + 1 + index);
    row.values = [
      column.ordinal,
      column.name,
      column.dataType,
      column.nullable ? 'Yes' : '',
      column.isPrimaryKey ? 'PK' : '',
      column.foreignKey
        ? `→ ${column.foreignKey.referencedSchema}.${column.foreignKey.referencedTable}.${column.foreignKey.referencedColumn}`
        : '',
      column.isIdentity ? 'Yes' : '',
      column.isComputed ? 'Yes' : '',
      column.defaultValue ?? '',
      column.description ?? '',
    ];
    if (column.isPrimaryKey) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PK_BG } };
      });
    }
  });

  sheet.views = [{ state: 'frozen', ySplit: headerRowIndex }];
}

function styleHeader(row: ExcelJS.Row): void {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
    cell.alignment = { vertical: 'middle' };
  });
}

function uniqueSheetName(raw: string, used: Set<string>): string {
  const base = raw.replace(/[:\\/?*[\]]/g, '_').slice(0, 31);
  let name = base;
  let suffix = 1;
  while (used.has(name.toLowerCase())) {
    const tail = `_${suffix++}`;
    name = base.slice(0, 31 - tail.length) + tail;
  }
  used.add(name.toLowerCase());
  return name;
}
