import type { TemperatureRoutes } from '../../server/modules/temperature/routing';
import type { BrandedResponse, RouteBodyBrand } from '../../server/lib/routes';
import type { DashboardRoutes } from '../../server/modules/dashboard/routing';
import type { WebhookRoutes } from '../../server/modules/webhook/routing';
import type { EwelinkRoutes } from '../../server/modules/ewelink/routing';
import type { DeviceRoutes } from '../../server/modules/device/routing';
import type { WledRoutes } from '../../server/modules/wled/routing';
import type { AuthRoutes } from '../../server/modules/auth/routing';
import type { BotRoutes } from '../../server/modules/bot/routing';
import type { RouterTypes } from 'bun';
import type z from 'zod';

function replacePathParams(endpoint: string, pathParams: RouterTypes.ExtractRouteParams<string>) {
	return endpoint.replace(
		/:(\w+)/g,
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		(_match, p1) => (pathParams as unknown as Record<string, string>)[p1]
	);
}

export async function apiGet<M extends keyof RoutesForModules, E extends keyof RoutesForModules[M]>(
	module: M,
	endpoint: Extract<E, string>,
	pathParams: RouterTypes.ExtractRouteParams<Extract<E, string>>
): Promise<
	Omit<Response, 'json' | 'ok'> &
		(
			| {
					ok: true;
					json: () => Promise<Exclude<ReturnTypeForApi<M, E, 'GET'>['ok'], string>>;
					text: () => Promise<Extract<ReturnTypeForApi<M, E, 'GET'>['ok'], string>>;
			  }
			| {
					ok: false;
					json: () => Promise<Exclude<ReturnTypeForApi<M, E, 'GET'>['error'], string>>;
					text: () => Promise<Extract<ReturnTypeForApi<M, E, 'GET'>['error'], string>>;
			  }
		)
> {
	// eslint-disable-next-line no-restricted-globals
	return (await fetch(
		`/${module}${replacePathParams(endpoint, pathParams)}`,
		{
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
			},
		}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	)) as any;
}

export async function apiPost<
	M extends keyof RoutesForModules,
	E extends keyof RoutesForModules[M],
>(
	module: M,
	endpoint: Extract<E, string>,
	pathParams: RouterTypes.ExtractRouteParams<Extract<E, string>>,
	body?: BodyTypeForApi<M, E, 'POST'>
): Promise<
	Omit<Response, 'json' | 'ok'> &
		(
			| {
					ok: true;
					json: () => Promise<Exclude<ReturnTypeForApi<M, E, 'POST'>['ok'], string>>;
					text: () => Promise<Extract<ReturnTypeForApi<M, E, 'POST'>['ok'], string>>;
			  }
			| {
					ok: false;
					json: () => Promise<Exclude<ReturnTypeForApi<M, E, 'POST'>['error'], string>>;
					text: () => Promise<Extract<ReturnTypeForApi<M, E, 'POST'>['error'], string>>;
			  }
		)
> {
	// eslint-disable-next-line no-restricted-globals
	return (await fetch(
		`/${module}${replacePathParams(endpoint, pathParams)}`,
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(body),
		}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	)) as any;
}

type RoutesForModules = {
	auth: AuthRoutes;
	bot: BotRoutes;
	dashboard: DashboardRoutes;
	device: DeviceRoutes;
	ewelink: EwelinkRoutes;
	temperature: TemperatureRoutes;
	webhook: WebhookRoutes;
	wled: WledRoutes;
};

export type ReturnTypeForApi<
	M extends keyof RoutesForModules,
	endpoint extends keyof RoutesForModules[M],
	method extends 'GET' | 'POST',
> = {
	ok: _ReturnTypeForApi<RoutesForModules[M], endpoint, method, false>;
	error: _ReturnTypeForApi<RoutesForModules[M], endpoint, method, true>;
};

export type BodyTypeForApi<
	M extends keyof RoutesForModules,
	endpoint extends keyof RoutesForModules[M],
	method extends 'GET' | 'POST',
> =
	RoutesForModules[M][endpoint] extends RouteBodyBrand<unknown, infer B extends z.ZodTypeAny>
		? z.input<B>
		: RoutesForModules[M][endpoint] extends {
					[K in method]?: RouteBodyBrand<unknown, infer B extends z.ZodTypeAny>;
			  }
			? z.input<B>
			: never;

type _ReturnTypeForApi<
	R extends Record<string, unknown>,
	endpoint extends keyof R,
	method extends 'GET' | 'POST',
	E extends boolean,
> =
	Extract<
		_GetBrandedResponse<R, endpoint, method>,
		BrandedResponse<unknown, E>
	> extends BrandedResponse<infer R, boolean>
		? R
		: never;

type _GetBrandedResponse<
	R extends Record<string, unknown>,
	endpoint extends keyof R,
	method extends 'GET' | 'POST',
> =
	R[endpoint] extends BrandedResponse<unknown, boolean>
		? R[endpoint]
		: R[endpoint] extends (
					...args: unknown[]
			  ) => BrandedResponse<unknown, boolean> | Promise<BrandedResponse<unknown, boolean>>
			? Awaited<ReturnType<R[endpoint]>>
			: R[endpoint] extends {
						[K in method]?: (
							...args: unknown[]
						) =>
							| BrandedResponse<unknown, boolean>
							| Promise<BrandedResponse<unknown, boolean>>;
				  }
				? Awaited<ReturnType<Extract<R[endpoint][method], CallableFunction>>>
				: never;
