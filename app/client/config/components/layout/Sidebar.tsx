import {
	DeviceHub as DeviceHubIcon,
	Settings as SettingsIcon,
	Storage as StorageIcon,
	Cloud as CloudIcon,
	Lightbulb as LightbulbIcon,
} from '@mui/icons-material';
import {
	Drawer,
	List,
	ListItemButton,
	ListItemIcon,
	ListItemText,
	styled,
} from '@mui/material';
import * as React from 'react';

const StyledDrawer = styled(Drawer)(({ theme }) => ({
	'& .MuiDrawer-paper': {
		position: 'relative',
		whiteSpace: 'nowrap',
		width: 240,
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
	currentTab: string | SidebarTab;
	onTabChange: (tab: SidebarTab) => void;
}

export const Sidebar = (props: SidebarProps): JSX.Element => {
	const menuItems = [
		{ text: 'Switch', icon: <StorageIcon />, id: SidebarTab.SWITCH },
		{ text: 'Settings', icon: <SettingsIcon />, id: SidebarTab.SETTINGS },
		{ text: 'Devices', icon: <DeviceHubIcon />, id: SidebarTab.DEVICES }, // Updated icon for Matter
		{ text: 'eWeLink', icon: <CloudIcon />, id: SidebarTab.EWELINK },
		{ text: 'WLED', icon: <LightbulbIcon />, id: SidebarTab.WLED },
	];

	return (
		<StyledDrawer variant="persistent" anchor="left" open={props.open}>
			<List>
				{menuItems.map((item) => (
					<ListItemButton
						key={item.id}
						// eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
						selected={props.currentTab === item.id}
						onClick={() => props.onTabChange(item.id)}
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
	SWITCH = 'switch',
	SETTINGS = 'settings',
	DEVICES = 'devices',
	EWELINK = 'ewelink',
	WLED = 'wled',
}
