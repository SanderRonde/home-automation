import { createDeduplicatedTypedWSPublish } from '../../lib/deduplicated-ws-publish';
import { createServeOptions, withRequestBody } from '../../lib/routes';
import type { ServeOptions } from '../../lib/routes';
import type { ModuleConfig } from '../modules';
import type { Detector } from './classes';
import type { HOME_STATE } from './types';
import * as z from 'zod';

export interface Host {
	name: string;
	ips: string[];
	lastSeen?: Date;
}

function _initRouting(detector: Detector, config: ModuleConfig) {
	// Create a deduplicated WebSocket publisher to avoid sending duplicate messages
	const wsPublish = createDeduplicatedTypedWSPublish<HomeDetectorWebsocketServerMessage>(
		config.wsPublish
	);

	// WebSocket updates
	detector.addListener(null, (_newState, _hostId, fullState) => {
		void wsPublish({
			type: 'state-change',
			fullState,
		});
	});

	return createServeOptions(
		{
			'/list': (_req, _server, { json }) => {
				const hosts = detector.listHosts();
				return json({ hosts });
			},
			'/create': withRequestBody(
				z.object({
					name: z.string(),
					ips: z.array(z.string()),
				}),
				(body, _req, _server, { json }) => {
					try {
						const name = detector.addHost(body.name, body.ips);
						return json({ success: true, name });
					} catch (error) {
						return json(
							{
								error:
									error instanceof Error
										? error.message
										: 'Failed to create host',
							},
							{ status: 400 }
						);
					}
				}
			),
			'/:name/update': withRequestBody(
				z.object({
					ips: z.array(z.string()),
				}),
				(body, req, _server, { json }) => {
					try {
						const success = detector.updateHost(req.params.name, body.ips);
						if (!success) {
							return json({ error: 'Host not found' }, { status: 404 });
						}
						return json({ success: true });
					} catch (error) {
						return json(
							{
								error:
									error instanceof Error
										? error.message
										: 'Failed to update host',
							},
							{ status: 400 }
						);
					}
				}
			),
			'/:name/delete': (req, _server, { json }) => {
				const success = detector.removeHost(req.params.name);
				if (!success) {
					return json({ error: 'Host not found' }, { status: 404 });
				}
				return json({ success: true });
			},
			'/door-sensors/list': (_req, _server, { json }) => {
				const doorSensorIds = detector.getDoorSensorIds();
				return json({ doorSensorIds });
			},
			'/door-sensors/update': withRequestBody(
				z.object({
					doorSensorIds: z.array(z.string()),
				}),
				(body, _req, _server, { json }) => {
					detector.setDoorSensorIds(body.doorSensorIds);
					return json({ success: true });
				}
			),
			'/movement-sensors/list': (_req, _server, { json }) => {
				const movementSensorIds = detector.getMovementSensorIds();
				return json({ movementSensorIds });
			},
			'/movement-sensors/update': withRequestBody(
				z.object({
					movementSensorIds: z.array(z.string()),
				}),
				(body, _req, _server, { json }) => {
					detector.setMovementSensorIds(body.movementSensorIds);
					return json({ success: true });
				}
			),
			'/events/history': async (req, _server, { json }) => {
				const url = new URL(req.url);
				const limitParam = url.searchParams.get('limit');
				const limit = limitParam ? parseInt(limitParam, 10) : 100;
				// Cap at 10000 events max for safety
				const safeLimit = Math.min(Math.max(limit, 1), 10000);
				const events = await detector.getEventHistory(safeLimit);
				return json({ events });
			},
			'/check-all': async (_req, _server, { json }) => {
				const results = await detector.checkAllHosts();
				return json({ results });
			},
		},
		true,
		{
			open: (ws) => {
				ws.send(
					JSON.stringify({
						type: 'state-change',
						fullState: detector.getAll(),
					} satisfies HomeDetectorWebsocketServerMessage)
				);
			},
		}
	);
}

export interface HomeDetectorWebsocketServerMessage {
	type: 'state-change';
	fullState: Record<string, HOME_STATE>;
}

export const initRouting = _initRouting as (
	detector: Detector,
	config: ModuleConfig
) => ServeOptions<unknown>;

export type HomeDetectorRoutes =
	ReturnType<typeof _initRouting> extends ServeOptions<infer R> ? R : never;
