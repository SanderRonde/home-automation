import type {
	RouterTypes,
	BunRequest,
	ServerWebSocket,
	DistributedOmit,
	Serve,
	WebSocketServeOptions,
} from 'bun';
import { checkAuth, getAuthUser } from './auth';
import { logActivity } from '../modules/logs';
import { LogObj } from './logging/lob-obj';
import type { z, ZodTypeAny } from 'zod';
import type { Server } from 'bun';

// Store for request bodies to allow logging after the handler completes
const requestBodyCache = new WeakMap<Request, unknown>();

/**
 * Cache a request body for later logging.
 * Should be called before the body is consumed.
 */
export function cacheRequestBody(req: Request, body: unknown): void {
	requestBodyCache.set(req, body);
}

/**
 * Get cached request body for logging.
 */
export function getCachedRequestBody(req: Request): unknown {
	return requestBodyCache.get(req);
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];

export function createServeOptions<
	T,
	R extends {
		[K in keyof R]:
			| false
			| BrandedResponse<unknown, false>
			| Promise<BrandedResponse<T, false>>
			| BrandedRouteHandler<K, unknown>
			| {
					[M in Bun.RouterTypes.HTTPMethod]?: BrandedRouteHandler<K, unknown>;
			  }
			| Bun.HTMLBundle
			| Bun.BunFile;
	},
>(
	routes: (DistributedOmit<Exclude<Serve<T>, WebSocketServeOptions<T>>, 'fetch'> & {
		routes: R;
		fetch?: (this: Server, request: Request, server: Server) => Response | Promise<Response>;
	})['routes'],
	auth: boolean | Record<string, boolean>,
	extraWebsocket?: ServeOptions<R>['websocket'],
	/**
	 * Module name for activity logging. If provided, route keys will be prefixed with /{moduleName}.
	 */
	moduleName?: string
): ServeOptions<R> {
	// Middleware factory that includes the route key for logging
	const createMiddleware = (routeKey: string) => {
		return (
			routeHandler:
				| BrandedRouteHandler<string, unknown>
				| RouterTypes.RouteHandlerWithWebSocketUpgrade<string>
		):
			| BrandedRouteHandler<string, unknown>
			| RouterTypes.RouteHandlerWithWebSocketUpgrade<string> => {
			return async (req: BunRequest, server: Server) => {
				LogObj.fromIncomingReq(req);

				try {
					// Check authentication if required
					const url = new URL(req.url);
					if (
						auth === true ||
						(typeof auth === 'object' && auth[url.pathname] !== false)
					) {
						const isAuthenticated = await checkAuth(req);
						if (!isAuthenticated) {
							// Check if this is an API request or a page request
							const acceptHeader = req.headers.get('accept') || '';
							const isApiRequest =
								acceptHeader.includes('application/json') ||
								url.pathname.startsWith('/api/') ||
								req.method !== 'GET';

							if (isApiRequest) {
								// Return 401 for API requests
								const unauthorizedRes = errorResponse('Unauthorized', 401);
								LogObj.logOutgoingResponse(req, unauthorizedRes, server);
								return unauthorizedRes;
							} else {
								// Redirect to login page for regular page requests
								const loginUrl = `/auth/login-page?redirect=${encodeURIComponent(url.pathname + url.search)}`;
								const redirectRes = Response.redirect(
									loginUrl,
									302
								) as BrandedResponse<unknown, false>;
								LogObj.logOutgoingResponse(req, redirectRes, server);
								return redirectRes;
							}
						}
					}

					const res = await routeHandler(req, server, {
						json: jsonResponse,
						error: errorResponse,
						text: textResponse,
					});
					if (res) {
						LogObj.logOutgoingResponse(req, res, server);

						// Log POST/DELETE requests to activity log (after successful response)
						if (
							(req.method === 'POST' || req.method === 'DELETE') &&
							res.status >= 200 &&
							res.status < 300
						) {
							// Get user info for logging
							const user = await getAuthUser(req);

							// Get cached body (set by withRequestBody) or null
							const body = getCachedRequestBody(req);

							// Extract params from the request
							const params =
								'params' in req && req.params
									? (req.params as Record<string, string>)
									: null;

							// Derive full route key from URL pathname
							// URL is like /device/scenes/abc123/trigger, routeKey is like /scenes/:sceneId/trigger
							// Extract module name from pathname (first segment)
							const url = new URL(req.url);
							const pathParts = url.pathname.split('/').filter(Boolean);
							const moduleNameFromPath = pathParts[0] || '';
							const fullRouteKey = moduleName
								? `/${moduleName}${routeKey}`
								: moduleNameFromPath
									? `/${moduleNameFromPath}${routeKey}`
									: routeKey;

							// Log asynchronously (don't block the response)
							void logActivity(
								req.method,
								fullRouteKey,
								params,
								body,
								user?.id ?? null,
								user?.username ?? null
							);
						}
					}
					return res;
				} catch (error) {
					// Log the error
					console.error('Error handling request:', error);

					// Return a 500 error response
					const errorRes = errorResponse(
						{
							error: 'Internal Server Error',
							message: error instanceof Error ? error.message : 'Unknown error',
						},
						500
					);
					LogObj.logOutgoingResponse(req, errorRes, server);
					return errorRes;
				}
			};
		};
	};

	const loggedRoutes: Record<string, unknown> = {};
	for (const key in routes) {
		const route = routes[key];
		const middleware = createMiddleware(key);
		if (typeof route === 'function') {
			loggedRoutes[key] = middleware(route);
		} else if (typeof route === 'object' && HTTP_METHODS.some((method) => method in route)) {
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
		websocket: extraWebsocket || undefined,
	};
}

export function withRequestBody<
	const S extends ZodTypeAny,
	const T,
	const R extends BrandedResponse<unknown, boolean> | Promise<BrandedResponse<unknown, boolean>>,
>(
	shape: S,
	handler: (
		body: z.output<S>,
		req: Omit<BunRequest<Extract<T, string>>, 'json'>,
		server: Server,
		response: BrandedRouteHandlerResponse
	) => R
): RouteBodyBrand<
	(
		req: BunRequest<Extract<T, string>>,
		server: Server,
		response: BrandedRouteHandlerResponse
	) => R,
	S
> {
	return (async (req, server, response) => {
		let json;
		try {
			json = await req.json();
		} catch {
			return response.error('Invalid JSON', 400);
		}
		const body = shape.safeParse(json);
		if (!body.success) {
			return response.error(body.error.message, 400);
		}
		// Cache the parsed body for activity logging
		cacheRequestBody(req, body.data);
		return handler(body.data, req, server, response);
	}) as RouteBodyBrand<
		(
			req: BunRequest<Extract<T, string>>,
			server: Server,
			response: BrandedRouteHandlerResponse
		) => R,
		S
	>;
}

export type RouteBodyBrand<T, B> = T & {
	__body: B;
};

export type BrandedResponse<T, E extends boolean> = Response & {
	__json: T;
	__isError: E;
};

export type BrandedRouteHandler<T, R> = (
	req: Omit<BunRequest<Extract<T, string>>, 'json'>,
	server: Server,
	response: BrandedRouteHandlerResponse
) => BrandedResponse<R, boolean> | Promise<BrandedResponse<R, boolean>>;

export type BrandedRouteHandlerResponse = {
	json: <const T>(data: T, init?: ResponseInit) => BrandedResponse<T, false>;
	error: <const T extends string | object>(
		message: T,
		statusCode: number
	) => BrandedResponse<T, true>;
	text: (message: string, statusCode: number) => BrandedResponse<string, false>;
};

export function untypedRequestJson(
	request: Omit<BunRequest<Extract<string, string>>, 'json'>
): Promise<unknown> {
	return (request as BunRequest).json();
}

export function staticResponse(response: Response): BrandedResponse<unknown, false> {
	return response as BrandedResponse<unknown, false>;
}

function jsonResponse<T>(data: T, init?: Omit<ResponseInit, 'status'>): BrandedResponse<T, false> {
	try {
		return Response.json(data, init) as BrandedResponse<T, false>;
	} catch (error) {
		console.error('Error creating JSON response:', error, 'json', data);
		return errorResponse('Internal Server Error', 500) as unknown as BrandedResponse<T, false>;
	}
}

function textResponse(message: string, statusCode: number): BrandedResponse<string, false> {
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
