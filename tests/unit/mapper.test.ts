import { describe, expect, it } from 'vitest';
import { buildTables, formatDataType } from '../../src/model/mapper';
import type { RawColumn, RawIntrospection } from '../../src/model/types';
import fixture from '../fixtures/sample-rows.json';

const raw = fixture as RawIntrospection;

const baseColumn: RawColumn = {
  objectId: 1,
  columnId: 1,
  name: 'x',
  typeName: 'int',
  maxLength: 4,
  precision: 10,
  scale: 0,
  isNullable: false,
  isIdentity: false,
  isComputed: false,
};

describe('formatDataType', () => {
  it('renders nvarchar length in characters', () => {
    expect(formatDataType({ ...baseColumn, typeName: 'nvarchar', maxLength: 100 })).toBe('nvarchar(50)');
  });

  it('renders the max length sentinel', () => {
    expect(formatDataType({ ...baseColumn, typeName: 'nvarchar', maxLength: -1 })).toBe('nvarchar(max)');
  });

  it('renders decimal precision and scale', () => {
    expect(formatDataType({ ...baseColumn, typeName: 'decimal', precision: 18, scale: 2 })).toBe('decimal(18,2)');
  });

  it('passes simple types through unchanged', () => {
    expect(formatDataType({ ...baseColumn, typeName: 'int' })).toBe('int');
  });
});

describe('buildTables', () => {
  const tables = buildTables(raw);
  const customer = tables.find((t) => t.name === 'Customer')!;

  it('maps every table', () => {
    expect(tables).toHaveLength(2);
  });

  it('orders columns and flags the identity primary key', () => {
    expect(customer.columns[0].name).toBe('CustomerID');
    expect(customer.columns[0].isPrimaryKey).toBe(true);
    expect(customer.columns[0].isIdentity).toBe(true);
  });

  it('attaches the table-level description (minor_id 0)', () => {
    expect(customer.description).toBe('Customer records');
  });

  it('attaches a column description by column_id and its default', () => {
    const firstName = customer.columns.find((c) => c.name === 'FirstName')!;
    expect(firstName.description).toBe('Given name');
    expect(firstName.defaultValue).toBe("(N'')");
  });

  it('resolves the foreign key reference', () => {
    const addressId = customer.columns.find((c) => c.name === 'AddressID')!;
    expect(addressId.foreignKey?.referencedTable).toBe('Address');
    expect(addressId.foreignKey?.referencedColumn).toBe('AddressID');
  });

  it('renders nvarchar(max)', () => {
    const notes = customer.columns.find((c) => c.name === 'Notes')!;
    expect(notes.dataType).toBe('nvarchar(max)');
  });
});
