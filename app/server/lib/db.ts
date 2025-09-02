import { DB_FOLDER } from './constants';
import * as fs from 'fs-extra';
import { Data } from './data';
import * as path from 'path';

class DBFileManager {
	private static get date() {
		return {
			___last_updated: Date.now(),
		};
	}

	public static readSync<
		R extends {
			___last_updated: number;
		},
	>(fileName: string): R {
		const filePath = path.join(DB_FOLDER, fileName);
		if (!fs.pathExistsSync(filePath)) {
			// Create it
			fs.mkdirpSync(DB_FOLDER);
			fs.writeFileSync(filePath, JSON.stringify(this.date, null, 4), {
				encoding: 'utf8',
			});
			return this.date as R;
		}
		try {
			const parsed = JSON.parse(
				fs.readFileSync(filePath, {
					encoding: 'utf8',
				}) || '{}'
			);
			return parsed as R;
		} catch (e) {
			throw new Error(`Failed to parse JSON in file "${filePath}"`);
		}
	}

	public static write(
		fileName: string,
		data: {
			[key: string]: unknown;
		}
	) {
		// Synchronously write file to prevent issues with
		// closing during writing
		fs.writeFileSync(
			path.join(DB_FOLDER, fileName),
			JSON.stringify(
				{
					...data,
					...this.date,
				},
				null,
				4
			),
			{
				encoding: 'utf8',
			}
		);
	}
}

export class Database<T> extends Data<Partial<T>> {
	public constructor(private readonly _fileName: string) {
		super(DBFileManager.readSync(_fileName) as unknown as Partial<T>);
	}

	public override set(value: T): void {
		super.set(value);
		void DBFileManager.write(this._fileName, value as any);
	}
}
