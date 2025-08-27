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
			LogObj.logOutgoingResponse(req, res!);
			return res;
		};
	};

	const loggedRoutes: Record<string, unknown> = {};
	for (const key in routes) {
		const route = routes[key];
		if (typeof route === 'function') {
			// All HTTP methods
			loggedRoutes[key] = middleware(route);
		} else {
			loggedRoutes[key] = Object.fromEntries(
				Object.entries(route).map(([httpMethod, handler]) => [
					httpMethod,
					middleware(handler),
				])
			);
		}
	}
	return loggedRoutes as Routes;
}

export type Routes = Record<string, RouterTypes.RouteValue<string>>;
