import sql from 'mssql';
import { RawIntrospection } from '../model/types';

const QUERIES = {
  tables: `
    SELECT s.name AS [schema], t.name AS [name], t.object_id AS objectId
    FROM sys.tables t
    JOIN sys.schemas s ON s.schema_id = t.schema_id
    ORDER BY s.name, t.name;`,

  columns: `
    SELECT c.object_id AS objectId, c.column_id AS columnId, c.name AS [name],
           ty.name AS typeName, c.max_length AS maxLength, c.precision AS [precision],
           c.scale AS scale, c.is_nullable AS isNullable, c.is_identity AS isIdentity,
           c.is_computed AS isComputed
    FROM sys.columns c
    JOIN sys.types ty ON ty.user_type_id = c.user_type_id
    JOIN sys.tables t ON t.object_id = c.object_id
    ORDER BY c.object_id, c.column_id;`,

  defaults: `
    SELECT dc.parent_object_id AS objectId, dc.parent_column_id AS columnId,
           dc.definition AS [definition]
    FROM sys.default_constraints dc;`,

  primaryKeys: `
    SELECT kc.parent_object_id AS objectId, ic.column_id AS columnId
    FROM sys.key_constraints kc
    JOIN sys.index_columns ic
      ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
    WHERE kc.type = 'PK';`,

  foreignKeys: `
    SELECT fk.parent_object_id AS objectId, fkc.parent_column_id AS columnId,
           rs.name AS refSchema, rt.name AS refTable, rc.name AS refColumn,
           fk.name AS constraintName
    FROM sys.foreign_keys fk
    JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
    JOIN sys.tables rt ON rt.object_id = fk.referenced_object_id
    JOIN sys.schemas rs ON rs.schema_id = rt.schema_id
    JOIN sys.columns rc
      ON rc.object_id = fkc.referenced_object_id AND rc.column_id = fkc.referenced_column_id;`,

  // class = 1 restricts to table/column properties; minor_id = 0 marks a table-level
  // description, minor_id > 0 maps to the column with that column_id.
  extendedProperties: `
    SELECT ep.major_id AS majorId, ep.minor_id AS minorId,
           CAST(ep.value AS nvarchar(max)) AS [value]
    FROM sys.extended_properties ep
    WHERE ep.name = 'MS_Description' AND ep.class = 1;`,
};

export async function introspect(pool: sql.ConnectionPool): Promise<RawIntrospection> {
  const [tables, columns, defaults, primaryKeys, foreignKeys, extendedProperties] = await Promise.all([
    pool.request().query(QUERIES.tables),
    pool.request().query(QUERIES.columns),
    pool.request().query(QUERIES.defaults),
    pool.request().query(QUERIES.primaryKeys),
    pool.request().query(QUERIES.foreignKeys),
    pool.request().query(QUERIES.extendedProperties),
  ]);

  return {
    tables: tables.recordset,
    columns: columns.recordset,
    defaults: defaults.recordset,
    primaryKeys: primaryKeys.recordset,
    foreignKeys: foreignKeys.recordset,
    extendedProperties: extendedProperties.recordset,
  };
}
