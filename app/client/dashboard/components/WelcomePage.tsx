import { Box, Paper, Typography } from '@mui/material';
import React from 'react';

export const WelcomePage = (): JSX.Element => {
	return (
		<Box
			sx={{
				height: 'calc(100vh - 180px)',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				p: { xs: 2, sm: 3 },
			}}
		>
			<Paper sx={{ p: 4, maxWidth: 600, textAlign: 'center' }}>
				<Typography variant="h4" gutterBottom>
					Welcome to Home Automation
				</Typography>
				<Typography variant="body1" color="text.secondary">
					Select a module from the sidebar to get started. Here you can configure and
					manage your home automation settings.
				</Typography>
			</Paper>
		</Box>
	);
};
