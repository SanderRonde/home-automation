import { Box, CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import React from 'react';

const darkTheme = createTheme({
	palette: {
		mode: 'dark',
		primary: {
			main: '#ff1744',
			light: '#ff4569',
		},
		background: {
			default: '#1a1a1a',
			paper: '#242424',
		},
		text: {
			primary: '#ffffff',
			secondary: 'rgba(255, 255, 255, 0.7)',
		},
	},
	components: {
		MuiAppBar: {
			styleOverrides: {
				root: {
					background:
						'linear-gradient(45deg, #242424 30%, #2a2a2a 90%)',
					borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
				},
			},
		},
		MuiDrawer: {
			styleOverrides: {
				paper: {
					background:
						'linear-gradient(180deg, #242424 0%, #1a1a1a 100%)',
					borderRight: '1px solid rgba(255, 255, 255, 0.05)',
				},
			},
		},
	},
});

interface AppLayoutProps {
	children: React.ReactNode;
	currentTab: string;
	onTabChange: (tab: string) => void;
}

export const AppLayout = (props: AppLayoutProps): JSX.Element => {
	const [open, setOpen] = React.useState(true);

	return (
		<ThemeProvider theme={darkTheme}>
			<CssBaseline />
			<Box
				sx={{
					display: 'flex',
					height: '100vh',
					bgcolor: 'background.default',
				}}
			>
				<TopBar open={open} setOpen={setOpen} />
				<Sidebar
					open={open}
					currentTab={props.currentTab}
					onTabChange={props.onTabChange}
				/>
				<Box
					component="main"
					sx={{
						flexGrow: 1,
						p: 3,
						width: '100%',
						height: '100vh',
						overflow: 'auto',
						bgcolor: 'background.default',
						marginTop: '64px',
					}}
				>
					{props.children}
				</Box>
			</Box>
		</ThemeProvider>
	);
};
