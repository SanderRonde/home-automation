import * as express from 'express';
import { Token } from 'oauth2-server';

export function getAuth(res: express.Response): {
	token: Omit<Token, 'user'> & {
		user: string;
	};
} {
	return (
		res.locals as {
			oauth: {
				token: Omit<Token, 'user'> & {
					user: string;
				};
			};
		}
	).oauth;
}
