// New keyval data structure
export interface KeyvalItem {
	name: string;
	icon?: string;
	deviceId: string;
	// Boolean value will be computed from device cluster, not stored
}

export interface KeyvalGroup {
	name: string;
	icon?: string;
	items: KeyvalItem[];
}

export interface KeyvalConfig {
	groups: KeyvalGroup[];
}

// For the editor schema
export const KEYVAL_JSON_SCHEMA = {
	type: 'object',
	properties: {
		groups: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					name: {
						type: 'string',
						description: 'Display name for the group',
					},
					icon: {
						type: 'string',
						description: 'Optional emoji icon for the group',
					},
					items: {
						type: 'array',
						items: {
							type: 'object',
							properties: {
								name: {
									type: 'string',
									description: 'Display name for the item',
								},
								icon: {
									type: 'string',
									description:
										'Optional emoji icon for the item',
								},
								deviceId: {
									type: 'string',
									description: 'Unique device identifier',
								},
							},
							required: ['name', 'deviceId'],
							additionalProperties: false,
						},
					},
				},
				required: ['name', 'items'],
				additionalProperties: false,
			},
		},
	},
	required: ['groups'],
	additionalProperties: false,
} as const;

// Sample data for editor
export const SAMPLE_KEYVAL_CONFIG: KeyvalConfig = {
	groups: [
		{
			name: 'Living Room',
			icon: '🛋️',
			items: [
				{
					name: 'Main Light',
					icon: '💡',
					deviceId: 'device-living-room-main-light',
				},
				{
					name: 'Ambient Light',
					icon: '🕯️',
					deviceId: 'device-living-room-ambient',
				},
			],
		},
		{
			name: 'Kitchen',
			icon: '🍳',
			items: [
				{
					name: 'Ceiling Light',
					icon: '💡',
					deviceId: 'device-kitchen-ceiling',
				},
				{
					name: 'Counter Light',
					icon: '🔦',
					deviceId: 'device-kitchen-counter',
				},
			],
		},
	],
};

// Placeholder device IDs for picker
export const PLACEHOLDER_DEVICE_IDS = [
	'device-living-room-main-light',
	'device-living-room-ambient',
	'device-kitchen-ceiling',
	'device-kitchen-counter',
	'device-bedroom-main',
	'device-bedroom-bedside',
	'device-bathroom-main',
	'device-hallway-ceiling',
	'device-office-desk',
	'device-office-overhead',
];
