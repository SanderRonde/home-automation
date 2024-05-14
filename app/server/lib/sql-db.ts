// import { DB_FOLDER } from './constants';
import { Database } from 'sqlite3';
import * as path from 'path';

type ColumnBase =
	| {
			type: 'TEXT';
			primaryKey?: true;
			enum?: string[];
			json?: unknown;
	  }
	| {
			type: 'boolean' | 'INTEGER';
			primaryKey?: true;
			enum?: string[];
	  };

type Column =
	| (ColumnBase & {
			nullable: true;
			default?: string;
	  })
	| (ColumnBase & {
			nullable: false;
			default?: string;
	  });

interface Table {
	[columnName: string]: Column;
}

export interface Schema {
	[tableName: string]: Table;
}

export type SQLDatabaseWithSchema<S extends Schema> = {
	[T in keyof S]: SQLTableWithSchema<S[T]>;
};

export class SQLDatabase {
	public static DEBUG = false;

	private readonly _db: Database;

	public constructor(fileName: string) {
		this._db = new Database(
			path.join(__dirname, '../../../database', fileName)
		);
	}

	public async applySchema<S extends Schema>(
		schema: S
	): Promise<SQLDatabaseWithSchema<S>> {
		await new DBMigrator(this._db).applySchema(schema);
		const tableMap: Partial<SQLDatabaseWithSchema<S>> = {};
		for (const tableName in schema) {
			tableMap[tableName] = new SQLTableWithSchema(
				this._db,
				tableName,
				schema[tableName]
			);
		}
		return tableMap as SQLDatabaseWithSchema<S>;
	}
}

abstract class WithQueryAndRun {
	protected abstract _db: Database;

	protected async _query<T>(
		query: string,
		...params: unknown[]
	): Promise<T[]> {
		return new Promise((resolve, reject) => {
			if (SQLDatabase.DEBUG) {
				console.log('Query:', query, params);
			}
			this._db.all<T>(query, params, (err, rows) => {
				if (err) {
					console.log('DB error:', err);
					reject(err);
				} else {
					resolve(rows);
				}
			});
		});
	}

	protected async _run(query: string, ...params: unknown[]): Promise<void> {
		return new Promise((resolve, reject) => {
			if (SQLDatabase.DEBUG) {
				console.log('Run:', query, params);
			}
			this._db.run(query, params, (err) => {
				if (err) {
					console.log('DB error:', err);
					reject(err);
				} else {
					resolve();
				}
			});
		});
	}
}

type TableToRow<T extends Table> = {
	[ColumnName in keyof T]: T[ColumnName] extends { type: 'boolean' }
		? boolean
		: T[ColumnName] extends { type: 'INTEGER' }
			? number
			: T[ColumnName] extends { type: 'TEXT' }
				? T[ColumnName] extends { enum: (infer E)[] }
					? E
					: T[ColumnName] extends { json: infer J }
						? J
						: string
				: never;
};

class SQLTableWithSchema<T extends Table> extends WithQueryAndRun {
	public constructor(
		protected readonly _db: Database,
		private readonly _tableName: string,
		private readonly _schema: T
	) {
		super();
	}

	private _toSql(
		columnName: string,
		data: unknown
	): string | number | boolean {
		const column = this._schema[columnName];
		if (column.type === 'TEXT') {
			if (column.enum) {
				if (!column.enum.includes(data as string)) {
					throw new Error(
						`Invalid enum value for column ${columnName}`
					);
				}
			}
			if ('json' in column) {
				return JSON.stringify(data);
			}
			return data as string;
		} else if (column.type === 'INTEGER') {
			return data as number;
		} else if (column.type === 'boolean') {
			return data as boolean;
		} else {
			throw new Error(`Invalid column type for column ${columnName}`);
		}
	}

	private _fromSql(
		columnName: string,
		data: string | number | boolean
	): unknown {
		const column = this._schema[columnName];
		if (column.type === 'TEXT') {
			if (column.enum) {
				if (!column.enum.includes(data as string)) {
					throw new Error(
						`Invalid enum value for column ${columnName}`
					);
				}
			}
			if ('json' in column) {
				return JSON.parse(data as string);
			}
			return data as string;
		} else if (column.type === 'INTEGER') {
			return data as number;
		} else if (column.type === 'boolean') {
			return data as boolean;
		} else {
			throw new Error(`Invalid column type for column ${columnName}`);
		}
	}

	public async insert<R extends TableToRow<T>>(row: R): Promise<void> {
		const columns = Object.keys(row);
		const values = columns.map((column) =>
			this._toSql(column, row[column])
		);
		const query = `INSERT INTO ${this._tableName} (${columns.join(
			', '
		)}) VALUES (${values.map(() => '?').join(', ')})`;
		await this._run(query, ...values);
	}

	public async update(
		query: {
			[K in keyof T]?: TableToRow<T>[K];
		},
		values: {
			[K in keyof T]?: TableToRow<T>[K];
		}
	): Promise<void> {
		const columns = Object.keys(values);
		const valueStrings = columns.map((column) => `${column} = ?`);
		const queryStr = `UPDATE ${this._tableName} SET ${valueStrings.join(
			', '
		)} WHERE ${Object.keys(query)
			.map((column) => `${column} = ?`)
			.join(' AND ')}`;
		await this._run(
			queryStr,
			...columns.map((column) => this._toSql(column, values[column])),
			...Object.entries(query).map(([column, value]) =>
				this._toSql(column, value)
			)
		);
	}

	public async set(
		query: {
			[K in keyof T]?: TableToRow<T>[K];
		},
		values: {
			[K in keyof T]?: TableToRow<T>[K];
		}
	): Promise<void> {
		// Check if there is a match
		const existing = await this.querySingle(query);
		if (existing) {
			await this.update(query, values);
		} else {
			await this.insert({ ...query, ...values } as TableToRow<T>);
		}
	}

	public async query<
		Q extends {
			[K in keyof T]?:
				| TableToRow<T>[K]
				| {
						$gt?: TableToRow<T>[K];
				  };
		},
	>(q: Q): Promise<TableToRow<T>[]> {
		const whereClauses = [];
		const values: (string | number | boolean)[] = [];
		for (const column in q) {
			const value = q[column];
			if (typeof value === 'object' && value && '$gt' in value) {
				whereClauses.push(`${column} > ?`);
				values.push(this._toSql(column, value.$gt));
			} else {
				whereClauses.push(`${column} = ?`);
				values.push(this._toSql(column, value));
			}
		}

		const query = `SELECT * FROM ${this._tableName} WHERE ${whereClauses.join(' AND ')}`;
		const sqlData = await this._query<
			Record<keyof T, string | number | boolean>
		>(query, ...values);
		return sqlData.map((row) => {
			const data: Partial<TableToRow<T>> = {};
			for (const column in row) {
				data[column] = this._fromSql(
					column,
					row[column]
				) as TableToRow<T>[keyof T];
			}
			return data as TableToRow<T>;
		});
	}

	public async querySingle<
		Q extends {
			[K in keyof T]?: TableToRow<T>[K];
		},
	>(q: Q, pick: 'first' | 'last' = 'first'): Promise<TableToRow<T> | null> {
		const result = await this.query<Q>(q);
		if (pick === 'first') {
			return result[0] ?? null;
		} else {
			return result[result.length - 1] ?? null;
		}
	}
}

class DBMigrator extends WithQueryAndRun {
	public constructor(protected readonly _db: Database) {
		super();
	}

	private async _createNewtable(schema: Schema, tableName: string) {
		const columns = schema[tableName];
		const columnStrings = Object.entries(columns).map(
			([columnName, column]) => {
				const parts = [columnName, column.type];
				if (!column.nullable) {
					parts.push('NOT NULL');
				}
				if (column.primaryKey) {
					parts.push('PRIMARY KEY');
				}
				if (column.default) {
					parts.push(`DEFAULT ${column.default}`);
				}
				return parts.join(' ');
			}
		);
		const query = `CREATE TABLE IF NOT EXISTS ${tableName} (${columnStrings.join(
			', '
		)})`;
		await this._run(query);
	}

	private async _syncSchemas(schema: Schema, tableName: string) {
		const columns = schema[tableName];
		const currentColumns = await this._query<{
			name: string;
			type: 'TEXT' | 'boolean';
			notnull: 0 | 1;
			pk: 0 | 1;
			dflt_value: string | null;
		}>(`PRAGMA table_info(${tableName})`);
		const currentColumnNames = currentColumns.map((column) => column.name);
		const newColumns = Object.entries(columns).filter(
			([columnName]) => !currentColumnNames.includes(columnName)
		);
		for (const [columnName, column] of newColumns) {
			await this._run(
				`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${
					column.type
				} ${column.nullable ? 'NULL' : 'NOT NULL'} ${
					column.default ? `DEFAULT ${column.default}` : ''
				}`
			);
		}

		const removedColumns = currentColumnNames.filter(
			(column) => !Object.keys(columns).includes(column)
		);
		for (const column of removedColumns) {
			await this._run(`ALTER TABLE ${tableName} DROP COLUMN ${column}`);
		}

		for (const columnName in columns) {
			const column = columns[columnName];
			const currentColumn = currentColumns.find(
				(currentColumn) => currentColumn.name === columnName
			);
			if (!currentColumn) {
				continue;
			}
			if (currentColumn.type !== column.type) {
				throw new Error(
					`Column type mismatch for column ${columnName} in table ${tableName}`
				);
			}
			if (currentColumn.notnull !== (column.nullable ? 0 : 1)) {
				throw new Error(
					`Column nullability mismatch for column ${columnName} in table ${tableName}`
				);
			}
			if (currentColumn.dflt_value !== (column.default ?? null)) {
				throw new Error(
					`Column default mismatch for column ${columnName} in table ${tableName}`
				);
			}
		}
	}

	public async applySchema<S extends Schema>(schema: S) {
		const tableNames = Object.keys(schema);
		for (const tableName of tableNames) {
			const hasTable =
				(
					await this._query<{ name: string }>(
						"SELECT name FROM sqlite_master WHERE type='table' AND name=?",
						tableName
					)
				).length > 0;

			if (!hasTable) {
				await this._createNewtable(schema, tableName);
			} else {
				await this._syncSchemas(schema, tableName);
			}
		}
	}
}
