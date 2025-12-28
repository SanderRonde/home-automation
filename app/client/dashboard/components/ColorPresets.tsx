import { staggerContainer, staggerItem, bouncySpring } from '../../lib/animations';
import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import React from 'react';

interface ColorPresetsProps {
	isUpdating: boolean;
	onPresetClick: (hue: number, saturation: number) => void;
}

const COLOR_PRESETS = [
	{ name: 'Warm White', hue: 30, saturation: 20 },
	{ name: 'Cool White', hue: 200, saturation: 10 },
	{ name: 'Red', hue: 0, saturation: 100 },
	{ name: 'Orange', hue: 30, saturation: 100 },
	{ name: 'Yellow', hue: 60, saturation: 100 },
	{ name: 'Green', hue: 120, saturation: 100 },
	{ name: 'Cyan', hue: 180, saturation: 100 },
	{ name: 'Blue', hue: 240, saturation: 100 },
	{ name: 'Purple', hue: 270, saturation: 100 },
	{ name: 'Pink', hue: 330, saturation: 100 },
];

export const hsvToHex = (h: number, s: number, v: number): string => {
	const hNorm = h / 360;
	const sNorm = s / 100;
	const vNorm = v / 100;

	const i = Math.floor(hNorm * 6);
	const f = hNorm * 6 - i;
	const p = vNorm * (1 - sNorm);
	const q = vNorm * (1 - f * sNorm);
	const t = vNorm * (1 - (1 - f) * sNorm);

	let r: number, g: number, b: number;
	switch (i % 6) {
		case 0:
			r = vNorm;
			g = t;
			b = p;
			break;
		case 1:
			r = q;
			g = vNorm;
			b = p;
			break;
		case 2:
			r = p;
			g = vNorm;
			b = t;
			break;
		case 3:
			r = p;
			g = q;
			b = vNorm;
			break;
		case 4:
			r = t;
			g = p;
			b = vNorm;
			break;
		case 5:
			r = vNorm;
			g = p;
			b = q;
			break;
		default:
			r = 0;
			g = 0;
			b = 0;
	}

	const toHex = (n: number) => {
		const hex = Math.round(n * 255).toString(16);
		return hex.length === 1 ? '0' + hex : hex;
	};

	return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

export const ColorPresets = (props: ColorPresetsProps): JSX.Element => {
	return (
		<motion.div variants={staggerContainer} initial="initial" animate="animate">
			<Box sx={{ mb: 4, px: 2 }}>
				<Typography
					sx={{
						fontSize: '0.875rem',
						fontWeight: 600,
						color: 'text.primary',
						mb: 2,
						letterSpacing: '0.02em',
						textTransform: 'uppercase',
						opacity: 0.8,
						textAlign: 'center',
					}}
				>
					Quick Colors
				</Typography>
				<Box
					sx={{
						display: 'flex',
						gap: 2,
						flexWrap: 'wrap',
						justifyContent: 'center',
					}}
				>
					{COLOR_PRESETS.map((preset) => {
						const presetColor = hsvToHex(preset.hue, preset.saturation, 100);
						return (
							<motion.div
								key={preset.name}
								variants={staggerItem}
								whileHover={{ scale: 1.15, y: -4 }}
								whileTap={{ scale: 0.9 }}
								transition={bouncySpring}
							>
								<Box
									onClick={() =>
										void props.onPresetClick(preset.hue, preset.saturation)
									}
									sx={{
										width: 52,
										height: 52,
										borderRadius: '50%',
										backgroundColor: presetColor,
										cursor: props.isUpdating ? 'default' : 'pointer',
										opacity: props.isUpdating ? 0.5 : 1,
										boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
										border: '3px solid white',
										position: 'relative',
										'&::after': {
											content: '""',
											position: 'absolute',
											inset: -2,
											borderRadius: '50%',
											padding: 2,
											background: `linear-gradient(135deg, ${presetColor}, ${presetColor})`,
											WebkitMask:
												'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
											WebkitMaskComposite: 'xor',
											maskComposite: 'exclude',
											opacity: 0,
											transition: 'opacity 0.2s',
										},
										'&:hover::after': {
											opacity: props.isUpdating ? 0 : 0.5,
										},
									}}
								/>
							</motion.div>
						);
					})}
				</Box>
			</Box>
		</motion.div>
	);
};
