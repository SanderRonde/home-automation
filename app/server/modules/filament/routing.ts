import { createServeOptions, withRequestBody } from '../../lib/routes';
import type { ServeOptions } from '../../lib/routes';
import type { FilamentAPI } from './api';
import type { ModuleConfig } from '..';
import * as z from 'zod';

const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

const createSpoolSchema = z.object({
	color: z.string().regex(hexColorRegex, 'Invalid hex color'),
	type: z.enum(['PLA', 'PETG', 'ABS', 'TPU', 'NYLON', 'ASA', 'OTHER']),
	specialProperties: z.string().optional(),
	maxWeight: z.number().positive('Max weight must be positive'),
	percentage: z.number().min(0).max(100).optional(),
	currentWeight: z.number().min(0).optional(),
});

const updateSpoolSchema = z.object({
	color: z.string().regex(hexColorRegex).optional(),
	type: z.enum(['PLA', 'PETG', 'ABS', 'TPU', 'NYLON', 'ASA', 'OTHER']).optional(),
	specialProperties: z.string().optional(),
	maxWeight: z.number().positive().optional(),
	percentage: z.number().min(0).max(100).optional(),
	currentWeight: z.number().min(0).optional(),
});

const assignSchema = z.object({
	filamentId: z.string().min(1),
});

function initRouting(api: FilamentAPI, _config: ModuleConfig) {
	return createServeOptions(
		{
			'/spools/list': {
				GET: (_req, _server, { json }) => {
					const spools = api.listSpools();
					return json({ spools });
				},
			},
			'/spools/create': {
				POST: withRequestBody(createSpoolSchema, async (body, _req, _server, { json }) => {
					const id = api.createSpool({
						color: body.color,
						type: body.type,
						specialProperties: body.specialProperties,
						maxWeight: body.maxWeight,
						percentage: body.percentage,
						currentWeight: body.currentWeight,
					});
					return json({ id, spool: api.getSpool(id) });
				}),
			},
			'/spools/:spoolId': {
				GET: (req, _server, { json, error }) => {
					const { spoolId } = req.params;
					const spool = api.getSpool(spoolId);
					if (!spool) {
						return error('Spool not found', 404);
					}
					return json({ spool });
				},
			},
			'/spools/:spoolId/update': {
				POST: withRequestBody(
					updateSpoolSchema,
					async (body, req, _server, { json, error }) => {
						const { spoolId } = req.params;
						const ok = api.updateSpool(spoolId, {
							...(body.color !== undefined && { color: body.color }),
							...(body.type !== undefined && { type: body.type }),
							...(body.specialProperties !== undefined && {
								specialProperties: body.specialProperties,
							}),
							...(body.maxWeight !== undefined && { maxWeight: body.maxWeight }),
							...(body.percentage !== undefined && { percentage: body.percentage }),
							...(body.currentWeight !== undefined && {
								currentWeight: body.currentWeight,
							}),
						});
						if (!ok) {
							return error('Spool not found', 404);
						}
						return json({ spool: api.getSpool(spoolId) });
					}
				),
			},
			'/spools/:spoolId/delete': {
				DELETE: (req, _server, { json, error }) => {
					const { spoolId } = req.params;
					const ok = api.deleteSpool(spoolId);
					if (!ok) {
						return error('Spool not found', 404);
					}
					return json({ success: true });
				},
			},
			'/assignments': {
				GET: (_req, _server, { json }) => {
					const assignments = api.getAssignments();
					return json({ assignments });
				},
			},
			'/assignments/:deviceId': {
				GET: (req, _server, { json }) => {
					const { deviceId } = req.params;
					const assignments = api.getAssignments(deviceId);
					return json({ assignments });
				},
			},
			'/assignments/:deviceId/:slotIndex/assign': {
				POST: withRequestBody(assignSchema, async (body, req, _server, { json, error }) => {
					const { deviceId, slotIndex } = req.params;
					const slot = parseInt(slotIndex, 10);
					if (Number.isNaN(slot) || slot < 0 || slot > 3) {
						return error('Slot index must be 0-3', 400);
					}
					const ok = api.assignFilament(deviceId, slot, body.filamentId);
					if (!ok) {
						return error('Spool not found or invalid', 404);
					}
					return json({
						success: true,
						assignment: api.getAssignment(deviceId, slot),
					});
				}),
			},
			'/assignments/:deviceId/:slotIndex/unassign': {
				POST: (req, _server, { json, error }) => {
					const { deviceId, slotIndex } = req.params;
					const slot = parseInt(slotIndex, 10);
					if (Number.isNaN(slot) || slot < 0 || slot > 3) {
						return error('Slot index must be 0-3', 400);
					}
					api.unassignFilament(deviceId, slot);
					return json({ success: true });
				},
			},
			'/history': {
				GET: async (req, _server, { json }) => {
					const url = new URL(req.url);
					const filamentId = url.searchParams.get('filamentId') ?? undefined;
					const limitParam = url.searchParams.get('limit');
					const limit = limitParam ? parseInt(limitParam, 10) : 100;
					const history = await api.getFilamentHistory(
						filamentId || undefined,
						Number.isNaN(limit) ? 100 : limit
					);
					return json({ history });
				},
			},
		},
		true,
		undefined,
		'filament'
	);
}

export { initRouting };

export type FilamentRoutes =
	ReturnType<typeof initRouting> extends ServeOptions<infer R> ? R : never;
