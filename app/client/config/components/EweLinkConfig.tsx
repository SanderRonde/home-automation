import React from 'react';
import {
	Box,
	Card,
	CardContent,
	Typography,
	Button,
	Alert,
	Stack,
} from '@mui/material';
import CloudIcon from '@mui/icons-material/Cloud';
import LaunchIcon from '@mui/icons-material/Launch';

export const EweLinkConfig = (): JSX.Element => {
	const handleUpdateCredentials = () => {
		// Open the OAuth URL in a new window/tab
		window.open('/ewelink/oauth/', '_blank');
	};

	return (
		<Box sx={{ p: 3, maxWidth: 800 }}>
			<Stack spacing={3}>
				<Box display="flex" alignItems="center" gap={2}>
					<CloudIcon fontSize="large" color="primary" />
					<Typography variant="h4" component="h1">
						eWeLink Configuration
					</Typography>
				</Box>

				<Alert severity="info">
					eWeLink integration allows you to connect and control your eWeLink smart devices
					through this home automation system.
				</Alert>

				<Card>
					<CardContent>
						<Stack spacing={2}>
							<Typography variant="h6" gutterBottom>
								Credentials Management
							</Typography>
							<Typography variant="body2" color="text.secondary">
								To connect your eWeLink devices, you need to authenticate with your eWeLink account.
								Click the button below to update your credentials.
							</Typography>
							<Box>
								<Button
									variant="contained"
									color="primary"
									onClick={handleUpdateCredentials}
									startIcon={<LaunchIcon />}
									size="large"
								>
									Update eWeLink Credentials
								</Button>
							</Box>
							<Alert severity="warning" sx={{ mt: 2 }}>
								<Typography variant="body2">
									<strong>Note:</strong> This will open a new window to authenticate with eWeLink.
									Make sure to allow popups if prompted by your browser.
								</Typography>
							</Alert>
						</Stack>
					</CardContent>
				</Card>
			</Stack>
		</Box>
	);
};
