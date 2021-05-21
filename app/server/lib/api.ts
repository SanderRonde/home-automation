import * as express from 'express';
import { ResponseLike } from '../modules/multi';

export function createAPIHandler<A extends Record<string, any>, R>(
	self: {
		meta: {
			name: string;
		};
	},
	fn: (res: ResponseLike, args: A, source: string) => Promise<R>|void,
	getArgs: (req: express.Request) => A = req => ({
		...req.params,
		...req.body,
		...req.query,
		cookies: req.cookies
	})
) {
	return async (req: express.Request, res: ResponseLike) => {
		await fn(res, getArgs(req), `${self.meta.name}.API.${req.url}`);
	};
}
