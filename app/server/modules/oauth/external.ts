import { createExternalClass } from '../../lib/external';
import { authorizationServer } from './authorization';
import { Token } from 'oauth2-server';
import * as express from 'express';

export class ExternalHandler extends createExternalClass(true) {
	public getAuthenticateMiddleware(): Promise<
		(
			request: express.Request,
			response: express.Response,
			next: express.NextFunction
		) => Promise<Token>
	> {
		return this.runRequest(async () => {
			return (await authorizationServer.value).authenticate();
		});
	}
}
