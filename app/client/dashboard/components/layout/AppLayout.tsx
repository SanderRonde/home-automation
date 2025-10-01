import {
	Box,
	CssBaseline,
	ThemeProvider,
	createTheme,
	useMediaQuery,
	useTheme,
} from '@mui/material';
import { TOP_BAR_HEIGHT, TopBar } from './TopBar';
import type { SidebarTab } from './Sidebar';
import { Sidebar } from './Sidebar';
import React from 'react';

const darkTheme = createTheme({
	palette: {
		mode: 'dark',
		primary: {
			main: '#ff1744',
			light: '#ff4569',
			contrastText: '#ffffff',
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
	currentTab: string | SidebarTab;
	onTabChange: (tab: SidebarTab) => void;
}

export const AppLayout = (props: AppLayoutProps): JSX.Element => {
	const theme = useTheme();
	const isMobile = useMediaQuery(theme.breakpoints.down('md'));

	// Start with sidebar closed on mobile, open on desktop
	const [open, setOpen] = React.useState(!isMobile);

	// Update sidebar state when screen size changes
	React.useEffect(() => {
		setOpen(!isMobile);
	}, [isMobile]);

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
				<TopBar
					open={open}
					setOpen={setOpen}
					currentTab={props.currentTab}
				/>
				<Sidebar
					open={open}
					isMobile={isMobile}
					onClose={() => setOpen(false)}
					currentTab={props.currentTab}
					onTabChange={props.onTabChange}
				/>
				<Box
					component="main"
					sx={{
						flexGrow: 1,
						width: '100%',
						height: `calc(100vh - ${TOP_BAR_HEIGHT}px)`,
						overflow: 'auto',
						bgcolor: 'background.default',
						marginTop: `${TOP_BAR_HEIGHT}px`,
						transition: (theme) =>
							theme.transitions.create('margin', {
								easing: theme.transitions.easing.sharp,
								duration:
									theme.transitions.duration.leavingScreen,
							}),
						// Only shift content on desktop when sidebar is open
						marginLeft: !isMobile && open ? '240px' : 0,
					}}
				>
					{props.children}
				</Box>
			</Box>
		</ThemeProvider>
	);
};
