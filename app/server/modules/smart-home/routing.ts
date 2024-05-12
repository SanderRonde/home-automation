import {
	googleSync,
	googleQuery,
	googleExecute,
	googleDisconnect,
} from './state/google';
import { createSamsungSchemaHandler } from './state/samsung';
import { createLogObjWithName } from '../../lib/logger';
import { attachTimerToReq } from '../../lib/timer';
import { attachMessage } from '../../lib/logger';
import { smarthome } from 'actions-on-google';
import { createRouter } from '../../lib/api';
import { ModuleConfig, SmartHome } from '..';
import { getEnv } from '../../lib/io';
import * as express from 'express';

export async function initRouting({
	app,
}: ModuleConfig<typeof SmartHome>): Promise<void> {
	const smartHomeApp = smarthome({});

	smartHomeApp.onSync(googleSync);
	smartHomeApp.onQuery(googleQuery);
	smartHomeApp.onExecute(googleExecute);
	smartHomeApp.onDisconnect(googleDisconnect);

	const router = createRouter(SmartHome, {});
	router.all(
		'/google',
		(req, res, next) => {
			const intent = (
				req.body as {
					inputs: {
						intent: string;
					}[];
				}
			).inputs[0].intent;
			attachMessage(res, `Intent: ${intent}`);
			attachTimerToReq(res);
			return next();
		},
		// @ts-ignore
		await new (await SmartHome.modules).oauth.External(
			createLogObjWithName('SMART_HOME.ROUTING_INIT')
		).getAuthenticateMiddleware(),
		smartHomeApp
	);

	const handler = createSamsungSchemaHandler();
	if (handler) {
		router.all('/samsung', (req, res) =>
			handler.handleHttpCallback(req, res)
		);
		if (getEnv('SECRET_SAMSUNG_URL_POSTFIX', false)) {
			router.all(
				`/samsung${getEnv('SECRET_SAMSUNG_URL_POSTFIX', true)}`,
				(req, res) => {
					attachTimerToReq(res);
					handler.handleHttpCallback(
						{
							body: new JSONAbleBody(req.body, res),
						} as import('express').Request,
						res
					);
				}
			);
		}
	}
	router.use(app, '/actions');
}

class JSONAbleBody {
	public get headers() {
		return this.body.headers;
	}

	public get authentication() {
		return this.body.authentication;
	}

	public get devices() {
		return this.body.devices;
	}

	public get callbackAuthentication() {
		return this.body.callbackAuthentication;
	}

	public get callbackUrls() {
		return this.body.callbackUrls;
	}

	public constructor(
		public body: Record<string, unknown>,
		public res: express.Response
	) {}

	public toJSON() {
		return this.body;
	}
}
