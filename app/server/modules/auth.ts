import { attachMessage } from '../lib/logger';
import { ModuleConfig } from './modules';
import { ModuleMeta } from './meta';
import { getEnv } from '../lib/io';
import chalk from 'chalk';
import { createRouter } from '../lib/api';

export namespace Auth {
	export const meta = new (class Meta extends ModuleMeta {
		name = 'auth';

		async init(config: ModuleConfig) {
			await initRoutes(config);
		}
	})();

	export namespace ClientSecret {
		const ids: Map<number, string> = new Map();

		function createId(): number {
			let id = Math.floor(Math.random() * (1e6 - 1e5)) + 1e5;
			if (ids.has(id)) return createId();
			return id;
		}

		function createClientSecret(id: number) {
			const key = Secret.getKey();
			const idArr = (id + '').split('').map(s => parseInt(s, 10));

			return key
				.split('')
				.map(char => {
					let charCode = char.charCodeAt(0);
					for (const idChar of idArr) {
						charCode = charCode ^ idChar;
					}
					return charCode;
				})
				.join('');
		}

		export function genId(): number {
			const id = createId();
			ids.set(id, createClientSecret(id));
			return id;
		}

		export function getClientSecret(id: number) {
			if (ids.has(id)) {
				return ids.get(id)!;
			}
			const secret = createClientSecret(id);
			ids.set(id, secret);
			return secret;
		}

		export function authenticate(authKey: string, id: string) {
			if (authKey === Secret.getKey()) return true;

			if (Number.isNaN(parseInt(id, 10))) return false;
			return ClientSecret.getClientSecret(parseInt(id, 10)) === authKey;
		}
	}

	export namespace Secret {
		let key: string = getEnv('SECRET_AUTH', true);
		let botSecret: string = getEnv('SECRET_BOT', true);

		export function authenticate(authKey: string) {
			return key === authKey;
		}

		export function getKey() {
			return key;
		}

		export function redact(msg: string) {
			return msg
				.replace(key!, '[redacted]')
				.replace(botSecret!, '[redacted]');
		}
	}

	export namespace Cookie {
		export function genCookie() {
			const id = ClientSecret.genId();
			const clientSecret = ClientSecret.getClientSecret(id)!;

			return JSON.stringify([id, clientSecret]);
		}

		function verifyCookie(cookie: string) {
			const parsed = JSON.parse(cookie);
			if (!parsed || !Array.isArray(parsed) || parsed.length !== 2)
				return false;
			if (typeof parsed[0] !== 'number' || typeof parsed[1] !== 'string')
				return false;

			return ClientSecret.getClientSecret(parsed[0]) === parsed[1];
		}

		export function checkCookie(req: {
			cookies: {
				[key: string]: string;
			};
		}) {
			return (
				req.cookies &&
				req.cookies['key'] &&
				verifyCookie(req.cookies['key'])
			);
		}
	}

	async function initRoutes({ app, config }: ModuleConfig) {
		app.post('/authid', (_req, res) => {
			const id = Auth.ClientSecret.genId() + '';
			if (config.log.secrets) {
				attachMessage(
					res,
					`{"id": "${chalk.underline(
						id
					)}", "auth": "${chalk.underline(
						ClientSecret.getClientSecret(parseInt(id, 10))!
					)}" }`
				);
			}
			res.status(200).write(id);
			res.end();
		});

		const router = createRouter(Auth, {});
		router.all('/key', (req, res) => {
			if (Secret.authenticate(req.params.key)) {
				res.cookie('key', Cookie.genCookie(), {
					// Expires in quite a few years
					expires: new Date(2147483647000)
				});
				res.status(200).write('Success');
			} else {
				res.status(403).write('Access denied');
			}
			res.end();
		});
		router.use(app);
	}
}
