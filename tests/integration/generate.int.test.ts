import sql from 'mssql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config';
import { createPool } from '../../src/db/connection';
import { introspect } from '../../src/db/introspect';
import { buildModel } from '../../src/model/mapper';
import { buildWorkbook } from '../../src/output/excel';

describe('end-to-end generation against SQL Server', () => {
  let pool: sql.ConnectionPool;

  beforeAll(async () => {
    const config = loadConfig(['node', 'data-dictionary']);
    pool = await createPool(config);
  }, 120_000);

  afterAll(async () => {
    await pool?.close();
  });

  it('reads the sample schema and renders a workbook', async () => {
    const raw = await introspect(pool);
    const model = buildModel(raw, 'AdventureWorksLT', '2026-01-01T00:00:00.000Z');

    expect(model.tables.length).toBeGreaterThan(5);

    const customer = model.tables.find((t) => t.name === 'Customer');
    expect(customer).toBeDefined();
    expect(customer!.columns.some((c) => c.isPrimaryKey)).toBe(true);
    expect(customer!.columns.some((c) => (c.description?.length ?? 0) > 0)).toBe(true);

    const workbook = buildWorkbook(model);
    expect(workbook.getWorksheet('Overview')).toBeDefined();
    expect(workbook.worksheets.length).toBeGreaterThan(5);
  });
});
