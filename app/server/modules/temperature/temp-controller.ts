import type {
	Schema,
	SQLDatabase,
	SQLDatabaseWithSchema,
} from '../../lib/sql-db';
import { logTag } from '../../lib/logging/logger';
import { LOG_INTERVAL_SECS } from './constants';
import chalk from 'chalk';

const schema = {
	modes: {
		location: {
			type: 'TEXT',
			nullable: false,
			primaryKey: true,
		},
		mode: {
			type: 'TEXT',
			nullable: false,
			enum: ['on', 'off', 'auto'],
		},
	},
	targets: {
		location: {
			type: 'TEXT',
			nullable: false,
			primaryKey: true,
		},
		target: {
			type: 'INTEGER',
			nullable: false,
		},
	},
	temperatures: {
		time: {
			type: 'INTEGER',
			nullable: false,
			primaryKey: true,
		},
		location: {
			type: 'TEXT',
			nullable: false,
		},
		temperature: {
			type: 'INTEGER',
			nullable: false,
		},
	},
} as const satisfies Schema;

class TempControl {
	private _listeners: ((temperature: number) => void | Promise<void>)[] = [];

	public lastTemp = -1;
	public lastLogTime = 0;
	public lastLoggedTemp = -1;
	public readonly db: Promise<SQLDatabaseWithSchema<typeof schema>>;

	public constructor(
		db: SQLDatabase,
		public readonly name: string
	) {
		this.db = db.applySchema(schema);
	}

	public async setLastTemp(temp: number, store = true, doLog = true) {
		this.lastTemp = temp;

		// Write temp to database
		if (store) {
			await (
				await this.db
			).temperatures.insert({
				time: Date.now(),
				location: this.name,
				temperature: temp,
			});
		}

		if (
			doLog &&
			Math.round(this.lastLoggedTemp) !== Math.round(temp) &&
			Date.now() - this.lastLogTime > LOG_INTERVAL_SECS * 1000
		) {
			logTag(
				'temp',
				'cyan',
				chalk.bold(`Current ${this.name} temperature: ${temp}°`)
			);
			this.lastLogTime = Date.now();
		}

		void Promise.all(this._listeners.map((listener) => listener(temp)));
	}

	public getLastTemp() {
		return this.lastTemp;
	}

	public addListener(
		listener: (temperature: number) => void | Promise<void>
	) {
		this._listeners.push(listener);
	}

	public async init() {
		const temp =
			(
				await (
					await this.db
				).temperatures.querySingle({ location: this.name }, 'last')
			)?.temperature ?? 20.0;

		await this.setLastTemp(temp, false, false);

		return this;
	}
}

const controllers: Map<string, TempControl> = new Map();

export async function getController(
	db: SQLDatabase,
	name = 'default'
): Promise<TempControl> {
	if (!controllers.has(name)) {
		controllers.set(name, await new TempControl(db, name).init());
	}

	return controllers.get(name)!;
}

export function getAll(): TempControl[] {
	return Array.from(controllers.values());
}
