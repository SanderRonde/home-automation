import chalk from 'chalk';
import { Auth } from '.';
import { ModuleConfig } from '..';
import { createRouter } from '../../lib/api';
import { attachMessage } from '../../lib/logger';
import { genId, getClientSecret } from './client-secret';
import { genCookie } from './cookie';
import { authenticate } from './secret';

export function initRoutes({ app, config }: ModuleConfig): void {
	app.post('/authid', (_req, res) => {
		const id = String(genId());
		if (config.log.secrets) {
			attachMessage(
				res,
				`{"id": "${chalk.underline(id)}", "auth": "${chalk.underline(
					getClientSecret(parseInt(id, 10))!
				)}" }`
			);
		}
		res.status(200).write(id);
		res.end();
	});

	const router = createRouter(Auth, {});
	router.all('/key', (req, res) => {
		if (authenticate(req.params.key)) {
			res.cookie('key', genCookie(), {
				// Expires in quite a few years
				expires: new Date(2147483647000),
			});
			res.status(200).write('Success');
		} else {
			res.status(403).write('Access denied');
		}
		res.end();
	});
	router.use(app);
}
