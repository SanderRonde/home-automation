import { createServeOptions, withRequestBody, type ServeOptions } from '../../lib/routes';
import type { ModuleConfig } from '..';
import type { MeasurementSummary, MeasurementSource } from './types';
import { z } from 'zod';
import type { HistoryEntry } from './types';

interface RoutingModuleApi {
	getStatus(): {
		configured: boolean;
		ip: string;
		hasToken: boolean;
		lastMeasurement: MeasurementSummary | null;
		instructions: string[];
		docsUrl: string;
		poller: {
			nextRunAt: number | null;
			intervalMs: number;
			failureCount: number;
			lastError: string | null;
			active: boolean;
		};
	};
	updateConfig(ip: string, apiToken: string): Promise<void>;
	getLatestMeasurementSummary(): Promise<MeasurementSummary>;
	getMeasurementHistory(
		timeframeMs: number
	): Promise<{ mode: MeasurementSource; history: HistoryEntry[]; latest: MeasurementSummary }>;
}

export const initRouting = (
	_config: ModuleConfig,
	module: RoutingModuleApi
): ServeOptions<HomeWizardRoutes> => {
	return createServeOptions(
		{
			'/status': (_req, _server, { json }) => {
				return json(module.getStatus());
			},
			'/config': withRequestBody(
				z.object({
					ip: z.string().min(3),
					apiToken: z.string().min(10),
				}),
				async (body, _req, _server, { json, error }) => {
					try {
						await module.updateConfig(body.ip, body.apiToken);
						return json({ success: true });
					} catch (err) {
						return error(
							{
								error: 'Failed to update HomeWizard config',
								message: err instanceof Error ? err.message : 'Unknown error',
							},
							500
						);
					}
				}
			),
			'/measurement/latest': async (_req, _server, { json }) => {
				const summary = await module.getLatestMeasurementSummary();
				return json(summary);
			},
			'/measurement/history/:timeframe': async (req, _server, { json, error }) => {
				const timeframe = Number(req.params.timeframe);
				if (!Number.isFinite(timeframe) || timeframe <= 0) {
					return error('Invalid timeframe', 400);
				}
				const history = await module.getMeasurementHistory(timeframe);
				return json(history);
			},
		},
		true
	);
};

export type HomeWizardRoutes =
	ReturnType<typeof initRouting> extends ServeOptions<infer R> ? R : never;
