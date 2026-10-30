import { describe, expect, it } from 'vitest';
import { renderHtml } from '../../src/output/html';
import type { DatabaseModel } from '../../src/model/types';

const model: DatabaseModel = {
  name: 'AdventureWorksLT',
  generatedAt: '2026-01-01T00:00:00.000Z',
  tables: [
    {
      schema: 'SalesLT',
      name: 'SalesOrderHeader',
      description: 'General sales order information.',
      columns: [
        {
          ordinal: 1,
          name: 'SalesOrderID',
          dataType: 'int',
          nullable: false,
          isPrimaryKey: true,
          isIdentity: true,
          isComputed: false,
          description: 'Primary key.',
        },
      ],
    },
  ],
};

describe('renderHtml', () => {
  it('renders interactive SchemaLens HTML explorer with schema pills and column badges', () => {
    const html = renderHtml(model);
    expect(html).toContain('SchemaLens');
    expect(html).toContain('SalesLT.SalesOrderHeader');
    expect(html).toContain('SalesOrderID');
    expect(html).toContain('General sales order information.');
  });
});
