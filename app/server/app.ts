import { hasArg, getArg, getNumberArg } from './lib/io';
import { initRoutes } from './lib/routes';
import { readSecret } from './lib/auth';
import { Database } from './lib/db';
import * as express from 'express';
import * as path from 'path';
import * as http from 'http';

interface PartialConfig {
	ports?: {
		http?: number|void;
		https?: number|void;
	}
	scriptDir?: string|void;
}

export type Config = Required<PartialConfig>;

class WebServer {
	public app!: express.Express;
	public db!: Database;

	private _config: Config;

	private _setConfigDefaults(config: PartialConfig): Config {
		return {
			ports: {
				http: config.ports && config.ports.http || 1234,
				https: config.ports && config.ports.https || 1235,
			},
			scriptDir: config.scriptDir || path.join(__dirname, '../../', 'scripts')
		}
	}

	constructor(config: PartialConfig = {}) {
		this._config = this._setConfigDefaults(config);
	}

	public async init() {
		await readSecret();
		await this._initVars();
		this._initRoutes();
		this._listen();
	}

	private async _initVars() {
		this.app = express();
		this.db = await new Database().init();
	}

	private _initRoutes() {
		initRoutes(this.app, this.db, this._config);
	}

	private _listen() {
		// HTTPS is unused for now
		http.createServer(this.app).listen(this._config.ports.http, () => {
			console.log(`HTTP server listening on port ${this._config.ports.http}`);
		});
	}
}

if (hasArg('help', 'h')) {
	console.log('Usage:');
	console.log('');
	console.log('node app/server/app.js [-h | --help] [--http {port}] ');
	console.log('						[--https {port}] [--scripts {dir}]');
	console.log('');
	console.log('-h, --help			print this help message');
	console.log('--http 	{port}	The HTTP port to use');
	console.log('--https 	{port}	The HTTP port to use');
	console.log('--scripts 	{dir}	A directory of scripts to use for /script');
	process.exit(0);
}
new WebServer({
	ports: {
		http: getNumberArg('http'),
		https: getNumberArg('https')
	},
	scriptDir: getArg('scripts')
}).init();