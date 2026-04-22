import { db } from '../db/init';

export interface ColumnInfo {
  name: string;
  type: string;
  notnull: number;
  pk: number;
}

export interface TableSchema {
  tableName: string;
  columns: ColumnInfo[];
  foreignKeys: any[];
}

export function getFullSchema(): TableSchema[] {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[];
  
  return tables.map(table => {
    const columns = db.prepare(`PRAGMA table_info(${table.name})`).all() as ColumnInfo[];
    const foreignKeys = db.prepare(`PRAGMA foreign_key_list(${table.name})`).all();
    return {
      tableName: table.name,
      columns,
      foreignKeys
    };
  });
}

export function schemaToPrompt(schemas: TableSchema[]): string {
  return schemas.map(s => {
    const cols = s.columns.map(c => `${c.name} (${c.type}${c.pk ? ', PRIMARY KEY' : ''})`).join(', ');
    return `Table: ${s.tableName}\nColumns: ${cols}`;
  }).join('\n\n');
}
