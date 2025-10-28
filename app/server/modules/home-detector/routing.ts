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
	// WebSocket updates
	detector.addListener(null, (_newState, _hostId, fullState) => {
		void config.wsPublish(
			JSON.stringify({
				type: 'state-change',
				fullState,
			} satisfies HomeDetectorWebsocketServerMessage)
		);
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
			'/events/history': async (_req, _server, { json }) => {
				const events = await detector.getEventHistory(100);
				return json({ events });
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
