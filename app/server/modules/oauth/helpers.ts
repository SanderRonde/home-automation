import type { Token } from 'oauth2-server';
import type * as express from 'express';

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
