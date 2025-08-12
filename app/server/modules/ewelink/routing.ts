/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import type { EWeLink, ModuleConfig } from '..';
import type { Database } from '../../lib/db';
import type eWelink from 'ewelink-api-next';
import { getEnv } from '../../lib/io';

export function initRouting(
	{ app, db }: ModuleConfig<typeof EWeLink>,
	// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
	api: InstanceType<typeof eWelink.WebAPI> | null
): void {
	app.get('/ewelink/oauth/', (_, res) => {
		if (!api) {
			res.status(500).end();
			return;
		}

		res.redirect(
			api.oauth.createLoginUrl({
				redirectUrl: `${getEnv(
					'SECRET_EWELINK_REDIRECT_URL_BASE',
					true
				)}/ewelink/redirect_url`,
				state: 'XXX',
			})
		);
	});
	app.get('/ewelink/redirect_url', async (req, res) => {
		const code = req.query['code'];
		if (!api) {
			res.status(500).end();
			return;
		}

		const token = await api.oauth.getToken({
			code: code as string,
			redirectUrl: `${getEnv(
				'SECRET_EWELINK_REDIRECT_URL_BASE',
				true
			)}/ewelink/redirect_url`,
			region: getEnv('SECRET_EWELINK_REGION', true),
		});
		if (!token.data) {
			res.write('Failed to get token! ' + (token.msg as string));
			res.end();
			return;
		}

		db.setVal('accessToken', token.data.accessToken);
		db.setVal('refreshToken', token.data.refreshToken);
		db.setVal('expiresAt', new Date().getTime() + 1000 * 60 * 60 * 24 * 29);
		api.at = token.data.accessToken;
		queueEwelinkTokenRefresh(api, db);

		res.write(
			`Success! Please restart the server\nResponse:${JSON.stringify(
				token
			)}`
		);
		res.end();
	});
}

export function queueEwelinkTokenRefresh(
	// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
	api: InstanceType<typeof eWelink.WebAPI> | null,
	db: Database
): void {
	if (!api) {
		return;
	}

	const refreshToken = db.get<string>('refreshToken');
	const expiresAt = db.get<number>('expiresAt');
	if (!refreshToken || !expiresAt) {
		return;
	}
	const refresh = async () => {
		const { data } = (await api.user.refreshToken({
			rt: refreshToken,
		})) as {
			data: {
				at: string;
				rt: string;
			};
		};
		api.at = data.at;

		db.setVal('accessToken', data.at);
		db.setVal('refreshToken', data.rt);
		db.setVal('expiresAt', new Date().getTime() + 1000 * 60 * 60 * 24 * 29);

		queueEwelinkTokenRefresh(api, db);
	};

	const now = Date.now();
	const timeToRefresh = expiresAt - now - 1000 * 60 * 60 * 24 * 7;
	if (timeToRefresh > 0) {
		setTimeout(refresh, timeToRefresh);
	}
}
