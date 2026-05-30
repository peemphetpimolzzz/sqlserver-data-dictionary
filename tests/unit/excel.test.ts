import { describe, expect, it } from 'vitest';
import { buildWorkbook } from '../../src/output/excel';
import type { DatabaseModel } from '../../src/model/types';

const model: DatabaseModel = {
  name: 'TestDb',
  generatedAt: '2026-01-01T00:00:00.000Z',
  tables: [
    {
      schema: 'dbo',
      name: 'Widget',
      description: 'Widgets',
      columns: [
        {
          ordinal: 1,
          name: 'Id',
          dataType: 'int',
          nullable: false,
          isPrimaryKey: true,
          isIdentity: true,
          isComputed: false,
        },
        {
          ordinal: 2,
          name: 'Name',
          dataType: 'nvarchar(50)',
          nullable: false,
          isPrimaryKey: false,
          isIdentity: false,
          isComputed: false,
          description: 'Display name',
        },
      ],
    },
  ],
};

describe('buildWorkbook', () => {
  const workbook = buildWorkbook(model);

  it('creates an overview sheet plus one sheet per table', () => {
    const names = workbook.worksheets.map((w) => w.name);
    expect(names).toContain('Overview');
    expect(names).toContain('dbo.Widget');
    expect(workbook.worksheets).toHaveLength(2);
  });

  it('lists the table on the overview sheet', () => {
    const overview = workbook.getWorksheet('Overview')!;
    const tableColumn = overview.getColumn(2).values.map((value) => String(value));
    expect(tableColumn).toContain('Widget');
  });

  it('writes the first column row on the table sheet', () => {
    const sheet = workbook.getWorksheet('dbo.Widget')!;
    // The table has a description, so the header is row 4 and data starts at row 5.
    expect(sheet.getRow(5).getCell(2).value).toBe('Id');
  });
});
