/**
 * Action describers - functions that convert raw log data to human-readable descriptions.
 * Each describer takes (params, body) and returns a description string.
 *
 * Benefits:
 * - Descriptions can be improved/changed and apply retroactively to all logs
 * - Raw data preserved for debugging and detailed inspection
 * - Describers can be made smarter over time (e.g., resolve device IDs to names)
 */

import type { BodyTypeForApi, RoutesForModules } from '../../../client/lib/fetch';

export type LogDescription =
	| {
			type: 'text';
			text: string;
	  }
	| {
			type: 'devices';
			deviceIds: string[];
	  }
	| {
			type: 'color';
			color: {
				hue: number;
				saturation: number;
				value: number;
			};
	  };

function createDescriber<
	M extends keyof RoutesForModules,
	endpoint extends Extract<keyof RoutesForModules[M], string>,
	method extends 'GET' | 'POST' | 'DELETE',
>(
	module: M,
	endpoint: endpoint,
	method: method,
	describer: (body: BodyTypeForApi<M, endpoint, method>) => LogDescription[] | null
) {
	return {
		[`${method} /${module}${endpoint}`]: describer,
	};
}

const describers: Record<string, (body: unknown) => LogDescription[] | null> = {
	// ===== Device Module =====

	// Device management
	...createDescriber('device', '/updateName', 'POST', (body) => {
		return [{ type: 'text', text: `Renamed device to "${body.name}"` }];
	}),
	...createDescriber('device', '/updateRoom', 'POST', (body) => {
		const text = body.room ? `Moved device to room "${body.room}"` : 'Removed device from room';
		return [{ type: 'text', text }];
	}),
	...createDescriber('device', '/updatePosition', 'POST', () => {
		return [{ type: 'text', text: 'Updated device position' }];
	}),

	// Room management
	...createDescriber('device', '/rooms/updatePolygon', 'POST', (body) => {
		return [{ type: 'text', text: `Updated polygon for room "${body.roomName}"` }];
	}),
	...createDescriber('device', '/layout/save', 'POST', () => {
		return [{ type: 'text', text: 'Saved house layout' }];
	}),

	// Device cluster controls
	...createDescriber('device', '/cluster/OnOff', 'POST', (body) => {
		const action = body.isOn === true ? 'Turned on' : 'Turned off';
		return [
			{ type: 'text', text: action },
			{
				type: 'devices',
				deviceIds: body.deviceIds,
			},
		];
	}),
	...createDescriber('temperature', '/report/:name/:temp', 'POST', () => {
		return null;
	}),
	...createDescriber('device', '/cluster/WindowCovering', 'POST', (body) => {
		return [
			{
				type: 'text',
				text: `Set window covering to ${body.targetPositionLiftPercentage}%`,
			},
			{
				type: 'devices',
				deviceIds: body.deviceIds,
			},
		];
	}),
	...createDescriber('device', '/cluster/ColorControl', 'POST', (body) => {
		if ('colorTemperature' in body && body.colorTemperature !== undefined) {
			return [
				{
					type: 'text',
					text: `Set color temperature to ${body.colorTemperature}K`,
				},
				{
					type: 'devices',
					deviceIds: body.deviceIds,
				},
			];
		}
		if ('hue' in body && 'saturation' in body) {
			return [
				{ type: 'text', text: 'Changed light color' },
				{
					type: 'devices',
					deviceIds: body.deviceIds,
				},
				{
					type: 'color',
					color: {
						hue: body.hue,
						saturation: body.saturation,
						value: body.value ?? 100,
					},
				},
			];
		}
		return [
			{ type: 'text', text: 'Controlled color' },
			{
				type: 'devices',
				deviceIds: body.deviceIds,
			},
		];
	}),
	...createDescriber('device', '/cluster/LevelControl', 'POST', (body) => {
		return [
			{
				type: 'text',
				text: `Set brightness to ${body.level}%`,
			},
			{
				type: 'devices',
				deviceIds: body.deviceIds,
			},
		];
	}),
	...createDescriber('device', '/cluster/Actions', 'POST', (body) => {
		return [
			{
				type: 'text',
				text: `Triggered action ${body.actionId}`,
			},
			{
				type: 'devices',
				deviceIds: body.deviceIds,
			},
		];
	}),
	...createDescriber('device', '/cluster/Thermostat', 'POST', (body) => {
		if (body.targetTemperature !== undefined) {
			return [
				{
					type: 'text',
					text: `Set thermostat to ${body.targetTemperature}°C`,
				},
				{
					type: 'devices',
					deviceIds: body.deviceIds,
				},
			];
		}
		return [
			{ type: 'text', text: 'Controlled thermostat' },
			{
				type: 'devices',
				deviceIds: body.deviceIds,
			},
		];
	}),

	// Scenes
	...createDescriber('device', '/scenes/create', 'POST', (body) => {
		return [{ type: 'text', text: `Created scene "${body.title}"` }];
	}),
	...createDescriber('device', '/scenes/:sceneId/update', 'POST', (body) => {
		return [{ type: 'text', text: `Updated scene "${body.title}"` }];
	}),
	...createDescriber('device', '/scenes/:sceneId/delete', 'POST', () => {
		return [{ type: 'text', text: 'Deleted scene' }];
	}),
	...createDescriber('device', '/scenes/:sceneId/trigger', 'POST', () => {
		return [{ type: 'text', text: 'Manually triggered scene' }];
	}),

	// Groups
	...createDescriber('device', '/groups/create', 'POST', (body) => {
		return [{ type: 'text', text: `Created group "${body.name}"` }];
	}),
	...createDescriber('device', '/groups/:groupId/update', 'POST', (body) => {
		return [{ type: 'text', text: `Updated group "${body.name}"` }];
	}),
	...createDescriber('device', '/groups/:groupId/delete', 'POST', () => {
		return [{ type: 'text', text: 'Deleted group' }];
	}),
	...createDescriber('device', '/groups/:groupId/updatePosition', 'POST', () => {
		return [{ type: 'text', text: 'Updated group position' }];
	}),

	// Palettes
	...createDescriber('device', '/palettes/create', 'POST', (body) => {
		return [{ type: 'text', text: `Created palette "${body.name}"` }];
	}),
	...createDescriber('device', '/palettes/:paletteId/update', 'POST', (body) => {
		return [{ type: 'text', text: `Updated palette "${body.name}"` }];
	}),
	...createDescriber('device', '/palettes/:paletteId/delete', 'POST', () => {
		return [{ type: 'text', text: 'Deleted palette' }];
	}),
	...createDescriber('device', '/palettes/:paletteId/apply', 'POST', (body) => {
		return [
			{ type: 'text', text: 'Applied palette' },
			{
				type: 'devices',
				deviceIds: body.deviceIds,
			},
		];
	}),

	// ===== Webhook Module =====
	...createDescriber('webhook', '/create', 'POST', (body) => {
		return [{ type: 'text', text: `Created webhook "${body.name}"` }];
	}),
	...createDescriber('webhook', '/:name/delete', 'DELETE', (body) => {
		// Params are merged into body by describeAction
		const bodyWithParams = body as { name: string };
		return [{ type: 'text', text: `Deleted webhook "${bodyWithParams.name}"` }];
	}),

	// ===== Home Detector Module =====
	...createDescriber('home-detector', '/create', 'POST', (body) => {
		return [{ type: 'text', text: `Added tracked device "${body.name}"` }];
	}),
	...createDescriber('home-detector', '/:name/update', 'POST', (body) => {
		// Params are merged into body by describeAction
		const bodyWithParams = body as { name: string; ips: string[] };
		return [{ type: 'text', text: `Updated tracked device "${bodyWithParams.name}"` }];
	}),
	...createDescriber('home-detector', '/:name/delete', 'POST', (body) => {
		// Params are merged into body by describeAction
		const bodyWithParams = body as { name: string };
		return [{ type: 'text', text: `Deleted tracked device "${bodyWithParams.name}"` }];
	}),
	...createDescriber('home-detector', '/door-sensors/update', 'POST', () => {
		return [{ type: 'text', text: 'Updated door sensor configuration' }];
	}),
	...createDescriber('home-detector', '/movement-sensors/update', 'POST', () => {
		return [{ type: 'text', text: 'Updated movement sensor configuration' }];
	}),
	...createDescriber('home-detector', '/check-all', 'POST', () => {
		return [{ type: 'text', text: 'Checked all tracked devices' }];
	}),

	// ===== Temperature Module =====
	...createDescriber('temperature', '/getTemp', 'POST', () => {
		return [{ type: 'text', text: 'Fetched external temperature' }];
	}),
	...createDescriber('temperature', '/inside-temperature-sensors', 'POST', () => {
		return [{ type: 'text', text: 'Updated temperature sensor configuration' }];
	}),
	...createDescriber('temperature', '/room/:roomName/target', 'POST', (body) => {
		// Params are merged into body by describeAction
		const bodyWithParams = body as { roomName: string; target: number };
		return [
			{
				type: 'text',
				text: `Set ${bodyWithParams.roomName} target to ${bodyWithParams.target}°C`,
			},
		];
	}),
	...createDescriber('temperature', '/room/:roomName/clear', 'POST', (body) => {
		// Params are merged into body by describeAction
		const bodyWithParams = body as { roomName: string };
		return [
			{
				type: 'text',
				text: `Cleared temperature override for ${bodyWithParams.roomName}`,
			},
		];
	}),
	...createDescriber('temperature', '/schedule', 'POST', () => {
		return [{ type: 'text', text: 'Updated temperature schedule' }];
	}),

	// ===== Wakelight Module =====
	...createDescriber('wakelight', '/set', 'POST', (body) => {
		return [
			{
				type: 'text',
				text: `Set wakelight for ${body.minutesToAlarm} minutes`,
			},
		];
	}),
	...createDescriber('wakelight', '/clear', 'POST', () => {
		return [{ type: 'text', text: 'Cleared wakelight' }];
	}),

	// ===== Notification Module =====
	...createDescriber('notification', '/register', 'POST', () => {
		return [{ type: 'text', text: 'Registered device for push notifications' }];
	}),
	...createDescriber('notification', '/:id/toggle', 'POST', (body) => {
		const text = body.enabled ? 'Enabled push notifications' : 'Disabled push notifications';
		return [{ type: 'text', text }];
	}),
	...createDescriber('notification', '/:id/update-name', 'POST', (body) => {
		return [
			{
				type: 'text',
				text: `Renamed notification device to "${body.name}"`,
			},
		];
	}),
	...createDescriber('notification', '/:id/unregister', 'POST', () => {
		return [{ type: 'text', text: 'Unregistered device from push notifications' }];
	}),
	...createDescriber('notification', '/:id/test', 'POST', () => {
		return [{ type: 'text', text: 'Sent test notification' }];
	}),
	...createDescriber('notification', '/settings', 'POST', () => {
		return [{ type: 'text', text: 'Updated notification settings' }];
	}),

	// ===== AI Module =====
	...createDescriber('ai', '/api-key/set', 'POST', () => {
		return [{ type: 'text', text: 'Updated AI API key' }];
	}),
	...createDescriber('ai', '/chat', 'POST', (body) => {
		const preview = body.message.length > 50 ? body.message.slice(0, 50) + '...' : body.message;
		return [{ type: 'text', text: `Sent AI message: "${preview}"` }];
	}),

	// ===== Auth Module =====
	...createDescriber('auth', '/login', 'POST', (body) => {
		return [{ type: 'text', text: `User "${body.username}" logged in` }];
	}),
	...createDescriber('auth', '/logout', 'POST', () => {
		return [{ type: 'text', text: 'User logged out' }];
	}),

	// ===== Config Modules =====
	...createDescriber('wled', '/config', 'POST', () => {
		return [{ type: 'text', text: 'Updated WLED configuration' }];
	}),
	...createDescriber('wled', '/refresh', 'POST', () => {
		return [{ type: 'text', text: 'Refreshed WLED devices' }];
	}),
	...createDescriber('tuya', '/config', 'POST', () => {
		return [{ type: 'text', text: 'Updated Tuya configuration' }];
	}),
	...createDescriber('homewizard', '/config', 'POST', () => {
		return [{ type: 'text', text: 'Updated HomeWizard configuration' }];
	}),
	...createDescriber('led-art', '/config', 'POST', () => {
		return [{ type: 'text', text: 'Updated LED Art configuration' }];
	}),

	// ===== Bot Module =====
	...createDescriber('bot', '/msg', 'POST', () => {
		return [{ type: 'text', text: 'Sent bot message' }];
	}),
};

/**
 * Get a human-readable description for an action.
 * Falls back to method + endpoint if no describer is registered.
 */
export function describeAction(
	method: string,
	endpoint: string,
	params: Record<string, string>,
	body: object
): LogDescription[] | null {
	const key = `${method} ${endpoint}`;
	const describer = describers[key];

	if (describer) {
		try {
			return describer({ ...params, ...(body ?? {}) });
		} catch {
			// If describer fails, fall back to default
		}
	}

	// Fallback: generate a basic description from the endpoint
	const parts = endpoint.split('/').filter(Boolean);
	if (parts.length >= 2) {
		const module = parts[0];
		const action = parts[parts.length - 1].replace(/:/g, '');
		return [{ type: 'text', text: `${method} ${module}/${action}` }];
	}

	return [{ type: 'text', text: `${method} ${endpoint}` }];
}
