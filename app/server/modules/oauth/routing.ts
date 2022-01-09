import express = require('express');
import {
	ResponseLike,
	attachSourcedMessage,
	attachMessage,
} from '../../lib/logger';
import { authorizationServer } from './authorization';
import { CLIENT_FOLDER } from '../../lib/constants';
import { validateOAUthUsers } from './oauth-users';
import { SettablePromise } from '../../lib/util';
import { createRouter } from '../../lib/api';
import { ModuleConfig, OAuth } from '..';
import { debug } from '../../lib/logger';
import * as fs from 'fs-extra';
import * as path from 'path';

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

export async function initRouting({ app }: ModuleConfig): Promise<void> {
	const router = createRouter(OAuth, {});
	router.all(
		'/authorize',
		// @ts-ignore
		async (req, res, next) => {
			attachSourcedMessage(
				res,
				'OAUTH.API',
				await OAuth.explainHook,
				'Authorizing OAuth'
			);

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
				await sendToLoginPage(req, res, invalidReason);
				return;
			}

			attachMessage(
				attachMessage(res, 'Login success'),
				`Username: ${username}`
			);
			return (await authorizationServer.value).authorize({
				authenticateHandler: {
					handle: () => username,
				},
			})(req, res, next);
		},
		(await authorizationServer.value).authorize()
	);
	router.get('/login', async (_req, res) => {
		attachSourcedMessage(
			res,
			'OAUTH.API',
			await OAuth.explainHook,
			'Logging in to auth'
		);

		res.status(200);
		res.write(await oauthHTMLFile.value);
		res.end();
	});
	// @ts-ignore
	router.post(
		'/token',
		async (_req, res, next) => {
			attachSourcedMessage(
				res,
				'OAUTH.API',
				await OAuth.explainHook,
				'Refreshing token for OAuth'
			);
			return next();
		},
		(await authorizationServer.value).token({})
	);
	router.use(app);
}
