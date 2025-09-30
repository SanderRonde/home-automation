import { Box, Typography } from '@mui/material';
import React from 'react';

export const Home = (): JSX.Element => {
	return (
		<Box>
			<Typography
				variant="h4"
				sx={{
					color: 'primary.main',
					fontWeight: 300,
					letterSpacing: '0.2rem',
					mb: 3,
				}}
			>
				Home
			</Typography>
			{/* Content will be added later */}
		</Box>
	);
};
