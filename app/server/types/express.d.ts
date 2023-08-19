import * as express from 'express';

export interface AsyncRequestHandler<
	P = import('express').ParamsDictionary,
	ResBody = any,
	ReqBody = any,
	ReqQuery = ParsedQs,
	Locals extends Record<string, any> = Record<string, any>
> {
	// tslint:disable-next-line callable-types (This is extended from and can't extend from a type alias in ts<2.2)
	(
		req: import('express').Request<P, ResBody, ReqBody, ReqQuery, Locals>,
		res: import('express').Response<ResBody, Locals>,
		next: import('express').NextFunction
	): void | Promise<void>;
}

export interface AsyncRouterMatcher<
	T,
	Method extends
		| 'all'
		| 'get'
		| 'post'
		| 'put'
		| 'delete'
		| 'patch'
		| 'options'
		| 'head' = any
> {
	<
		P = import('express').ParamsDictionary,
		ResBody = any,
		ReqBody = any,
		ReqQuery = import('express').ParsedQs,
		Locals extends Record<string, any> = Record<string, any>
	>(
		path: PathParams,
		// tslint:disable-next-line no-unnecessary-generics (This generic is meant to be passed explicitly.)
		...handlers: Array<
			AsyncRequestHandler<P, ResBody, ReqBody, ReqQuery, Locals>
		>
	): T;
	<
		P = import('express').ParamsDictionary,
		ResBody = any,
		ReqBody = any,
		ReqQuery = import('express').ParsedQs,
		Locals extends Record<string, any> = Record<string, any>
	>(
		path: PathParams,
		// tslint:disable-next-line no-unnecessary-generics (This generic is meant to be passed explicitly.)
		...handlers: Array<
			import('express').RequestHandlerParams<
				P,
				ResBody,
				ReqBody,
				ReqQuery,
				Locals
			>
		>
	): T;
	(path: PathParams, subApplication: Application): T;
}

export interface AsyncExpressApplication extends express.Application {
	post: AsyncRouterMatcher<this, 'post'>;
	get: AsyncRouterMatcher<this, 'get'>;
	all: AsyncRouterMatcher<this, 'all'>;
}
