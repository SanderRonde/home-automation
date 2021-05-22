import * as express from 'express';

export function createAPIHandler<A extends Record<string, any>, R>(
	self: {
		meta: {
			name: string;
		};
	},
	fn: (res: express.Response, args: A, source: string) => Promise<R> | void,
	getArgs: (req: express.Request) => A = (req) => ({
		...req.params,
		...req.body,
		...req.query,
		cookies: req.cookies,
	})
) {
	return async (req: express.Request, res: express.Response) => {
		await fn(res, getArgs(req), `${self.meta.name}.API.${req.url}`);
	};
}

type _Remove<
	A extends {
		[key: string]: any;
	},
	B
> = {
	[K in keyof A]: A[K] extends B ? never : K;
}[keyof A];

type RemoveType<
	A extends {
		[key: string]: any;
	},
	B
> = {
	[K in _Remove<A, B>]: A[K];
};

type APIHandler = (
	res: express.Response,
	args: any,
	source: string
) => Promise<any> | void;

type IsAPIHandler<F> = F extends APIHandler ? true : false;

type APIHandlers<A> = {
	// Reflective
	[K in keyof RemoveType<
		{
			[K2 in keyof A]: IsAPIHandler<A[K2]>;
		},
		false
	>]: A[K];
};

type RouterFn<A> = {
	(
		subPath: string,
		fnHandle: express.Handler,
		getArgs?: express.Handler,
		...handlers: express.Handler[]
	): express.Handler;
	(
		subPath: string,
		fnHandle: keyof APIHandlers<A>,
		getArgs?: (req: express.Request) => A
	): express.Handler;
	(
		subPath: string,
		fnHandle: keyof APIHandlers<A> | express.Handler,
		getArgs?: (req: express.Request) => A | express.Handler,
		...handlers: express.Handler[]
	): express.Handler;
};

type RouterVerb = 'get' | 'post' | 'all';

export function createRouter<A>(
	self: {
		meta: {
			name: string;
		};
	},
	apiHandler: A
): { use(app: express.Application, path?: string): void } & {
	[v in RouterVerb]: RouterFn<A>;
} {
	const router = express.Router();

	const handlerCreator: (verb: RouterVerb) => RouterFn<A> = (verb) =>
		((
			subPath: string,
			fnHandle: keyof APIHandlers<A> | express.Handler,
			getArgs?: (req: express.Request) => A | express.Handler,
			...handlers: express.Handler[]
		) => {
			if (typeof fnHandle === 'function') {
				const routeHandlers = (() => {
					const arr = [fnHandle];
					if (getArgs) {
						arr.push(getArgs);
					}
					return [...arr, ...handlers];
				})();
				return router[verb](subPath, ...routeHandlers);
			}
			return router[verb](
				subPath,
				async (req: express.Request, res: express.Response) => {
					const fn = (
						apiHandler[fnHandle] as unknown as APIHandler
					).bind(apiHandler);
					const getArgsFn: (req: express.Request) => A =
						(getArgs as (req: express.Request) => A) ||
						((req) => ({
							...req.params,
							...req.body,
							...req.query,
							cookies: req.cookies,
						}));
					return await fn(
						res,
						getArgsFn(req),
						`${self.meta.name}.API.${req.url}`
					);
				}
			);
		}) as unknown as RouterFn<A>;
	return {
		get: handlerCreator('get'),
		post: handlerCreator('post'),
		all: handlerCreator('all'),
		use(app, path = `/${self.meta.name.toLowerCase()}`) {
			app.use(path, router);
		},
	};
}
