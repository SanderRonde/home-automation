import { setLogLevel, ProgressLogger, startInit, endInit } from './lib/logger';
import {
	initRoutes,
	initMiddleware,
	initAnnotatorRoutes,
	AppWrapper,
	initPostRoutes
} from './lib/routes';
import { notifyAllModules, NoDBModuleConfig } from './modules/modules';
import { hasArg, getArg, getNumberArg } from './lib/io';
import { WSSimulator, WSWrapper } from './lib/ws';
import { getAllModules, Bot } from './modules';
import { Database } from './lib/db';
import * as express from 'express';
import * as path from 'path';
import * as http from 'http';

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
	};
	debug?: boolean;
}

type DeepRequired<T> = {
	[P in keyof T]-?: DeepRequired<T[P]>;
};

export type Config = DeepRequired<PartialConfig>;

class WebServer {
	public app!: express.Express;
	public websocketSim!: WSSimulator;
	public ws!: WSWrapper;
	private _server!: http.Server;

	private _config: Config;
	private _initLogger!: ProgressLogger;

	private _setConfigDefaults(config: PartialConfig): Config {
		return {
			ports: {
				http: config.ports?.http || 1234,
				https: config.ports?.https || 1235,
				info: config.ports?.info || 1337
			},
			scripts: {
				uid: config.scripts?.uid || 0,
				scriptDir:
					config.scripts?.scriptDir ||
					path.join(__dirname, '../../', 'scripts')
			},
			log: {
				level: config.log?.level || 1,
				secrets: config.log?.secrets || false
			},
			debug: config.debug || false
		};
	}

	constructor(config: PartialConfig = {}) {
		this._config = this._setConfigDefaults(config);
		startInit();
	}

	private async _initModules() {
		await notifyAllModules();

		const modules = await getAllModules();

		const config: NoDBModuleConfig = {
			app: new AppWrapper(this.app),
			websocketSim: this.websocketSim,
			config: this._config,
			randomNum: Math.round(Math.random() * 1000000),
			websocket: this.ws
		};
		await Promise.all(
			Object.values(modules).map(async mod => {
				await mod.meta.init({
					...config,
					db: await new Database(`${mod.meta.dbName}.json`).init()
				});
				this._initLogger.increment(mod.meta.loggerName);
			})
		);
	}

	public async init() {
		this._initLogger = new ProgressLogger(
			'Server start',
			8 + Object.keys(await getAllModules(false)).length
		);
		this._initLogger.increment('IO');

		this.app = express();
		this._initLogger.increment('express');
		await initMiddleware(this.app);
		await initAnnotatorRoutes(this.app);
		this._initLogger.increment('middleware');
		await this._initServers();
		this._initLogger.increment('servers');
		await initRoutes(this.app);
		this._initLogger.increment('routes');
		await this._initModules();
		this._initLogger.increment('modules');
		await initPostRoutes(this.app);
		setLogLevel(this._config.log.level);
		await Bot.printCommands();
		this._listen();
	}

	private async _initServers() {
		this.websocketSim = new WSSimulator();
		this.app.use((req, res, next) => {
			this.websocketSim.handler(req, res, next);
		});
		this._server = http.createServer(this.app);
		this.ws = new WSWrapper(this._server);
		this._initLogger.increment('HTTP server');
	}

	private _listen() {
		// HTTPS is unused for now
		this._server.listen(this._config.ports.http, () => {
			this._initLogger.increment('listening');
			this._initLogger.done();
			endInit();
			console.log(
				`HTTP server listening on port ${this._config.ports.http}`
			);
		});
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
	process.exit(0);
}
function getVerbosity() {
	if (hasArg('verbose*', 'v*')) {
		return Infinity;
	}
	if (hasArg('verbose', 'v')) {
		return 1;
	}
	if (hasArg('veryverbose', 'vv')) {
		return 2;
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
new WebServer({
	ports: {
		http: getNumberArg('http'),
		https: getNumberArg('https'),
		info: getNumberArg('info-port')
	},
	scripts: {
		scriptDir: getArg('scripts'),
		uid: getNumberArg('uid')
	},
	log: {
		level: getVerbosity(),
		secrets: hasArg('log-secrets') || false
	},
	debug: hasArg('debug')
}).init();
