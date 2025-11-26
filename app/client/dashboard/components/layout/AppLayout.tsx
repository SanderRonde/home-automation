import {
	Box,
	CssBaseline,
	ThemeProvider,
	createTheme,
	useMediaQuery,
	useTheme,
	IconButton,
	Tooltip,
	Fade,
} from '@mui/material';
import { useOffline } from '../../../lib/offline-context';
import { TOP_BAR_HEIGHT, TopBar } from './TopBar';
import { WifiOff } from '@mui/icons-material';
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
					background: 'linear-gradient(45deg, #242424 30%, #2a2a2a 90%)',
					borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
				},
			},
		},
		MuiDrawer: {
			styleOverrides: {
				paper: {
					background: 'linear-gradient(180deg, #242424 0%, #1a1a1a 100%)',
					borderRight: '1px solid rgba(255, 255, 255, 0.05)',
				},
			},
		},
	},
});

interface AppLayoutProps {
	kiosk: boolean;
	children: React.ReactNode;
	currentTab: string | SidebarTab;
	onTabChange: (tab: SidebarTab) => void;
}

export const AppLayout = (props: AppLayoutProps): JSX.Element => {
	const theme = useTheme();
	const isMobile = useMediaQuery(theme.breakpoints.down('md'));
	const { isOnline } = useOffline();
	const mainContentRef = React.useRef<HTMLDivElement>(null);

	// Start with sidebar closed on mobile, open on desktop
	const [open, setOpen] = React.useState(!isMobile);

	// Update sidebar state when screen size changes
	React.useEffect(() => {
		setOpen(!isMobile);
	}, [isMobile]);

	// Reset scroll position when tab changes
	React.useEffect(() => {
		if (mainContentRef.current) {
			mainContentRef.current.scrollTop = 0;
		}
	}, [props.currentTab]);

	return (
		<ThemeProvider theme={darkTheme}>
			<CssBaseline />
			<Box
				sx={{
					display: 'flex',
					height: '100vh',
					bgcolor: props.kiosk ? 'black' : 'background.default',
				}}
			>
				{!props.kiosk && (
					<TopBar open={open} setOpen={setOpen} currentTab={props.currentTab} />
				)}
				{!props.kiosk && (
					<Sidebar
						open={open}
						isMobile={isMobile}
						onClose={() => setOpen(false)}
						currentTab={props.currentTab}
						onTabChange={props.onTabChange}
					/>
				)}
				<Box
					ref={mainContentRef}
					component="main"
					sx={{
						flexGrow: 1,
						width: '100%',
						height: props.kiosk ? '100vh' : `calc(100vh - ${TOP_BAR_HEIGHT}px)`,
						overflow: 'auto',
						bgcolor: props.kiosk ? 'black' : 'background.default',
						marginTop: props.kiosk ? 0 : `${TOP_BAR_HEIGHT}px`,
						position: 'relative',
						transition: (theme) =>
							theme.transitions.create('margin', {
								easing: theme.transitions.easing.sharp,
								duration: theme.transitions.duration.leavingScreen,
							}),
						// Only shift content on desktop when sidebar is open
						marginLeft: !isMobile && open && !props.kiosk ? '240px' : 0,
						// Ensure scroll works during transitions
						willChange: 'margin',
						// Use GPU acceleration for smoother transitions
						transform: 'translateZ(0)',
					}}
				>
					{/* Offline indicator icon - fixed position, doesn't take up layout space */}
					<Fade in={!isOnline}>
						<Tooltip
							title="You're offline - viewing cached data. Device controls are disabled."
							arrow
						>
							<IconButton
								sx={{
									position: 'fixed',
									top: props.kiosk ? 16 : `${TOP_BAR_HEIGHT + 16}px`,
									right: 16,
									zIndex: 1300,
									backgroundColor: 'warning.main',
									color: 'warning.contrastText',
									'&:hover': {
										backgroundColor: 'warning.dark',
									},
									opacity: !isOnline ? 1 : 0,
									pointerEvents: !isOnline ? 'auto' : 'none',
									transition: 'opacity 0.3s ease-in-out',
								}}
								size="small"
							>
								<WifiOff />
							</IconButton>
						</Tooltip>
					</Fade>
					<Box key={props.currentTab}>{props.children}</Box>
				</Box>
			</Box>
		</ThemeProvider>
	);
};
