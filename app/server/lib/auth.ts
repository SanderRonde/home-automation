import { AUTH_SECRET_FILE } from './constants';
import { attachMessage } from './logger';
import { AppWrapper } from './routes';
import * as express from 'express';
import { Config } from '../app';
import * as fs from 'fs-extra';
import chalk from 'chalk';

export namespace Auth {
	export namespace ClientSecret {
		const ids: Map<number, string> = new Map();

		function createId(): number {
			let id = Math.floor(Math.random() * (1E6 - 1E5)) + 1E5;
			if (ids.has(id)) return createId();
			return id;
		}

		export async function createClientSecret(id: number) {
			const key = await Secret.getKey();
			const idArr = (id + '').split('').map(s => parseInt(s, 10));

			return key.split('').map((char) => {
				let charCode = char.charCodeAt(0);
				for (const idChar of idArr) {
					charCode = charCode ^ idChar;
				}
				return charCode;
			}).join('');
		}

		export async function genId(): Promise<number> {
			const id = createId();
			ids.set(id, await createClientSecret(id));
			return id;
		}

		export async function getClientSecret(id: number) {
			if (ids.has(id)) {
				return ids.get(id)!;
			}
			const secret = await createClientSecret(id);
			ids.set(id, secret);
			return secret;
		}

		export async function authenticate(authKey: string, id: string) {
			if (authKey === Secret.getKeySync()) return true;

			if (Number.isNaN(parseInt(id, 10))) return false;
			return await ClientSecret.getClientSecret(parseInt(id, 10)) === authKey;
		}
	}

	export namespace Secret {
		let key: string|null = null;
		export async function readSecret() {
			if (!(await fs.pathExists(AUTH_SECRET_FILE))) {
				console.log('Missing auth file');
				process.exit(1);
			}

			return (key = await fs.readFile(AUTH_SECRET_FILE, {
				encoding: 'utf8'
			}));
		}

		export function authenticate(authKey: string) {
			return key === authKey;
		}

		export function getKeySync() {
			return key;
		}
		
		export async function getKey() {
			return key || await Auth.Secret.readSecret();
		}

		export function redact(msg: string) {
			return msg.replace(key!, '[redacted]');
		}
	}

	export namespace Cookie {
		export async function genCookie() {
			const id = await ClientSecret.genId();
			const clientSecret = await ClientSecret.getClientSecret(id)!;
			
			return JSON.stringify([id, clientSecret]);
		}

		async function verifyCookie(cookie: string) {
			const parsed = JSON.parse(cookie);
			if (!parsed || !Array.isArray(parsed) || parsed.length !== 2) return false;
			if (typeof parsed[0] !== 'number' || typeof parsed[1] !== 'string') return false;

			return await ClientSecret.getClientSecret(parsed[0]) === parsed[1];
		}

		export async function checkCookie(req: express.Request) {
			return req.cookies && req.cookies['key'] && await verifyCookie(req.cookies['key']);
		}
	}

	export async function initRoutes({ app, config }: { app: AppWrapper; config: Config; }) {
		await Secret.readSecret();
		app.post('/authid', async (_req, res) => {
			const id = (await Auth.ClientSecret.genId()) + '';
			if (config.log.secrets) {
				attachMessage(res, `{"id": "${
					chalk.underline(id)
				}", "auth": "${
					chalk.underline(await ClientSecret.getClientSecret(parseInt(id, 10))!)
				}" }`);
			}
			res.status(200).write(id);
			res.end();
		});
		app.all('/auth/:key', async (req, res) => {
			if (Secret.authenticate(req.params.key)) {
				res.cookie('key', await Cookie.genCookie(), {
					// Expires in quite a few years
					expires: new Date(2147483647000)
				});
				res.status(200).write('Success');
			} else {
				res.status(403).write('Access denied');
			}
			res.end();
		});
	}
}