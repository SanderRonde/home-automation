import type { ServeFunctionOptions, RouterTypes, BunRequest } from 'bun';
import { LogObj } from './logging/lob-obj';
import type { Server } from 'bun';

export function createRoutes<
	T,
	R extends { [K in keyof R]: RouterTypes.RouteValue<K & string> },
>(routes: ServeFunctionOptions<T, R>['routes']): Routes {
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
			// All HTTP methods
			loggedRoutes[key] = middleware(route);
		} else if (route instanceof Response) {
			// Sucks that we're not logging these...
			loggedRoutes[key] = route;
		} else {
			loggedRoutes[key] = Object.fromEntries(
				Object.entries(route).map(([httpMethod, handler]) => [
					httpMethod,
					middleware(handler),
				])
			);
		}

		if (key.endsWith('/')) {
			// Don't force-require trailing slashes
			loggedRoutes[key.slice(0, -1)] = loggedRoutes[key];
		}
	}
	return loggedRoutes as Routes;
}

export type Routes = Record<string, RouterTypes.RouteValue<string>>;
