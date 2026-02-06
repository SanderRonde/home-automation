import type { HomeDetectorRoutes } from '../../server/modules/home-detector/routing';
import type { NotificationRoutes } from '../../server/modules/notification/routing';
import type { TemperatureRoutes } from '../../server/modules/temperature/routing';
import type { HomeWizardRoutes } from '../../server/modules/homewizard/routing';
import type { BrandedResponse, RouteBodyBrand } from '../../server/lib/routes';
import type { WakelightRoutes } from '../../server/modules/wakelight/routing';
import type { DashboardRoutes } from '../../server/modules/dashboard/routing';
import type { LocationRoutes } from '../../server/modules/location/routing';
import type { WebhookRoutes } from '../../server/modules/webhook/routing';
import type { EwelinkRoutes } from '../../server/modules/ewelink/routing';
import type { LedArtRoutes } from '../../server/modules/led-art/routing';
import type { SystemRoutes } from '../../server/modules/system/routing';
import type { MatterRoutes } from '../../server/modules/matter/routing';
import type { DeviceRoutes } from '../../server/modules/device/routing';
import type { BackupRoutes } from '../../server/modules/backup/routing';
import type { KioskRoutes } from '../../server/modules/kiosk/routing';
import type { WledRoutes } from '../../server/modules/wled/routing';
import type { TuyaRoutes } from '../../server/modules/tuya/routing';
import type { LogsRoutes } from '../../server/modules/logs/routing';
import type { AuthRoutes } from '../../server/modules/auth/routing';
import type { BotRoutes } from '../../server/modules/bot/routing';
import type { AIRoutes } from '../../server/modules/ai/routing';
import type { RouterTypes } from 'bun';
import type z from 'zod';

// In-memory cache for API responses
interface CacheEntry {
	data: unknown;
	timestamp: number;
}

const responseCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedResponse(url: string): unknown {
	const entry = responseCache.get(url);
	if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
		return entry.data;
	}
	if (entry) {
		responseCache.delete(url);
	}
	return null;
}

function setCachedResponse(url: string, data: unknown): void {
	responseCache.set(url, {
		data,
		timestamp: Date.now(),
	});
}

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
	const url = `/${module}${replacePathParams(endpoint, pathParams)}`;

	// Try to fetch from network
	try {
		// eslint-disable-next-line no-restricted-globals
		const response = await fetch(url, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
			},
		});

		// Cache successful GET responses
		if (response.ok) {
			const clonedResponse = response.clone();
			clonedResponse
				.json()
				.then((data) => {
					setCachedResponse(url, data);
				})
				.catch(() => {
					// Ignore cache errors
				});
		}

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return response as any;
	} catch (error) {
		// Network error - try to return cached response
		const cached = getCachedResponse(url);
		if (cached !== null) {
			const mockResponse = new Response(JSON.stringify(cached), {
				status: 200,
				headers: {
					'Content-Type': 'application/json',
					'X-From-Cache': 'true',
				},
			});
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			return mockResponse as any;
		}

		// No cache available, rethrow
		throw error;
	}
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
	// Check if offline
	if (typeof navigator !== 'undefined' && !navigator.onLine) {
		const mockResponse = new Response(
			JSON.stringify({ error: 'Cannot perform this action while offline' }),
			{
				status: 503,
				headers: { 'Content-Type': 'application/json' },
			}
		);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return mockResponse as any;
	}

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

export async function apiDelete<
	M extends keyof RoutesForModules,
	E extends keyof RoutesForModules[M],
>(
	module: M,
	endpoint: Extract<E, string>,
	pathParams: RouterTypes.ExtractRouteParams<Extract<E, string>>
): Promise<
	Omit<Response, 'json' | 'ok'> &
		(
			| {
					ok: true;
					json: () => Promise<Exclude<ReturnTypeForApi<M, E, 'DELETE'>['ok'], string>>;
					text: () => Promise<Extract<ReturnTypeForApi<M, E, 'DELETE'>['ok'], string>>;
			  }
			| {
					ok: false;
					json: () => Promise<Exclude<ReturnTypeForApi<M, E, 'DELETE'>['error'], string>>;
					text: () => Promise<Extract<ReturnTypeForApi<M, E, 'DELETE'>['error'], string>>;
			  }
		)
> {
	// Check if offline
	if (typeof navigator !== 'undefined' && !navigator.onLine) {
		const mockResponse = new Response(
			JSON.stringify({ error: 'Cannot perform this action while offline' }),
			{
				status: 503,
				headers: { 'Content-Type': 'application/json' },
			}
		);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return mockResponse as any;
	}

	// eslint-disable-next-line no-restricted-globals
	return (await fetch(
		`/${module}${replacePathParams(endpoint, pathParams)}`,
		{
			method: 'DELETE',
			headers: {
				'Content-Type': 'application/json',
			},
		}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	)) as any;
}

export type RoutesForModules = {
	auth: AuthRoutes;
	backup: BackupRoutes;
	bot: BotRoutes;
	dashboard: DashboardRoutes;
	device: DeviceRoutes;
	kiosk: KioskRoutes;
	ewelink: EwelinkRoutes;
	logs: LogsRoutes;
	matter: MatterRoutes;
	tuya: TuyaRoutes;
	location: LocationRoutes;
	system: SystemRoutes;
	'led-art': LedArtRoutes;
	'home-detector': HomeDetectorRoutes;
	ai: AIRoutes;
	notification: NotificationRoutes;
	temperature: TemperatureRoutes;
	wakelight: WakelightRoutes;
	webhook: WebhookRoutes;
	wled: WledRoutes;
	homewizard: HomeWizardRoutes;
};

export type ReturnTypeForApi<
	M extends keyof RoutesForModules,
	endpoint extends keyof RoutesForModules[M],
	method extends 'GET' | 'POST' | 'DELETE',
> =
	RoutesForModules[M] extends Record<string, unknown>
		? {
				ok: _ReturnTypeForApi<RoutesForModules[M], endpoint, method, false>;
				error: _ReturnTypeForApi<RoutesForModules[M], endpoint, method, true>;
			}
		: never;

export type BodyTypeForApi<
	M extends keyof RoutesForModules,
	endpoint extends keyof RoutesForModules[M],
	method extends 'GET' | 'POST' | 'DELETE',
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
	method extends 'GET' | 'POST' | 'DELETE',
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
	method extends 'GET' | 'POST' | 'DELETE',
> =
	R[endpoint] extends BrandedResponse<unknown, boolean>
		? R[endpoint]
		: R[endpoint] extends (
					...args: unknown[]
			  ) => BrandedResponse<unknown, boolean> | Promise<BrandedResponse<unknown, boolean>>
			? Awaited<ReturnType<Extract<R[endpoint], CallableFunction>>>
			: R[endpoint] extends {
						[K in method]?: (
							...args: unknown[]
						) =>
							| BrandedResponse<unknown, boolean>
							| Promise<BrandedResponse<unknown, boolean>>;
				  }
				? Awaited<ReturnType<Extract<R[endpoint][method], CallableFunction>>>
				: never;
