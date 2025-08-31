/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { createServeOptions } from '../../lib/routes';
import type { ServeOptions } from '../../lib/routes';
import type { Database } from '../../lib/db';
import type eWelink from 'ewelink-api-next';
import type { ModuleConfig } from '..';
import { getEnv } from '../../lib/io';

export function initRouting(
	{ db }: ModuleConfig,
	api: InstanceType<typeof eWelink.WebAPI> | null
): ServeOptions {
	return createServeOptions({
		'/oauth': () => {
			if (!api) {
				return new Response(null, { status: 500 });
			}

			return Response.redirect(
				api.oauth.createLoginUrl({
					redirectUrl: `${getEnv(
						'SECRET_EWELINK_REDIRECT_URL_BASE',
						true
					)}/ewelink/redirect_url`,
					state: 'XXX',
				})
			);
		},
		'/redirect_url': async (req) => {
			const queryParams = new URL(req.url).searchParams;
			const code = queryParams.get('code');
			if (!api) {
				return new Response(null, { status: 500 });
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
				return new Response(
					'Failed to get token! ' + (token.msg as string),
					{ status: 500 }
				);
			}

			db.setVal('accessToken', token.data.accessToken);
			db.setVal('refreshToken', token.data.refreshToken);
			db.setVal(
				'expiresAt',
				new Date().getTime() + 1000 * 60 * 60 * 24 * 29
			);
			api.at = token.data.accessToken;
			queueEwelinkTokenRefresh(api, db);

			return new Response(`Success!\nResponse:${JSON.stringify(token)}`, {
				status: 200,
			});
		},
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
