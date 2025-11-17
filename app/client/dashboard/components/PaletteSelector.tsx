import {
	Box,
	Card,
	CardActionArea,
	CardContent,
	CircularProgress,
	Typography,
} from '@mui/material';
import type { Palette } from '../../../../types/palette';
import React from 'react';

interface PaletteSelectorProps {
	palettes: Palette[];
	onSelect: (paletteId: string) => void;
	selectedPaletteId: string | null;
}

export const PaletteSelector = (props: PaletteSelectorProps): JSX.Element => {
	// Calculate grid layout: 2 rows, scroll horizontally
	const paletteRows = React.useMemo(() => {
		const rows: Palette[][] = [[], []];
		props.palettes.forEach((palette, index) => {
			rows[index % 2].push(palette);
		});
		return rows;
	}, [props.palettes]);

	return (
		<Box
			sx={{
				display: 'flex',
				flexDirection: 'column',
				gap: 1.5,
			}}
		>
			{paletteRows.map((row, rowIndex) => (
				<Box
					key={rowIndex}
					sx={{
						display: 'flex',
						gap: 1.5,
						overflowX: 'auto',
						pb: 0.5,
						'&::-webkit-scrollbar': {
							height: 6,
						},
						'&::-webkit-scrollbar-thumb': {
							backgroundColor: 'rgba(0,0,0,.2)',
							borderRadius: 3,
						},
					}}
				>
					{row.map((palette) => (
						<Card
							key={palette.id}
							sx={{
								minWidth: 160,
								maxWidth: 200,
								borderRadius: 2,
								border: '2px solid',
								borderColor:
									props.selectedPaletteId === palette.id
										? 'primary.main'
										: 'transparent',
								position: 'relative',
							}}
						>
							<CardActionArea
								onClick={() => props.onSelect(palette.id)}
								disabled={props.selectedPaletteId === palette.id}
							>
								<CardContent sx={{ p: 1.5 }}>
									<Typography
										variant="body2"
										sx={{
											fontWeight: 500,
											mb: 1,
											overflow: 'hidden',
											textOverflow: 'ellipsis',
											whiteSpace: 'nowrap',
										}}
									>
										{palette.name}
									</Typography>
									<Box sx={{ display: 'flex', gap: 0.5 }}>
										{palette.colors.map((color, idx) => (
											<Box
												key={idx}
												sx={{
													width: 24,
													height: 24,
													backgroundColor: color,
													borderRadius: 0.5,
													border: '1px solid',
													borderColor: 'divider',
													flexShrink: 0,
												}}
											/>
										))}
									</Box>
								</CardContent>
							</CardActionArea>
							{props.selectedPaletteId === palette.id && (
								<Box
									sx={{
										position: 'absolute',
										top: 0,
										right: 0,
										bottom: 0,
										left: 0,
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										backgroundColor: 'rgba(0,0,0,0.1)',
										borderRadius: 2,
									}}
								>
									<CircularProgress size={24} />
								</Box>
							)}
						</Card>
					))}
				</Box>
			))}
		</Box>
	);
};
