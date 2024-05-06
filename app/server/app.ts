import * as dotenv from 'dotenv';
dotenv.config({
	path: (require('path') as typeof import('path')).join(
		__dirname,
		'../../',
		'.env'
	),
});
import {
	setLogLevel,
	ProgressLogger,
	startInit,
	endInit,
	logTag,
	warning,
} from './lib/logger';
import {
	initMiddleware,
	initAnnotatorRoutes,
	initPostRoutes,
} from './lib/routes';
import { hasArg, getArg, getNumberArg, getNumberEnv, getEnv } from './lib/io';
import { notifyAllModules, BaseModuleConfig } from './modules/modules';
import { SQLDatabase, SQLDatabaseWithSchema } from './lib/sql-db';
import { ProfilingIntegration } from '@sentry/profiling-node';
import { printCommands } from './modules/bot/helpers';
import { AllModules, getAllModules } from './modules';
import { WSSimulator, WSWrapper } from './lib/ws';
import * as Sentry from '@sentry/node';
import { exec } from 'child_process';
import { Database } from './lib/db';
import 'express-async-errors';
import express from 'express';
import * as path from 'path';
import * as http from 'http';
import PM2 from '@pm2/io';

interface PartialConfig {
	ports?: {
		info?: number | void;
		http?: number | void;
		https?: number | void;
	};
	scripts?: {
		uid?: number | void;
		scriptDir?: string | void;
	};
	log?: {
		level?: number;
		secrets: boolean;
		ignorePressure?: boolean;
		errorLogPath?: string | null | void;
	};
	debug?: boolean;
	instant?: boolean;
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
		startInit();
	}

	private _setConfigDefaults(config: PartialConfig): Config {
		return {
			ports: {
				http: config.ports?.http || 1234,
				https: config.ports?.https || 1235,
				info: config.ports?.info || 1337,
			},
			scripts: {
				uid: config.scripts?.uid || 0,
				scriptDir:
					config.scripts?.scriptDir ||
					path.join(__dirname, '../../', 'scripts'),
			},
			log: {
				level: config.log?.level || 1,
				secrets: config.log?.secrets || false,
				ignorePressure: config?.log?.ignorePressure || false,
				// In debug mode always log errors to console
				errorLogPath: config.debug
					? null
					: config?.log?.errorLogPath ?? null,
			},
			debug: config.debug || false,
			instant: config.instant || false,
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
					).applySchema(meta.schema)) as SQLDatabaseWithSchema<any>,
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
		this._server.listen(this._config.ports.http, () => {
			this._initLogger.increment('listening');
			this._initLogger.done();
			endInit();

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
		PM2.init({
			catchExceptions: true,
			tracing: {
				enabled: true,
			},
		});
		this._initLogger.increment('IO');

		this.app = express();
		const sentryEnv = getEnv('SECRET_SENTRY_DSN');
		if (sentryEnv) {
			const release = await new Promise<string>((resolve) => {
				exec(
					'git rev-parse HEAD',
					{
						cwd: path.join(__dirname, '../../'),
					},
					(err, stdout) => {
						if (err) {
							warning('Failed to get git commit hash');
							resolve('???');
						} else {
							resolve(stdout.trim());
						}
					}
				);
			});
			Sentry.init({
				dsn: sentryEnv,
				integrations: [
					new Sentry.Integrations.Http({ tracing: true }),
					new Sentry.Integrations.Express({ app: this.app }),
					new ProfilingIntegration(),
				],
				release,
				tracesSampleRate: 1,
				profilesSampleRate: 1.0,
			});
		}

		this._initLogger.increment('express');
		initMiddleware(this._getModuleConfig());
		initAnnotatorRoutes(this.app);
		this._initLogger.increment('middleware');
		this._initServers();
		this._initLogger.increment('servers');
		const modules = await this._initModules();
		this._initLogger.increment('modules');
		initPostRoutes(this.app);

		setLogLevel(this._config.log.level);
		await printCommands();
		this._listen(modules);
	}
}

if (hasArg('help', 'h')) {
	console.log('Usage:');
	console.log('');
	console.log('node app/server/app.js 		[-h | --help] [--http {port}] ');
	console.log('				[--https {port}] [--scripts {dir}]');
	console.log('				[--uid	{uid}] [-v | --verbose]');
	console.log('				[-vv | --veryverbose]');
	console.log('');
	console.log('-h, --help			Print this help message');
	console.log('--http 		{port}		The HTTP port to use');
	console.log('--https 	{port}		The HTTP port to use');
	console.log('--uid 		{uid}		The uid to use for scripts');
	console.log('--scripts 	{dir}		A directory of scripts to use for /script');
	console.log('-v, --verbose			Log request-related data');
	console.log('-vv, --veryverbose		Log even more request-related data');
	console.log(
		"-v{v+}, --{very+}verbose	Logs even more data. The more v's and very's the more data"
	);
	console.log(
		"-v*, --verbose*			Logs all data (equivalent of adding a lot of v's"
	);
	console.log('--ignore-pressure		Ignore pressure report logs');
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
	scripts: {
		scriptDir: getArg('scripts') || getEnv('IO_SCRIPT_DIR'),
		uid: getNumberArg('uid') || getNumberEnv('IO_UID'),
	},
	log: {
		level: getVerbosity(),
		secrets: hasArg('log-secrets') || false,
		ignorePressure: hasArg('ignore-pressure'),
		errorLogPath: getArg('error-log-path'),
	},
	debug: hasArg('debug') || !!getArg('IO_DEBUG'),
	instant: hasArg('instant', 'i'),
}).init();
