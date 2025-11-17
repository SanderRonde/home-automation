import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { Box, Paper, Typography, Button } from '@mui/material';
import React from 'react';

interface NotFoundPageProps {
	onReturnToSettings: () => void;
}

export const NotFoundPage = ({ onReturnToSettings }: NotFoundPageProps): JSX.Element => {
	return (
		<Box
			sx={{
				height: 'calc(100vh - 180px)',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
			}}
		>
			<Paper sx={{ p: 4, maxWidth: 600, textAlign: 'center' }}>
				<Box sx={{ mb: 2 }}>
					<ErrorOutlineIcon sx={{ fontSize: 64, color: 'warning.main' }} />
				</Box>
				<Typography variant="h4" gutterBottom>
					404 - Page Not Found
				</Typography>
				<Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
					The page you're looking for doesn't exist or has been moved.
				</Typography>
				<Button
					variant="contained"
					color="primary"
					onClick={onReturnToSettings}
					sx={{ mt: 2 }}
				>
					Go to Settings
				</Button>
			</Paper>
		</Box>
	);
};
