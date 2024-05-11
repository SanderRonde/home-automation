import { genId, getClientSecret } from '@server/modules/auth/client-secret';
import { attachMessage } from '@server/lib/logger';
import { createRouter } from '@server/lib/api';
import { authenticate } from '@server/modules/auth/secret';
import { genCookie } from '@server/modules/auth/cookie';
import { ModuleConfig } from '..';
import chalk from 'chalk';
import { Auth } from '.';

export function initRoutes({ app, config }: ModuleConfig<typeof Auth>): void {
	app.post('/authid', (_req, res) => {
		const id = String(genId());
		if (config.log.secrets) {
			attachMessage(
				res,
				`{"id": "${chalk.underline(id)}", "auth": "${chalk.underline(
					getClientSecret(parseInt(id, 10))
				)}" }`
			);
		}
		res.status(200).write(id);
		res.end();
	});

	const router = createRouter(Auth, {});
	router.all('/key/:key', (req, res) => {
		if (
			'key' in req.params &&
			authenticate((req.params as { key: string }).key)
		) {
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
