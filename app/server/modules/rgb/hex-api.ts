export const hexEffects = {
	hexrainbowfast: {
		name: 'Fast Rainbows',
		description: 'A quickly rotating rainbow',
		effect: {
			name: 'rainbow',
			params: {
				revolve_time: '500',
			},
		},
	},
	hexrainbowslow: {
		name: 'Slow Rainbows',
		description: 'A slowly rotating rainbow',
		effect: {
			name: 'rainbow',
			params: {
				revolve_time: '25000',
			},
		},
	},
	hexrandomcolorsslow: {
		name: 'Slow Random Colors',
		description: 'Random colors changing slowly (1s)',
		effect: {
			name: 'random_colors',
			params: {
				wait_time: '1000',
				saturation: '90',
			},
		},
	},
	hexrandomcolorsslowbright: {
		name: 'Slow Random Colors',
		description: 'Random colors changing slowly (1s)',
		effect: {
			name: 'random_colors',
			params: {
				wait_time: '1000',
				saturation: '100',
			},
		},
	},
	hexrandomcolorspastel: {
		name: 'Slow Random Colors',
		description: 'Random colors changing slowly (1s)',
		effect: {
			name: 'random_colors',
			params: {
				wait_time: '1000',
				saturation: '75',
			},
		},
	},
	hexrandomcolorsfast: {
		name: 'Fast Random Colors',
		description: 'Random colors changing quickly (250ms)',
		effect: {
			name: 'random_colors',
			params: {
				wait_time: '250',
				saturation: '90',
			},
		},
	},
	hexrandomcolorsfastest: {
		name: 'Very Fast Random Colors',
		description: 'Random colors changing very quickly (25ms)',
		effect: {
			name: 'random_colors',
			params: {
				wait_time: '25',
				saturation: '90',
			},
		},
	},
	hexgradual: {
		name: 'Gradual Color Changes',
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
		name: 'Slow Gradual Color Changes',
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
		name: 'Gradual Color Changes (Pastel)',
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
		name: 'Gradual Color Changes (high Neighbour)',
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
		name: 'Gradual Color Changes (slow)',
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
		name: 'Gradual Color Changes (no Neighbour)',
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
		name: 'Gradual Color Changes (split)',
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
	hexfadepurple: {
		name: 'Hex fade from red to blue',
		description: 'Fade from red to blue',
		effect: {
			name: 'fade',
			params: {
				from: '#ff0000',
				to: '#0000ff',
				direction: 'right',
			},
		},
	},
	hexfadeorange: {
		name: 'Hex fade from red to yellow',
		description: 'Fade from red to yellow',
		effect: {
			name: 'fade',
			params: {
				from: '#ff0000',
				to: '#FFFF00',
				direction: 'right',
			},
		},
	},
	hexfadeanimatedfromred: {
		name: 'Hex fade from red to animating color',
		description: 'Fade from red to animating color',
		effect: {
			name: 'fade',
			params: {
				from: '#ff0000',
				to: '#FFFF00',
				direction: 'right',
				animate_to: 'true',
				to_interval_min: '10000',
				to_interval_max: '20000',
			},
		},
	},
	hexfadeanimatedtored: {
		name: 'Hex fade to red from animating color',
		description: 'Fade to red from animating color',
		effect: {
			name: 'fade',
			params: {
				from: '#ff0000',
				to: '#F00F00',
				direction: 'right',
				animate_from: 'true',
				from_interval_min: '10000',
				from_interval_max: '20000',
			},
		},
	},
	hexfadeanimatedfromblue: {
		name: 'Hex fade from blue to animating color',
		description: 'Fade from blue to animating color',
		effect: {
			name: 'fade',
			params: {
				from: '#0000ff',
				to: '#FFFF00',
				direction: 'right',
				animate_to: 'true',
				to_interval_min: '10000',
				to_interval_max: '20000',
			},
		},
	},
	hexfadeanimatedtoblue: {
		name: 'Hex fade to blue from animating color',
		description: 'Fade to blue from animating color',
		effect: {
			name: 'fade',
			params: {
				from: '#0000ff',
				to: '#F00F00',
				direction: 'right',
				animate_from: 'true',
				from_interval_min: '10000',
				from_interval_max: '20000',
			},
		},
	},
	hexfadeanimateboth: {
		name: 'Hex fade animating both sides',
		description: 'Fade animating both sides',
		effect: {
			name: 'fade',
			params: {
				from: '#0000ff',
				to: '#F00F00',
				direction: 'right',
				animate_from: 'true',
				from_interval_min: '10000',
				from_interval_max: '20000',
				animate_to: 'true',
				to_interval_min: '10000',
				to_interval_max: '20000',
			},
		},
	},
	hexfadeanimatebothfast: {
		name: 'Hex fade animating both sides (fast)',
		description: 'Fade animating both sides (fast)',
		effect: {
			name: 'fade',
			params: {
				from: '#0000ff',
				to: '#F00F00',
				direction: 'right',
				animate_from: 'true',
				from_interval_min: '5000',
				from_interval_max: '10000',
				animate_to: 'true',
				to_interval_min: '5000',
				to_interval_max: '10000',
			},
		},
	},
	hexfadeanimatebothslow: {
		name: 'Hex fade animating both sides (slow)',
		description: 'Fade animating both sides (slow)',
		effect: {
			name: 'fade',
			params: {
				from: '#0000ff',
				to: '#F00F00',
				direction: 'right',
				animate_from: 'true',
				from_interval_min: '10000',
				from_interval_max: '20000',
				animate_to: 'true',
				to_interval_min: '30000',
				to_interval_max: '60000',
			},
		},
	},
} as {
	[effectName: string]: {
		name: string;
		description: string;
		effect: {
			name: string;
			params: Record<string, string>;
		};
	};
};
