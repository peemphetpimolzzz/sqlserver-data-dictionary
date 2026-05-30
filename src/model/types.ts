export interface ForeignKeyRef {
  referencedSchema: string;
  referencedTable: string;
  referencedColumn: string;
  constraintName: string;
}

export interface ColumnModel {
  ordinal: number;
  name: string;
  dataType: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isIdentity: boolean;
  isComputed: boolean;
  defaultValue?: string;
  foreignKey?: ForeignKeyRef;
  description?: string;
}

export interface TableModel {
  schema: string;
  name: string;
  description?: string;
  columns: ColumnModel[];
}

export interface DatabaseModel {
  name: string;
  generatedAt: string;
  tables: TableModel[];
}

// ---- Raw rows returned by the introspection queries ----

export interface RawTable {
  schema: string;
  name: string;
  objectId: number;
}

export interface RawColumn {
  objectId: number;
  columnId: number;
  name: string;
  typeName: string;
  maxLength: number;
  precision: number;
  scale: number;
  isNullable: boolean;
  isIdentity: boolean;
  isComputed: boolean;
}

export interface RawDefault {
  objectId: number;
  columnId: number;
  definition: string;
}

export interface RawPrimaryKey {
  objectId: number;
  columnId: number;
}

export interface RawForeignKey {
  objectId: number;
  columnId: number;
  refSchema: string;
  refTable: string;
  refColumn: string;
  constraintName: string;
}

export interface RawExtendedProperty {
  majorId: number;
  minorId: number;
  value: string;
}

export interface RawIntrospection {
  tables: RawTable[];
  columns: RawColumn[];
  defaults: RawDefault[];
  primaryKeys: RawPrimaryKey[];
  foreignKeys: RawForeignKey[];
  extendedProperties: RawExtendedProperty[];
}
