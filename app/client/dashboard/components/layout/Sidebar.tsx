import {
	DeviceHub as DeviceHubIcon,
	Settings as SettingsIcon,
	Cloud as CloudIcon,
	Lightbulb as LightbulbIcon,
	Home as HomeIcon,
	SmartToy as SmartToyIcon,
	MovieFilter as MovieFilterIcon,
} from '@mui/icons-material';
import {
	Drawer,
	List,
	ListItemButton,
	ListItemIcon,
	ListItemText,
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
	const menuItems = [
		{ text: 'Home', icon: <HomeIcon />, id: SidebarTab.HOME },
		{ text: 'Scenes', icon: <MovieFilterIcon />, id: SidebarTab.SCENES },
		{ text: 'Settings', icon: <SettingsIcon />, id: SidebarTab.SETTINGS },
		{ text: 'Devices', icon: <DeviceHubIcon />, id: SidebarTab.DEVICES }, // Updated icon for Matter
		{ text: 'eWeLink', icon: <CloudIcon />, id: SidebarTab.EWELINK },
		{ text: 'WLED', icon: <LightbulbIcon />, id: SidebarTab.WLED },
		{ text: 'MCP', icon: <SmartToyIcon />, id: SidebarTab.MCP },
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
				{menuItems.map((item) => (
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
			</List>
		</StyledDrawer>
	);
};

export enum SidebarTab {
	HOME = 'home',
	SCENES = 'scenes',
	SETTINGS = 'settings',
	DEVICES = 'devices',
	EWELINK = 'ewelink',
	WLED = 'wled',
	MCP = 'mcp',
}
