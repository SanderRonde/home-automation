/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { createServeOptions, staticResponse } from '../../lib/routes';
import type { ServeOptions } from '../../lib/routes';
import type { Database } from '../../lib/db';
import type eWelink from 'ewelink-api-next';
import type { ModuleConfig } from '..';
import { getEnv } from '../../lib/io';
import type { EWelinkDB } from '.';

function _initRouting({ db }: ModuleConfig, api: InstanceType<typeof eWelink.WebAPI> | null) {
	return createServeOptions(
		{
			'/oauth': (_req, _server, { error }) => {
				if (!api) {
					return error('No API', 500);
				}

				return staticResponse(
					Response.redirect(
						api.oauth.createLoginUrl({
							redirectUrl: `${getEnv('SECRET_EWELINK_REDIRECT_URL_BASE', true)}/ewelink/redirect_url`,
							state: 'XXX',
						})
					)
				);
			},
			'/redirect_url': async (req, _server, { error, text }) => {
				const queryParams = new URL(req.url).searchParams;
				const code = queryParams.get('code');
				if (!api) {
					return error('No API', 500);
				}

				const token = await api.oauth.getToken({
					code: code as string,
					redirectUrl: `${getEnv('SECRET_EWELINK_REDIRECT_URL_BASE', true)}/ewelink/redirect_url`,
					region: getEnv('SECRET_EWELINK_REGION', true),
				});
				if (!token.data) {
					return error('Failed to get token! ' + (token.msg as string), 500);
				}

				db.update((old) => ({
					...old,
					accessToken: token.data.accessToken,
					refreshToken: token.data.refreshToken,
					expiresAt: new Date().getTime() + 1000 * 60 * 60 * 24 * 29,
				}));
				api.at = token.data.accessToken;
				queueEwelinkTokenRefresh(api, db);

				return text(`Success!\nResponse:${JSON.stringify(token)}`, 200);
			},
		},
		true
	);
}

export const initRouting = _initRouting as (
	config: ModuleConfig,
	api: InstanceType<typeof eWelink.WebAPI> | null
) => ServeOptions<unknown>;

export function queueEwelinkTokenRefresh(
	// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
	api: InstanceType<typeof eWelink.WebAPI> | null,
	db: Database<EWelinkDB>
): void {
	if (!api) {
		return;
	}

	const refreshToken = db.current().refreshToken;
	const expiresAt = db.current().expiresAt;
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

		db.set({
			accessToken: data.at,
			refreshToken: data.rt,
			expiresAt: new Date().getTime() + 1000 * 60 * 60 * 24 * 29,
		});

		queueEwelinkTokenRefresh(api, db);
	};

	const now = Date.now();
	const timeToRefresh = expiresAt - now - 1000 * 60 * 60 * 24 * 7;
	if (timeToRefresh > 0) {
		setTimeout(refresh, timeToRefresh);
	}
}

export type EwelinkRoutes =
	ReturnType<typeof _initRouting> extends ServeOptions<infer R> ? R : never;
