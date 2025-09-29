import type {
	RouterTypes,
	BunRequest,
	ServerWebSocket,
	DistributedOmit,
	Serve,
	WebSocketServeOptions,
} from 'bun';
import { LogObj } from './logging/lob-obj';
import type { Server } from 'bun';

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
	R extends {
		[K in keyof R]:
			| false
			| BrandedResponse<unknown, false>
			| Promise<BrandedResponse<T, false>>
			| BrandedRouteHandler<K, unknown>
			| {
					[M in Bun.RouterTypes.HTTPMethod]?: BrandedRouteHandler<
						K,
						unknown
					>;
			  }
			| Bun.HTMLBundle
			| Bun.BunFile;
	},
>(
	routes: (DistributedOmit<
		Exclude<Serve<T>, WebSocketServeOptions<T>>,
		'fetch'
	> & {
		routes: R;
		fetch?: (
			this: Server,
			request: Request,
			server: Server
		) => Response | Promise<Response>;
	})['routes'],
	websocket?: ServeOptions<R>['websocket']
): ServeOptions<R> {
	const middleware = (
		routeHandler:
			| BrandedRouteHandler<string, unknown>
			| RouterTypes.RouteHandlerWithWebSocketUpgrade<string>
	):
		| BrandedRouteHandler<string, unknown>
		| RouterTypes.RouteHandlerWithWebSocketUpgrade<string> => {
		return async (req: BunRequest, server: Server) => {
			LogObj.fromIncomingReq(req);
			const res = await routeHandler(req, server, {
				json: jsonResponse,
				error: errorResponse,
				text: textResponse,
			});
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
		routes: loggedRoutes as ServeOptions<R>['routes'],
		websocket,
	};
}

export type BrandedResponse<T, E extends boolean> = Response & {
	__json: T;
	__isError: E;
};

export type BrandedRouteHandler<T, R> = (
	req: BunRequest<Extract<T, string>>,
	server: Server,
	response: {
		json: <const T>(
			data: T,
			init?: ResponseInit
		) => BrandedResponse<T, false>;
		error: <const T extends string | object>(
			message: T,
			statusCode: number
		) => BrandedResponse<T, true>;
		text: (
			message: string,
			statusCode: number
		) => BrandedResponse<string, false>;
	}
) => BrandedResponse<R, boolean> | Promise<BrandedResponse<R, boolean>>;

export function staticResponse(
	response: Response
): BrandedResponse<unknown, false> {
	return response as BrandedResponse<unknown, false>;
}

function jsonResponse<T>(
	data: T,
	init?: Omit<ResponseInit, 'status'>
): BrandedResponse<T, false> {
	return Response.json(data, init) as BrandedResponse<T, false>;
}

function textResponse(
	message: string,
	statusCode: number
): BrandedResponse<string, false> {
	return new Response(message, {
		status: statusCode,
	}) as BrandedResponse<string, false>;
}

function errorResponse<T extends string | object>(
	message: T,
	statusCode: number
): BrandedResponse<T, true> {
	if (typeof message === 'object') {
		return Response.json(message, {
			status: statusCode,
		}) as BrandedResponse<T, true>;
	}
	return new Response(message, {
		status: statusCode,
	}) as BrandedResponse<T, true>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type ServeOptions<_B> = {
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
