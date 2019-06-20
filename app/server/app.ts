import { initRoutes } from './lib/routes';
import { Database } from './lib/db';
import * as express from 'express';
import * as http from 'http';

class WebServer {
	public app!: express.Express;
	public db!: Database;

	private _http: number;

	constructor({
		ports: {
			http = 1234
		} = {
			http: 1234,
			https: 1235
		}
	}: {
		ports?: {
			http?: number;
			https?: number;
		}
	} = {}) {
		this._http = http;
	}

	public async init() {
		await this._initVars();
		this._initRoutes();
		this._listen();
	}

	private async _initVars() {
		this.app = express();
		this.db = await new Database().init();
	}

	private _initRoutes() {
		initRoutes(this.app, this.db);
	}

	private _listen() {
		// HTTPS is unused for now
		http.createServer(this.app).listen(this._http, () => {
			console.log(`HTTP server listening on port ${this._http}`);
		});
	}
}

function getArg(name: string): string|void {
	for (let i = 0; i < process.argv.length; i++) {
		if (process.argv[i] === `--${name}`) {
			return process.argv[i + 1];
		} else if (process.argv[i].startsWith(`--${name}=`)) {
			return process.argv[i].slice(3 + name.length);
		}
	}
	return void 0;
}

function getNumberArg(name: string): number|void {
	const arg = getArg(name);
	if (arg === void 0) return void 0;
	return ~~arg;
}

new WebServer({
	ports: {
		http: getNumberArg('http') || undefined,
		https: getNumberArg('https') || undefined
	}
}).init();