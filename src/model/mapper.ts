import {
  ColumnModel,
  DatabaseModel,
  RawColumn,
  RawIntrospection,
  TableModel,
} from './types';

/**
 * Builds a human-readable type string from a column's raw metadata, e.g.
 * `nvarchar(50)`, `nvarchar(max)`, `decimal(18,2)`, `datetime2(7)`.
 */
export function formatDataType(column: RawColumn): string {
  const type = column.typeName.toLowerCase();
  const sized = ['varchar', 'char', 'nvarchar', 'nchar', 'binary', 'varbinary'];

  if (sized.includes(type)) {
    if (column.maxLength === -1) {
      return `${column.typeName}(max)`;
    }
    // nchar/nvarchar store length in bytes (2 per character).
    const length = type === 'nvarchar' || type === 'nchar' ? column.maxLength / 2 : column.maxLength;
    return `${column.typeName}(${length})`;
  }

  if (type === 'decimal' || type === 'numeric') {
    return `${column.typeName}(${column.precision},${column.scale})`;
  }

  if (type === 'datetime2' || type === 'time' || type === 'datetimeoffset') {
    return `${column.typeName}(${column.scale})`;
  }

  return column.typeName;
}

/**
 * Pure transform from raw query rows into the table/column model. Free of any
 * database dependency so it can be unit-tested from fixtures.
 */
export function buildTables(raw: RawIntrospection): TableModel[] {
  const primaryKeys = new Set(raw.primaryKeys.map((pk) => key(pk.objectId, pk.columnId)));
  const defaults = new Map(raw.defaults.map((d) => [key(d.objectId, d.columnId), d.definition]));
  const foreignKeys = new Map(raw.foreignKeys.map((fk) => [key(fk.objectId, fk.columnId), fk]));

  const tableDescriptions = new Map<number, string>();
  const columnDescriptions = new Map<string, string>();
  for (const property of raw.extendedProperties) {
    if (property.minorId === 0) {
      tableDescriptions.set(property.majorId, property.value);
    } else {
      columnDescriptions.set(key(property.majorId, property.minorId), property.value);
    }
  }

  const columnsByTable = new Map<number, RawColumn[]>();
  for (const column of raw.columns) {
    const list = columnsByTable.get(column.objectId) ?? [];
    list.push(column);
    columnsByTable.set(column.objectId, list);
  }

  return raw.tables.map((table) => {
    const columns = (columnsByTable.get(table.objectId) ?? [])
      .slice()
      .sort((a, b) => a.columnId - b.columnId)
      .map<ColumnModel>((column) => {
        const fk = foreignKeys.get(key(column.objectId, column.columnId));
        return {
          ordinal: column.columnId,
          name: column.name,
          dataType: formatDataType(column),
          nullable: column.isNullable,
          isPrimaryKey: primaryKeys.has(key(column.objectId, column.columnId)),
          isIdentity: column.isIdentity,
          isComputed: column.isComputed,
          defaultValue: defaults.get(key(column.objectId, column.columnId)),
          foreignKey: fk
            ? {
                referencedSchema: fk.refSchema,
                referencedTable: fk.refTable,
                referencedColumn: fk.refColumn,
                constraintName: fk.constraintName,
              }
            : undefined,
          description: columnDescriptions.get(key(column.objectId, column.columnId)),
        };
      });

    return {
      schema: table.schema,
      name: table.name,
      description: tableDescriptions.get(table.objectId),
      columns,
    };
  });
}

export function buildModel(raw: RawIntrospection, name: string, generatedAt: string): DatabaseModel {
  return { name, generatedAt, tables: buildTables(raw) };
}

function key(objectId: number, columnId: number): string {
  return `${objectId}:${columnId}`;
}
