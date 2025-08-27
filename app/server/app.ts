import { hasArg, getArg, getNumberArg, getNumberEnv } from './lib/io';
import { ProgressLogger } from './lib/logging/progress-logger';
import { initMiddleware, initPostRoutes } from './lib/routes';
import type { BaseModuleConfig } from './modules/modules';
import { logReady, logTag } from './lib/logging/logger';
import { printCommands } from './modules/bot/helpers';
import { notifyAllModules } from './modules/modules';
import { LogObj } from './lib/logging/lob-obj';
import type { AllModules } from './modules';
import { SQLDatabase } from './lib/sql-db';
import type { Routes } from './lib/routes';
import { getAllModules } from './modules';
import { WSWrapper } from './lib/ws';
import { Database } from './lib/db';
import { wait } from './lib/time';
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

		errorLogPath?: string | null | void;
	};
	debug?: boolean;
	instant?: boolean;
	logTelegramBotCommands?: boolean;
}

type DeepRequired<T> = {
	[P in keyof T]-?: DeepRequired<T[P]>;
};

export type AppConfig = DeepRequired<PartialConfig>;

class WebServer {
	private readonly _config: AppConfig;
	private _server!: http.Server;
	private _initLogger!: ProgressLogger;

	public app!: express.Express;
	public ws!: WSWrapper;

	public constructor(config: PartialConfig = {}) {
		this._config = this._setConfigDefaults(config);
	}

	private _setConfigDefaults(config: PartialConfig): AppConfig {
		return {
			ports: {
				http: config.ports?.http || 1234,
				https: config.ports?.https || 1235,
				info: config.ports?.info || 1337,
			},
			log: {
				level: config.log?.level || 1,
				secrets: config.log?.secrets || false,

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
			config: this._config,
			randomNum: Math.round(Math.random() * 1000000),
			websocket: this.ws,
		};
	}

	private async _initModules() {
		notifyAllModules();

		const modules = getAllModules();

		const config: BaseModuleConfig = this._getModuleConfig();
		const initValues = await Promise.all(
			Object.values(modules).map(async (meta) => {
				const sqlDB = new SQLDatabase(`${meta.dbName}.sqlite`);
				const initConfig = {
					...config,
					db: await new Database(`${meta.dbName}.json`).init(),
					sqlDB: sqlDB,
					modules,
				};
				meta._sqlDB.set(sqlDB);
				const result = await meta.init(initConfig);
				const routes = result?.routes as Routes;
				this._initLogger.increment(meta.loggerName);

				const mappedRoutes: Routes = {};
				for (const key in routes) {
					mappedRoutes[`/${meta.name.toLowerCase()}${key}`] =
						routes[key];
				}
				return { routes: mappedRoutes };
			})
		);

		const allRoutes: Routes = {};
		for (const { routes } of initValues) {
			for (const key in routes) {
				allRoutes[key] = routes[key];
			}
		}

		this._initLogger.increment('post-init');
		return { modules, routes: allRoutes };
	}

	private _initServers() {
		this._server = http.createServer(this.app);
		this.ws = new WSWrapper(this._server);
		this._initLogger.increment('HTTP server');
	}

	private async _listen(modules: AllModules, routes: Routes) {
		Bun.serve({
			routes,
			// HTTPS is unused for now
			port: this._config.ports.http,
		});

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
		this._initLogger.increment('middleware');
		this._initServers();
		this._initLogger.increment('servers');
		const { modules, routes } = await this._initModules();
		this._initLogger.increment('modules');
		initPostRoutes({ app: this.app, config: this._config });

		LogObj.logLevel = this._config.log.level;
		if (this._config.logTelegramBotCommands) {
			await printCommands();
		}
		await this._listen(modules, routes);
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

		errorLogPath: getArg('error-log-path'),
	},
	debug: hasArg('debug') || !!getArg('IO_DEBUG'),
	instant: hasArg('instant', 'i'),
	logTelegramBotCommands: hasArg('log-telegram-bot-commands'),
}).init();
