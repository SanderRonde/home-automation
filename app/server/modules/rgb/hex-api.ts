export const hexEffects = {
	hexrainbowfast: {
		description: 'A quickly rotating rainbow',
		effect: {
			name: 'rainbow',
			params: {
				revolve_time: '500',
			},
		},
	},
	hexrainbowslow: {
		description: 'A slowly rotating rainbow',
		effect: {
			name: 'rainbow',
			params: {
				revolve_time: '25000',
			},
		},
	},
	hexrandomcolorsslow: {
		description: 'Random colors changing slowly (1s)',
		effect: {
			name: 'random_colors',
			params: {
				wait_time: '1000',
			},
		},
	},
	hexrandomcolorsfast: {
		description: 'Random colors changing quickly (250ms)',
		effect: {
			name: 'random_colors',
			params: {
				wait_time: '250',
			},
		},
	},
	hexrandomcolorsfastest: {
		description: 'Random colors changing very quickly (25ms)',
		effect: {
			name: 'random_colors',
			params: {
				wait_time: '25',
			},
		},
	},
	hexgradual: {
		description: 'Gradual color changes',
		effect: {
			name: 'random_colors_gradual',
			params: {
				wait_time_min: '500',
				wait_time_max: '3000',
				neighbour_influence: '128',
				use_pastel: 'false',
				use_split: 'false',
			},
		},
	},
	hexgradualslower: {
		description: 'Gradual color changes (a little slower)',
		effect: {
			name: 'random_colors_gradual',
			params: {
				wait_time_min: '100',
				wait_time_max: '5000',
				neighbour_influence: '128',
				use_pastel: 'false',
				use_split: 'false',
			},
		},
	},
	hexgradualpastel: {
		description: 'Gradual color changes (pastel)',
		effect: {
			name: 'random_colors_gradual',
			params: {
				wait_time_min: '500',
				wait_time_max: '3000',
				neighbour_influence: '128',
				use_pastel: 'true',
				use_split: 'false',
			},
		},
	},
	hexgradualbiginfluence: {
		description: 'Gradual color changes with high neighbour influence',
		effect: {
			name: 'random_colors_gradual',
			params: {
				wait_time_min: '500',
				wait_time_max: '3000',
				neighbour_influence: '255',
				use_pastel: 'false',
				use_split: 'false',
			},
		},
	},
	hexgradualslow: {
		description: 'Gradual color changes slowly',
		effect: {
			name: 'random_colors_gradual',
			params: {
				wait_time_min: '500',
				wait_time_max: '5000',
				neighbour_influence: '128',
				use_pastel: 'false',
				use_split: 'false',
			},
		},
	},
	hexgradualnoinfluence: {
		description: 'Gradual color changes without neighbour influence',
		effect: {
			name: 'random_colors_gradual',
			params: {
				wait_time_min: '500',
				wait_time_max: '5000',
				neighbour_influence: '0',
				use_pastel: 'true',
				use_split: 'false',
			},
		},
	},
	hexgradualsplit: {
		description: 'Gradual color changes that are split',
		effect: {
			name: 'random_colors_gradual',
			params: {
				wait_time_min: '500',
				wait_time_max: '5000',
				neighbour_influence: '0',
				use_pastel: 'true',
				use_split: 'true',
			},
		},
	},
};
