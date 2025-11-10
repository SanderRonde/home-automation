import {
	DeviceHub as DeviceHubIcon,
	Cloud as CloudIcon,
	Lightbulb as LightbulbIcon,
	Home as HomeIcon,
	SmartToy as SmartToyIcon,
	MovieFilter as MovieFilterIcon,
	GroupWork as GroupWorkIcon,
	Palette as PaletteIcon,
	Sensors as SensorsIcon,
	Webhook as WebhookIcon,
	Alarm as AlarmIcon,
	Notifications as NotificationsIcon,
} from '@mui/icons-material';
import {
	Drawer,
	List,
	ListItemButton,
	ListItemIcon,
	ListItemText,
	ListSubheader,
	Divider,
	styled,
	Toolbar,
} from '@mui/material';
import * as React from 'react';

const drawerWidth = 240;

const StyledDrawer = styled(Drawer)(({ theme }) => ({
	'& .MuiDrawer-paper': {
		whiteSpace: 'nowrap',
		width: drawerWidth,
		transition: theme.transitions.create('width', {
			easing: theme.transitions.easing.sharp,
			duration: theme.transitions.duration.enteringScreen,
		}),
		boxSizing: 'border-box',
		backgroundColor: theme.palette.background.paper,
		borderRight: `1px solid ${theme.palette.divider}`,
	},
}));

export interface SidebarProps {
	open: boolean;
	isMobile: boolean;
	onClose: () => void;
	currentTab: string | SidebarTab;
	onTabChange: (tab: SidebarTab) => void;
}

export const Sidebar = (props: SidebarProps): JSX.Element => {
	const menuCategories = [
		{
			label: 'Dashboard',
			items: [{ text: 'Home', icon: <HomeIcon />, id: SidebarTab.HOME }],
		},
		{
			label: 'Scene Management',
			items: [
				{ text: 'Scenes', icon: <MovieFilterIcon />, id: SidebarTab.SCENES },
				{ text: 'Groups', icon: <GroupWorkIcon />, id: SidebarTab.GROUPS },
				{ text: 'Palettes', icon: <PaletteIcon />, id: SidebarTab.PALETTES },
			],
		},
		{
			label: 'Automation',
			items: [
				{ text: 'Webhooks', icon: <WebhookIcon />, id: SidebarTab.WEBHOOKS },
				{ text: 'Home Detection', icon: <SensorsIcon />, id: SidebarTab.HOME_DETECTOR },
				{ text: 'Wakelight', icon: <AlarmIcon />, id: SidebarTab.WAKELIGHT },
				{
					text: 'Notifications',
					icon: <NotificationsIcon />,
					id: SidebarTab.NOTIFICATIONS,
				},
			],
		},
		{
			label: 'Devices',
			items: [
				{ text: 'Devices', icon: <DeviceHubIcon />, id: SidebarTab.DEVICES },
				{ text: 'eWeLink', icon: <CloudIcon />, id: SidebarTab.EWELINK },
				{ text: 'LED Sources', icon: <LightbulbIcon />, id: SidebarTab.LED_SOURCES },
			],
		},
		{
			label: 'Advanced',
			items: [{ text: 'AI', icon: <SmartToyIcon />, id: SidebarTab.AI }],
		},
	];

	const handleTabChange = (tab: SidebarTab) => {
		props.onTabChange(tab);
		// Close sidebar on mobile when item is selected
		if (props.isMobile) {
			props.onClose();
		}
	};

	return (
		<StyledDrawer
			variant={props.isMobile ? 'temporary' : 'persistent'}
			anchor="left"
			open={props.open}
			onClose={props.onClose}
			ModalProps={{
				keepMounted: true, // Better mobile performance
			}}
		>
			<Toolbar /> {/* Spacer for TopBar */}
			<List>
				{menuCategories.map((category, categoryIndex) => (
					<React.Fragment key={category.label}>
						<ListSubheader
							sx={{
								backgroundColor: 'transparent',
								fontSize: '0.75rem',
								fontWeight: 600,
								color: 'text.secondary',
								lineHeight: '32px',
								textTransform: 'uppercase',
								letterSpacing: '0.5px',
							}}
						>
							{category.label}
						</ListSubheader>
						{category.items.map((item) => (
							<ListItemButton
								key={item.id}
								// eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
								selected={props.currentTab === item.id}
								onClick={() => handleTabChange(item.id)}
								sx={{ cursor: 'pointer' }}
							>
								<ListItemIcon>{item.icon}</ListItemIcon>
								<ListItemText primary={item.text} />
							</ListItemButton>
						))}
						{categoryIndex < menuCategories.length - 1 && <Divider sx={{ my: 1 }} />}
					</React.Fragment>
				))}
			</List>
		</StyledDrawer>
	);
};

export enum SidebarTab {
	HOME = 'home',
	SCENES = 'scenes',
	GROUPS = 'groups',
	PALETTES = 'palettes',
	WEBHOOKS = 'webhooks',
	HOME_DETECTOR = 'home-detector',
	WAKELIGHT = 'wakelight',
	DEVICES = 'devices',
	EWELINK = 'ewelink',
	LED_SOURCES = 'led-sources',
	AI = 'ai',
	NOTIFICATIONS = 'notifications',
}
