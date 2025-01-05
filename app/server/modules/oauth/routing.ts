import express = require('express');
import type { ResponseLike } from '../../lib/logging/response-logger';
import { authorizationServer } from './authorization';
import { CLIENT_FOLDER } from '../../lib/constants';
import { LogObj } from '../../lib/logging/lob-obj';
import { validateOAUthUsers } from './oauth-users';
import { debug } from '../../lib/logging/logger';
import { SettablePromise } from '../../lib/util';
import { createRouter } from '../../lib/api';
import type { ModuleConfig } from '..';
import { getEnv } from '../../lib/io';
import * as fs from 'fs-extra';
import * as path from 'path';
import { OAuth } from '..';

const oauthHTMLFile = new SettablePromise<string>();

async function sendToLoginPage(
	req: express.Request,
	res: ResponseLike,
	invalidReason?: string
) {
	if (!oauthHTMLFile.isSet) {
		oauthHTMLFile.set(
			await fs.readFile(
				path.join(CLIENT_FOLDER, 'oauth/oauth.html'),
				'utf8'
			)
		);
	}

	// Send back to a login page
	const previousParams = {
		...req.body,
		...req.params,
		...req.query,
	} as Record<string, string>;
	const params = [
		'client_id',
		'redirect_uri',
		'response_type',
		'scope',
		'response_mode',
		'state',
		'nonce',
	]
		.filter((p) => previousParams[p] !== undefined)
		.map((p) => `${p}=${encodeURIComponent(previousParams[p])}`);
	if (invalidReason) {
		params.push(`errorReason=${invalidReason}`);
	}

	res.status(200);
	res.redirect(`/oauth/login?${params.join('&')}`);
}

export async function initRouting({
	app,
}: ModuleConfig<typeof OAuth>): Promise<void> {
	const router = createRouter(OAuth, {});
	router.all(
		'/authorize',
		// @ts-ignore
		async (req, res, next) => {
			LogObj.fromRes(res).attachMessage('Authorizing OAuth');

			// Somehow Google sends a wrong URL so we have to fix it
			const query = req.query as {
				redirect_uri?: string;
			};
			if (query.redirect_uri) {
				query.redirect_uri = query.redirect_uri.replace(
					'https:/o',
					'https://o'
				);
			}
			const { username = '', password = '' } = {
				...req.body,
				...req.params,
			} as {
				username?: string;
				password?: string;
			};
			debug('OAuth', '/authorize', {
				...req.body,
				...req.params,
				...req.query,
			});

			const { valid, invalidReason } = validateOAUthUsers(
				username,
				password
			);
			if (!valid) {
				LogObj.fromRes(res).attachMessage(
					`Redirecting to login page, reason: ${
						invalidReason ?? 'no login supplied'
					}`
				);
				await sendToLoginPage(req, res, invalidReason);
				return;
			}

			LogObj.fromRes(res)
				.attachMessage('Login success')
				.attachMessage(`Username: ${username}`);
			return (await authorizationServer.value).authorize({
				authenticateHandler: {
					handle: () => username,
				},
			})(req, res, next);
		}
	);
	router.get('/login', async (_req, res) => {
		LogObj.fromRes(res).attachMessage('Logging in to auth');

		res.status(200);
		res.write(await oauthHTMLFile.value);
		res.end();
	});
	// @ts-ignore
	router.post(
		'/token',
		(_req, res, next) => {
			LogObj.fromRes(res).attachMessage('Refreshing token for OAuth');
			return next();
		},
		(await authorizationServer.value).token({})
	);
	if (getEnv('SECRET_OAUTH_TOKEN_URL_POSTFIX', false)) {
		router.post(
			`/token${getEnv('SECRET_OAUTH_TOKEN_URL_POSTFIX', true)}`,
			(_req, res, next) => {
				LogObj.fromRes(res).attachMessage('Refreshing token for OAuth');
				return next();
			},
			async (req, res, next) => {
				try {
					await (await authorizationServer.value).token({})(
						req,
						res,
						next
					);
				} catch (e) {
					console.log('threw error', e);
				}
			}
		);
	}
	router.use(app);
}
