import type {
	ServeFunctionOptions,
	RouterTypes,
	BunRequest,
	ServerWebSocket,
} from 'bun';
import { LogObj } from './logging/lob-obj';
import type { Server } from 'bun';
import { TypedJsonResponse } from './typed-routes';

const HTTP_METHODS = [
	'GET',
	'POST',
	'PUT',
	'DELETE',
	'PATCH',
	'OPTIONS',
	'HEAD',
];

export function createServeOptions<
	T,
	R extends { [K in keyof R]: Exclude<RouterTypes.RouteValue<K & string>, Response> | TypedJsonResponse<unknown> },
>(
	routes: ServeFunctionOptions<T, R>['routes'],
	websocket?: ServeOptions['websocket']
): ServeOptions {
	const middleware = (
		routeHandler:
			| RouterTypes.RouteHandler<string>
			| RouterTypes.RouteHandlerWithWebSocketUpgrade<string>
	):
		| RouterTypes.RouteHandler<string>
		| RouterTypes.RouteHandlerWithWebSocketUpgrade<string> => {
		return async (req: BunRequest, server: Server) => {
			LogObj.fromIncomingReq(req);
			const res = await routeHandler(req, server);
			if (res) {
				LogObj.logOutgoingResponse(req, res, server);
			}
			return res;
		};
	};

	const loggedRoutes: Record<string, unknown> = {};
	for (const key in routes) {
		const route = routes[key];
		if (typeof route === 'function') {
			loggedRoutes[key] = middleware(route);
		} else if (
			typeof route === 'object' &&
			HTTP_METHODS.some((method) => method in route)
		) {
			// All HTTP methods
			loggedRoutes[key] = Object.fromEntries(
				Object.entries(route).map(([httpMethod, handler]) => [
					httpMethod,
					middleware(handler),
				])
			);
		} else {
			// Sucks that we're not logging these...
			loggedRoutes[key] = route;
		}

		if (key.endsWith('/')) {
			// Don't force-require trailing slashes
			loggedRoutes[key.slice(0, -1)] = loggedRoutes[key];
		}
	}
	return {
		routes: loggedRoutes as ServeOptions['routes'],
		websocket,
	};
}

export type ServeOptions = {
	routes?: Record<string, RouterTypes.RouteValue<string>>;
	websocket?: {
		open?: (
			ws: ServerWebSocket<{ route: string; moduleName: string }>,
			server: Server
		) => void | Promise<void>;
		message?: (
			ws: ServerWebSocket<{ route: string; moduleName: string }>,
			message: string | Buffer,
			server: Server
		) => void | Promise<void>;
		close?: (
			ws: ServerWebSocket<{ route: string; moduleName: string }>,
			code: number,
			reason: string,
			server: Server
		) => void | Promise<void>;
	};
};
