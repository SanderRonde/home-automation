import {
	Box,
	Card,
	CardContent,
	Typography,
	Button,
	Alert,
	Stack,
} from '@mui/material';
import LaunchIcon from '@mui/icons-material/Launch';
import React from 'react';

export const EweLinkConfig = (): JSX.Element => {
	const handleUpdateCredentials = () => {
		// Open the OAuth URL in a new window/tab
		window.open('/ewelink/oauth/', '_blank');
	};

	return (
		<Box sx={{ p: 3, maxWidth: 800 }}>
			<Stack spacing={3}>
				<Alert severity="info">
					eWeLink integration allows you to connect and control your
					eWeLink smart devices through this home automation system.
				</Alert>

				<Card>
					<CardContent>
						<Stack spacing={2}>
							<Typography variant="h6" gutterBottom>
								Credentials Management
							</Typography>
							<Typography variant="body2" color="text.secondary">
								To connect your eWeLink devices, you need to
								authenticate with your eWeLink account. Click
								the button below to update your credentials.
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
						</Stack>
					</CardContent>
				</Card>
			</Stack>
		</Box>
	);
};
