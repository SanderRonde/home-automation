import {
	initMiddleware,
	initAnnotatorRoutes,
	initPostRoutes,
} from './lib/routes';
import { hasArg, getArg, getNumberArg, getNumberEnv } from './lib/io';
import { ProgressLogger } from './lib/logging/progress-logger';
import type { BaseModuleConfig } from './modules/modules';
import { logReady, logTag } from './lib/logging/logger';
import { printCommands } from './modules/bot/helpers';
import { notifyAllModules } from './modules/modules';
import { WSSimulator, WSWrapper } from './lib/ws';
import { LogObj } from './lib/logging/lob-obj';
import type { AllModules } from './modules';
import { SQLDatabase } from './lib/sql-db';
import { getAllModules } from './modules';
import { Database } from './lib/db';
import { wait } from './lib/util';
import 'express-async-errors';
import express from 'express';
import * as http from 'http';

interface PartialConfig {
	ports?: {
		info?: number | void;
		http?: number | void;
		https?: number | void;
	};
	log?: {
		level?: number;
		secrets: boolean;
		ignorePressure?: boolean;
		errorLogPath?: string | null | void;
	};
	debug?: boolean;
	instant?: boolean;
	logTelegramBotCommands?: boolean;
}

type DeepRequired<T> = {
	[P in keyof T]-?: DeepRequired<T[P]>;
};

export type Config = DeepRequired<PartialConfig>;

class WebServer {
	private readonly _config: Config;
	private _server!: http.Server;
	private _initLogger!: ProgressLogger;

	public app!: express.Express;
	public websocketSim!: WSSimulator;
	public ws!: WSWrapper;

	public constructor(config: PartialConfig = {}) {
		this._config = this._setConfigDefaults(config);
	}

	private _setConfigDefaults(config: PartialConfig): Config {
		return {
			ports: {
				http: config.ports?.http || 1234,
				https: config.ports?.https || 1235,
				info: config.ports?.info || 1337,
			},
			log: {
				level: config.log?.level || 1,
				secrets: config.log?.secrets || false,
				ignorePressure: config?.log?.ignorePressure || false,
				// In debug mode always log errors to console
				errorLogPath: config.debug
					? null
					: (config?.log?.errorLogPath ?? null),
			},
			debug: config.debug || false,
			instant: config.instant || false,
			logTelegramBotCommands: config.logTelegramBotCommands || false,
		};
	}

	private _getModuleConfig(): BaseModuleConfig {
		return {
			app: this.app,
			websocketSim: this.websocketSim,
			config: this._config,
			randomNum: Math.round(Math.random() * 1000000),
			websocket: this.ws,
		};
	}

	private async _initModules() {
		notifyAllModules();

		const modules = getAllModules();

		const config: BaseModuleConfig = this._getModuleConfig();
		await Promise.all(
			Object.values(modules).map(async (meta) => {
				await meta.init({
					...config,
					db: await new Database(`${meta.dbName}.json`).init(),
					sqlDB: (await new SQLDatabase(
						`${meta.dbName}.sqlite`
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
					).applySchema(meta.schema)) as any,
					modules,
				});
				this._initLogger.increment(meta.loggerName);
			})
		);

		this._initLogger.increment('post-init');
		return modules;
	}

	private _initServers() {
		this.websocketSim = new WSSimulator();
		this.app.use(async (req, res, next) => {
			await this.websocketSim.handler(req, res, next);
		});
		this._server = http.createServer(this.app);
		this.ws = new WSWrapper(this._server);
		this._initLogger.increment('HTTP server');
	}

	private _listen(modules: AllModules) {
		// HTTPS is unused for now
		this._server.listen(this._config.ports.http, async () => {
			this._initLogger.increment('listening');
			this._initLogger.done();
			await wait(100);
			logReady();

			logTag(
				'HTTP server',
				'magenta',
				`listening on port ${this._config.ports.http}`
			);

			// Run post-inits
			void Promise.all(
				Object.values(modules).map(async (meta) => {
					await meta.postInit();
				})
			);
		});
	}

	public async init() {
		this._initLogger = new ProgressLogger(
			'Server start',
			8 + Object.keys(getAllModules(false)).length
		);
		this._initLogger.increment('IO');

		this.app = express();

		this._initLogger.increment('express');
		initMiddleware(this._getModuleConfig().app);
		initAnnotatorRoutes(this.app);
		this._initLogger.increment('middleware');
		this._initServers();
		this._initLogger.increment('servers');
		const modules = await this._initModules();
		this._initLogger.increment('modules');
		initPostRoutes({ app: this.app, config: this._config });

		LogObj.logLevel = this._config.log.level;
		if (this._config.logTelegramBotCommands) {
			await printCommands();
		}
		this._listen(modules);
	}
}

if (hasArg('help', 'h')) {
	console.log('Usage:');
	console.log('');
	console.log('node app/server/app.js 		[-h | --help] [--http {port}] ');
	console.log('				[--https {port}] [-v | --verbose]');
	console.log('				[-vv | --veryverbose]');
	console.log('');
	console.log('-h, --help			Print this help message');
	console.log('--http 		{port}		The HTTP port to use');
	console.log('--https 	{port}		The HTTP port to use');
	console.log('-v, --verbose			Log request-related data');
	console.log('-vv, --veryverbose		Log even more request-related data');
	console.log(
		"-v{v+}, --{very+}verbose	Logs even more data. The more v's and very's the more data"
	);
	console.log(
		"-v*, --verbose*			Logs all data (equivalent of adding a lot of v's"
	);
	console.log('--ignore-pressure		Ignore pressure report logs');
	console.log('--log-telegram-bot-commands		Log all telegram bot commands');
	// eslint-disable-next-line no-process-exit
	process.exit(0);
}
function getVerbosity() {
	if (hasArg('verbose', 'v')) {
		return 1;
	}
	if (hasArg('veryverbose', 'vv')) {
		return 2;
	}
	if (hasArg('verbose*', 'v*')) {
		return Infinity;
	}
	for (let i = 0; i < process.argv.length; i++) {
		const arg = process.argv[i];
		if (/^--(very)*verbose$/.test(arg)) {
			return arg.slice(2, -'verbose'.length).split('very').length - 1;
		} else if (/^-(v)+$/.test(arg)) {
			return arg.slice(1).split('v').length - 1;
		}
	}
	return 0;
}
void new WebServer({
	ports: {
		http: getNumberArg('http') || getNumberEnv('IO_PORT_HTTP'),
		https: getNumberArg('https') || getNumberEnv('IO_PORT_HTTPS'),
		info: getNumberArg('info-port') || getNumberEnv('IO_PORT_INFO'),
	},
	log: {
		level: getVerbosity(),
		secrets: hasArg('log-secrets') || false,
		ignorePressure: hasArg('ignore-pressure'),
		errorLogPath: getArg('error-log-path'),
	},
	debug: hasArg('debug') || !!getArg('IO_DEBUG'),
	instant: hasArg('instant', 'i'),
	logTelegramBotCommands: hasArg('log-telegram-bot-commands'),
}).init();
