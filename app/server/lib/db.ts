import { DB_FOLDER } from './constants';
import * as fs from 'fs-extra';
import * as path from 'path';

class DBFileManager {
	private static get date() {
		return {
			___last_updated: Date.now()
		}
	}

	public static async read(fileName: string) {
		if (!(await fs.pathExists(DB_FOLDER))) {
			// Create it
			await fs.mkdirp(DB_FOLDER);
			await fs.writeFile(path.join(DB_FOLDER, fileName), 
				JSON.stringify(this.date, null, 4), {
					encoding: 'utf8'
				});
			return this.date;
		}
		return JSON.parse(await fs.readFile(path.join(DB_FOLDER, fileName), {
			encoding: 'utf8'
		}));
	}

	public static async write(fileName: string, data: {
		[key: string]: any;
	}) {
		await fs.writeFile(path.join(DB_FOLDER, fileName), JSON.stringify({
			...data,
			...this.date
		}, null, 4), {
			encoding: 'utf8'
		});
	}
}

export class Database {
	private _data!: {
		[key: string]: any;
	};
	constructor(private _fileName: string) { }

	async init() {
		this._data = await DBFileManager.read(this._fileName);
		return this;
	}

	async setVal(key: string, val: string|number, noWrite: boolean = false) {
		const parts = key.split('.');
		let current = this._data;

		let original: any;
		for (let i = 0; i < parts.length - 1; i++) {
			const part = parts[i];
			if (typeof current !== 'object') return;
			if (!(part in current)) {
				// Value does not exist,
				// create an empty object to hold its values
				current[part] = {};
			}
			current = current[part];
		}
		if (typeof current !== 'object') return;
		if (typeof current[parts[parts.length - 1]] === 'object') {
			// Set every child of this object to that value
			const final = current[parts[parts.length - 1]];
			original = final;
			for (const child in final) {
				this.setVal(`${key}.${child}`, val, true);
			}
		} else {
			original = current[parts[parts.length - 1]];
			current[parts[parts.length - 1]] = val;
		}

		if (!noWrite) {
			await DBFileManager.write(this._fileName, this._data);
		}
		return original;
	}

	get<V>(key: string, defaultVal: V|undefined = undefined): V|undefined {
		const parts = key.split('.');
		let current = this._data;

		for (const part of parts) {
			if (typeof current !== 'object' || !(part in current)) {
				// Value does not exist
				return defaultVal;
			}
			current = current[part];
		}
		return (current as any) || defaultVal;
	}

	async data(force: boolean = false) {
		if (force) {
			return (this._data = await DBFileManager.read(this._fileName));
		}
		return this._data;
	}

	async json(force: boolean = false) {
		return JSON.stringify(await this.data(force));
	}
}