import { DB_FOLDER } from './constants';
import { warning } from './logger';
import * as fs from 'fs-extra';
import * as path from 'path';

class DBFileManager {
	private static get date() {
		return {
			___last_updated: Date.now(),
		};
	}

	public static async read<
		R extends {
			___last_updated: number;
		},
	>(fileName: string): Promise<R> {
		const filePath = path.join(DB_FOLDER, fileName);
		if (!(await fs.pathExists(filePath))) {
			// Create it
			await fs.mkdirp(DB_FOLDER);
			await fs.writeFile(filePath, JSON.stringify(this.date, null, 4), {
				encoding: 'utf8',
			});
			return this.date as R;
		}
		try {
			const parsed = JSON.parse(
				(await fs.readFile(filePath, {
					encoding: 'utf8',
				})) || '{}'
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

export class Database {
	private _data!: {
		[key: string]: unknown;
	};
	private _initialized = false;
	public constructor(private readonly _fileName: string) {}

	private _assertInitialized() {
		if (!this._initialized) {
			console.warn(`DB ${this._fileName} not initialized`);
			throw new Error('Not initialized');
		}
	}

	private _getLastTarget(key: string) {
		this._assertInitialized();

		const parts = key.split('.');
		let current = this._data;

		for (let i = 0; i < parts.length - 1; i++) {
			const part = parts[i];
			if (typeof current !== 'object') {
				return;
			}
			if (!(part in current)) {
				// Value does not exist,
				// create an empty object to hold its values
				current[part] = {};
			}
			current = current[part] as Record<string, unknown>;
		}
		if (typeof current !== 'object') {
			return;
		}
		const lastKey = parts[parts.length - 1];
		const currentTarget = current[lastKey];

		return {
			currentContainer: current,
			lastKey,
			currentTarget,
		};
	}
	public async init(): Promise<this> {
		this._data = await DBFileManager.read(this._fileName);
		this._initialized = true;
		return this;
	}

	public setVal(key: string, val: unknown, noWrite = false): void {
		const lastTarget = this._getLastTarget(key);
		if (!lastTarget) {
			return;
		}
		const { currentTarget, currentContainer, lastKey } = lastTarget;

		if (
			(currentTarget &&
				typeof currentTarget === 'object' &&
				typeof val === 'string') ||
			typeof val === 'number'
		) {
			// Set every child of this object to that value
			const final = currentContainer[lastKey];
			for (const child in final as Record<string, unknown>) {
				this.setVal(`${key}.${child}`, val, true);
			}
		} else {
			currentContainer[lastKey] = val;
		}

		if (!noWrite) {
			DBFileManager.write(this._fileName, this._data);
		}
	}

	public pushVal(
		key: string,
		val: unknown,
		duplicateBehavior: 'warning' | 'ignore' | 'duplicate' = 'warning',
		noWrite: boolean = false
	): void {
		const lastTarget = this._getLastTarget(key);
		if (!lastTarget) {
			return;
		}
		const { currentTarget, currentContainer, lastKey } = lastTarget;

		if (
			typeof currentTarget !== 'object' ||
			!Array.isArray(currentTarget)
		) {
			currentContainer[lastKey] = [val];
		} else {
			if (
				currentTarget.includes(val) &&
				duplicateBehavior !== 'duplicate'
			) {
				if (duplicateBehavior === 'warning') {
					warning(
						'Current value array for',
						key,
						'now equal to',
						currentTarget,
						'already contains value',
						val,
						'Skipping'
					);
				}
			} else {
				currentTarget.push(val);
			}
		}

		if (!noWrite) {
			DBFileManager.write(this._fileName, this._data);
		}
	}

	public deleteArrayVal<V>(
		key: string,
		filter: (value: V) => boolean,
		noWrite = false
	): void {
		const lastTarget = this._getLastTarget(key);
		if (!lastTarget) {
			return;
		}
		const { currentTarget, currentContainer, lastKey } = lastTarget;

		if (
			typeof currentTarget !== 'object' ||
			!Array.isArray(currentTarget)
		) {
			return;
		} else {
			currentContainer[lastKey] = currentTarget.filter(
				(entry) => !filter(entry)
			);
		}

		if (!noWrite) {
			DBFileManager.write(this._fileName, this._data);
		}
	}

	public get<V>(key: string, defaultVal: V): V;
	public get<V>(key: string): V | undefined;
	public get<V>(
		key: string,
		defaultVal: V | undefined = undefined
	): V | undefined {
		this._assertInitialized();

		const parts = key.split('.');
		let current = this._data;

		for (const part of parts) {
			if (typeof current !== 'object' || !(part in current)) {
				// Value does not exist
				return defaultVal;
			}
			current = current[part] as Record<string, unknown>;
		}
		return ((current as unknown) || defaultVal) as V;
	}

	public async data(force = false): Promise<Record<string, unknown>> {
		this._assertInitialized();

		if (force) {
			return (this._data = await DBFileManager.read(this._fileName));
		}
		return this._data;
	}

	public async json(force = false): Promise<string> {
		return JSON.stringify(await this.data(force));
	}
}
