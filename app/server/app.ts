import { setLogLevel, ProgressLogger, startInit, endInit } from './lib/logger';
import { initRoutes, initMiddleware, initAnnotatorRoutes } from './lib/routes';
import { hasArg, getArg, getNumberArg } from './lib/io';
import { WSSimulator, WSWrapper } from './lib/ws';
import { Bot } from './modules/bot';
import * as express from 'express';
import * as path from 'path';
import * as http from 'http';

interface PartialConfig {
	ports?: {
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
	private _initLogger: ProgressLogger = new ProgressLogger(
		'Server start',
		18
	);

	private _setConfigDefaults(config: PartialConfig): Config {
		return {
			ports: {
				http: (config.ports && config.ports.http) || 1234,
				https: (config.ports && config.ports.https) || 1235
			},
			scripts: {
				uid: (config.scripts && config.scripts.uid) || 0,
				scriptDir:
					(config.scripts && config.scripts.scriptDir) ||
					path.join(__dirname, '../../', 'scripts')
			},
			log: {
				level: (config.log && config.log.level) || 1,
				secrets: (config.log && config.log.secrets) || false
			}
		};
	}

	constructor(config: PartialConfig = {}) {
		this._config = this._setConfigDefaults(config);
		startInit();
		this._initLogger.increment('IO');
	}

	public async init() {
		this.app = express();
		this._initLogger.increment('express');
		await initMiddleware(this.app);
		await initAnnotatorRoutes(this.app);
		this._initLogger.increment('middleware');
		await this._initServers();
		this._initLogger.increment('servers');
		await initRoutes({
			app: this.app,
			websocketSim: this.websocketSim,
			config: this._config,
			// This is just for semi-versioning of files
			// to prevent caching
			randomNum: Math.round(Math.random() * 1000000),
			initLogger: this._initLogger,
			ws: this.ws
		});
		this._initLogger.increment('routes');
		setLogLevel(this._config.log.level);
		Bot.printCommands();
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
		https: getNumberArg('https')
	},
	scripts: {
		scriptDir: getArg('scripts'),
		uid: getNumberArg('uid')
	},
	log: {
		level: getVerbosity(),
		secrets: hasArg('log-secrets') || false
	}
}).init();
