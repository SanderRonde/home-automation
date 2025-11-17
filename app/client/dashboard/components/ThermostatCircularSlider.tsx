import { Box, Typography, Chip } from '@mui/material';
import React from 'react';

interface ThermostatCircularSliderProps {
	displayTemp: number;
	currentTemp: number;
	minTemp: number;
	maxTemp: number;
	accentColor: string;
	isHeating: boolean;
	isDragging: boolean;
	circleRef: React.RefObject<HTMLDivElement>;
	onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
	onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
	onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
}

export const ThermostatCircularSlider = (props: ThermostatCircularSliderProps): JSX.Element => {
	// Calculate angle for temperature position on arc
	const tempToAngle = (temp: number): number => {
		const tempRange = props.maxTemp - props.minTemp;
		const percentage = (temp - props.minTemp) / tempRange;
		return 135 + percentage * 270; // Start at 135° (bottom-left), go 270° clockwise
	};

	const targetAngle = tempToAngle(props.displayTemp);
	const currentAngle = tempToAngle(props.currentTemp);

	return (
		<Box
			sx={{
				display: 'flex',
				justifyContent: 'center',
				alignItems: 'center',
				my: 4,
			}}
		>
			<Box
				ref={props.circleRef}
				sx={{
					position: 'relative',
					width: 280,
					height: 280,
					cursor: props.isDragging ? 'grabbing' : 'pointer',
					touchAction: 'none',
				}}
				onPointerDown={props.onPointerDown}
				onPointerMove={props.isDragging ? props.onPointerMove : undefined}
				onPointerUp={props.onPointerUp}
			>
				{/* Background circle */}
				<svg width="280" height="280" style={{ position: 'absolute', top: 0, left: 0 }}>
					{/* Background arc */}
					<circle
						cx="140"
						cy="140"
						r="120"
						fill="none"
						stroke="#e5e7eb"
						strokeWidth="20"
						strokeDasharray="753"
						strokeDashoffset="188"
						style={{
							transform: 'rotate(135deg)',
							transformOrigin: 'center',
						}}
					/>

					{/* Active arc (from min to target) */}
					<circle
						cx="140"
						cy="140"
						r="120"
						fill="none"
						stroke={props.accentColor}
						strokeWidth="20"
						strokeLinecap="round"
						strokeDasharray="753"
						strokeDashoffset={188 + 753 * (1 - (targetAngle - 135) / 270)}
						style={{
							transform: 'rotate(135deg)',
							transformOrigin: 'center',
							transition: props.isDragging ? 'none' : 'stroke-dashoffset 0.3s ease',
						}}
					/>

					{/* Handle for target temperature */}
					<circle
						cx={140 + 120 * Math.cos(((targetAngle - 90) * Math.PI) / 180)}
						cy={140 + 120 * Math.sin(((targetAngle - 90) * Math.PI) / 180)}
						r="16"
						fill="white"
						stroke={props.accentColor}
						strokeWidth="3"
					/>

					{/* Current temperature indicator */}
					<circle
						cx={140 + 100 * Math.cos(((currentAngle - 90) * Math.PI) / 180)}
						cy={140 + 100 * Math.sin(((currentAngle - 90) * Math.PI) / 180)}
						r="6"
						fill="#6b7280"
					/>
				</svg>

				{/* Center content */}
				<Box
					sx={{
						position: 'absolute',
						top: '50%',
						left: '50%',
						transform: 'translate(-50%, -50%)',
						textAlign: 'center',
					}}
				>
					<Typography
						variant="h2"
						sx={{
							fontWeight: 'bold',
							color: props.accentColor,
							mb: 1,
						}}
					>
						{props.displayTemp.toFixed(1)}°
					</Typography>
					<Typography
						variant="body2"
						sx={{
							color: 'text.secondary',
						}}
					>
						Current: {props.currentTemp.toFixed(1)}°C
					</Typography>
					{props.isHeating && (
						<Chip
							label="Heating"
							size="small"
							sx={{
								mt: 1,
								backgroundColor: props.accentColor,
								color: 'white',
							}}
						/>
					)}
				</Box>
			</Box>
		</Box>
	);
};
