import * as express from 'express';
import { ModuleMeta } from '../modules/meta';

export function createAPIHandler<A extends Record<string, unknown>, R>(
	self:
		| {
				meta: ModuleMeta;
		  }
		| ModuleMeta,
	fn: (res: express.Response, args: A, source: string) => Promise<R> | void,
	getArgs: (req: express.Request) => A = (req) =>
		({
			...req.params,
			...req.body,
			...req.query,
			cookies: req.cookies,
		} as A)
) {
	return async (
		req: express.Request,
		res: express.Response
	): Promise<void> => {
		await fn(
			res,
			getArgs(req),
			`${'meta' in self ? self.meta.name : self.name}.API.${req.url}`
		);
	};
}

type _Remove<
	A extends {
		[key: string]: unknown;
	},
	B
> = {
	[K in keyof A]: A[K] extends B ? never : K;
}[keyof A];

type RemoveType<
	A extends {
		[key: string]: unknown;
	},
	B
> = {
	[K in _Remove<A, B>]: A[K];
};

type APIHandler = (
	res: express.Response,
	args: unknown,
	source: string
) => Promise<unknown> | void;

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
	self:
		| {
				meta: ModuleMeta;
		  }
		| ModuleMeta,
	apiHandler: A
): { use(app: express.Application, path?: string): void } & {
	[v in RouterVerb]: RouterFn<A>;
} {
	const toRegister: {
		verb: RouterVerb;
		subPath: string;
		handlers: express.Handler[];
	}[] = [];

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
				toRegister.push({
					verb,
					subPath,
					handlers: routeHandlers,
				});
			} else {
				toRegister.push({
					verb,
					subPath,
					handlers: [
						async (req: express.Request, res: express.Response) => {
							const fn = (
								apiHandler[fnHandle] as unknown as APIHandler
							).bind(apiHandler);
							const getArgsFn: (req: express.Request) => A =
								(getArgs as (req: express.Request) => A) ||
								((req) =>
									({
										...req.params,
										...req.body,
										...req.query,
										cookies: req.cookies,
									} as A));
							return await fn(
								res,
								getArgsFn(req),
								// TODO: change once all are converte
								`${
									'meta' in self ? self.meta.name : self.name
								}.API.${req.url}`
							);
						},
					],
				});
			}
		}) as unknown as RouterFn<A>;
	return {
		get: handlerCreator('get'),
		post: handlerCreator('post'),
		all: handlerCreator('all'),
		use(
			app,
			path = `/${('meta' in self
				? self.meta.name
				: self.name
			).toLowerCase()}`
		) {
			toRegister.forEach(({ verb, subPath, handlers }) => {
				app[verb](`${path}${subPath}`, ...handlers);
			});
		},
	};
}
