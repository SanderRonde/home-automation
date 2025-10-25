import { Box, Paper, TextField, Button, Typography, Alert, Container } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { createRoot } from 'react-dom/client';
import React, { useState } from 'react';
import { apiPost } from '../lib/fetch';

const darkTheme = createTheme({
	palette: {
		mode: 'dark',
	},
});

function LoginPage(): JSX.Element {
	const [username, setUsername] = useState<string>('');
	const [password, setPassword] = useState<string>('');
	const [error, setError] = useState<string>('');
	const [loading, setLoading] = useState<boolean>(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError('');
		setLoading(true);

		try {
			const response = await apiPost(
				'auth',
				'/login',
				{},
				{
					username,
					password,
				}
			);

			if (!response.ok) {
				if (response.status === 401) {
					setError('Invalid username or password');
				} else {
					setError('Login failed. Please try again.');
				}
				setLoading(false);
				return;
			}

			const data = await response.json();
			if (data.success) {
				// Redirect to the page they were trying to access or home
				const params = new URLSearchParams(window.location.search);
				const redirect = params.get('redirect') || '/dashboard';
				window.location.href = redirect;
			} else {
				setError('Login failed. Please try again.');
				setLoading(false);
			}
		} catch {
			setError('Network error. Please try again.');
			setLoading(false);
		}
	};

	return (
		<ThemeProvider theme={darkTheme}>
			<CssBaseline />
			<Container maxWidth="sm">
				<Box
					sx={{
						minHeight: '100vh',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
					}}
				>
					<Paper
						elevation={3}
						sx={{
							padding: 4,
							width: '100%',
							maxWidth: 400,
						}}
					>
						<Typography variant="h4" component="h1" gutterBottom align="center">
							Home Automation
						</Typography>
						<Typography variant="subtitle1" gutterBottom align="center" mb={3}>
							Please sign in
						</Typography>

						{error && (
							<Alert severity="error" sx={{ mb: 2 }}>
								{error}
							</Alert>
						)}

						<form onSubmit={handleSubmit}>
							<TextField
								fullWidth
								label="Username"
								variant="outlined"
								margin="normal"
								value={username}
								onChange={(e) => setUsername(e.target.value)}
								disabled={loading}
								autoFocus
								required
							/>
							<TextField
								fullWidth
								label="Password"
								type="password"
								variant="outlined"
								margin="normal"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								disabled={loading}
								required
							/>
							<Button
								fullWidth
								type="submit"
								variant="contained"
								size="large"
								disabled={loading}
								sx={{ mt: 3 }}
							>
								{loading ? 'Signing in...' : 'Sign In'}
							</Button>
						</form>
					</Paper>
				</Box>
			</Container>
		</ThemeProvider>
	);
}

const root = createRoot(document.getElementById('root')!);
root.render(
	<React.StrictMode>
		<LoginPage />
	</React.StrictMode>
);
