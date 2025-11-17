import { Box } from '@mui/material';
import React from 'react';

interface WindowCoveringVisualizationProps {
	displayPosition: number;
	userHasInteracted: boolean;
}

export const WindowCoveringVisualization = (
	props: WindowCoveringVisualizationProps
): JSX.Element => {
	return (
		<Box
			sx={{
				position: 'relative',
				width: '100%',
				height: 300,
				border: '3px solid #4b5563',
				borderRadius: 2,
				overflow: 'hidden',
				backgroundColor: '#e5e7eb',
				my: 3,
			}}
		>
			{/* Window frame */}
			<Box
				sx={{
					position: 'absolute',
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					background:
						'linear-gradient(180deg, #87ceeb 0%, #87ceeb 70%, #90ee90 70%, #90ee90 100%)',
				}}
			/>
			{/* Sun icon */}
			<Box
				sx={{
					position: 'absolute',
					top: '15%',
					right: '15%',
					width: 50,
					height: 50,
					borderRadius: '50%',
					background: 'radial-gradient(circle, #ffd700 0%, #ffed4e 100%)',
					boxShadow: '0 0 20px rgba(255, 215, 0, 0.6)',
					'&::before': {
						content: '""',
						position: 'absolute',
						top: '50%',
						left: '50%',
						width: '70px',
						height: '70px',
						transform: 'translate(-50%, -50%)',
						borderRadius: '50%',
						background:
							'radial-gradient(circle, rgba(255, 215, 0, 0.3) 0%, transparent 70%)',
					},
				}}
			/>
			{/* Blind */}
			<Box
				sx={{
					position: 'absolute',
					top: 0,
					left: 0,
					right: 0,
					height: `${props.displayPosition}%`,
					background:
						'repeating-linear-gradient(0deg, #9ca3af 0px, #9ca3af 10px, #6b7280 10px, #6b7280 11px)',
					boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
					transition: props.userHasInteracted ? 'height 0.5s ease-in-out' : 'none',
				}}
			/>
			{/* Position indicator */}
			<Box
				sx={{
					position: 'absolute',
					top: `${Math.max(8, Math.min(92, props.displayPosition))}%`,
					left: '50%',
					transform: 'translate(-50%, -50%)',
					backgroundColor: 'rgba(0, 0, 0, 0.7)',
					color: 'white',
					padding: '4px 12px',
					borderRadius: 1,
					fontWeight: 'bold',
					fontSize: '1.2rem',
				}}
			>
				{Math.round(props.displayPosition)}%
			</Box>
		</Box>
	);
};
