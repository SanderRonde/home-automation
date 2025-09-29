import { hasArg, getArg, getNumberArg, getNumberEnv } from './lib/io';
import { createServeOptions, type ServeOptions } from './lib/routes';
import { CLIENT_FOLDER, DB_FOLDER, ROOT } from './lib/constants';
import { ProgressLogger } from './lib/logging/progress-logger';
import type { AllModules, ModuleConfig } from './modules';
import { SettablePromise } from './lib/settable-promise';
import { logReady, logTag } from './lib/logging/logger';
import { printCommands } from './modules/bot/helpers';
import { notifyAllModules } from './modules/modules';
import { serveStatic } from './lib/serve-static';
import { LogObj } from './lib/logging/lob-obj';
import { getAllModules } from './modules';
import { Database } from './lib/db';
import { wait } from './lib/time';
import { SQL } from 'bun';
import path from 'path';

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
	private readonly _server = new SettablePromise<Bun.Server>();
	private _initLogger!: ProgressLogger;

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

	private async _initModules() {
		notifyAllModules();

		const modules = getAllModules();

		const initValues = await Promise.all(
			Object.values(modules).map(async (meta) => {
				const sqlDB = new SQL(
					`sqlite://${path.join(DB_FOLDER, meta.dbName)}.db`
				);
				const moduleName = meta.name.toLowerCase();
				const initConfig: ModuleConfig = {
					config: this._config,
					wsPublish: async (data: string) => {
						return (await this._server.value).publish(
							moduleName,
							data
						);
					},
					db: new Database(`${meta.dbName}.json`),
					sqlDB: sqlDB,
					modules,
				};
				meta._sqlDB.set(sqlDB);
				const result = await meta.init(initConfig);
				const serveOptions =
					(result?.serve as ServeOptions<unknown>) ?? {};
				this._initLogger.increment(meta.loggerName);

				const mappedRoutes: NonNullable<
					ServeOptions<unknown>['routes']
				> = {};
				for (const key in serveOptions.routes) {
					mappedRoutes[`/${moduleName}${key}`] =
						serveOptions.routes[key];
				}
				return {
					routes: mappedRoutes,
					moduleName,
					websocket: serveOptions.websocket,
				};
			})
		);

		const allRoutes: ServeOptions<unknown>['routes'] = {};
		for (const { routes } of initValues) {
			for (const key in routes) {
				allRoutes[key] = routes[key];
			}
		}

		const websocketsByRoute: Record<
			string,
			| {
					websocket: ServeOptions<unknown>['websocket'];
					moduleName: string;
			  }
			| undefined
		> = {};
		for (const { moduleName, websocket } of initValues) {
			if (websocket) {
				websocketsByRoute[`/${moduleName}/ws`] = {
					websocket,
					moduleName,
				};
			}
		}

		this._initLogger.increment('post-init');
		return {
			modules,
			routes: allRoutes,
			websocketsByRoute: websocketsByRoute,
		};
	}

	private async _listen(
		modules: AllModules,
		routes: ServeOptions<unknown>['routes'],
		websocketsByRoute: Record<
			string,
			| {
					websocket: ServeOptions<unknown>['websocket'];
					moduleName: string;
			  }
			| undefined
		>
	) {
		const server: Bun.Server = Bun.serve<
			{ route: string; moduleName: string },
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			any
		>({
			fetch: (req, server) => {
				const url = new URL(req.url);
				const websocket = websocketsByRoute[url.pathname];
				if (websocket) {
					server.upgrade(req, {
						data: {
							route: url.pathname,
							moduleName: websocket.moduleName,
						},
					});
					return undefined;
				}
				return new Response('Not found', { status: 404 });
			},
			routes: {
				...routes,
				...createServeOptions({
					...(await serveStatic(CLIENT_FOLDER)),
					...(await serveStatic(path.join(ROOT, 'static'))),
				}).routes,
			},
			// HTTPS is unused for now
			port: this._config.ports.http,
			development: this._config.debug
				? {
						hmr: true,
						console: true,
						chromeDevToolsAutomaticWorkspaceFolders: true,
					}
				: false,
			error: (error) => {
				console.error('Error', error);
			},
			websocket: {
				open: (ws) => {
					ws.subscribe(ws.data.moduleName);
					return websocketsByRoute[ws.data.route]?.websocket?.open?.(
						ws,
						server
					);
				},
				message: (ws, message) =>
					websocketsByRoute[ws.data.route]?.websocket?.message?.(
						ws,
						message,
						server
					),
				close: (ws, code, reason) => {
					ws.unsubscribe(ws.data.moduleName);
					return websocketsByRoute[ws.data.route]?.websocket?.close?.(
						ws,
						code,
						reason,
						server
					);
				},
			},
		});
		this._server.set(server);

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
			3 + Object.keys(getAllModules(false)).length
		);
		const { modules, routes, websocketsByRoute } =
			await this._initModules();
		this._initLogger.increment('modules');

		LogObj.logLevel = this._config.log.level;
		if (this._config.logTelegramBotCommands) {
			await printCommands();
		}
		await this._listen(modules, routes, websocketsByRoute);
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
	// eslint-disable-next-line n/no-process-exit
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
