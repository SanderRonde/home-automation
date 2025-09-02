import {
	Drawer,
	List,
	ListItemButton,
	ListItemIcon,
	ListItemText,
	styled,
} from '@mui/material';
import DeviceHubIcon from '@mui/icons-material/DeviceHub';
import SettingsIcon from '@mui/icons-material/Settings';
import StorageIcon from '@mui/icons-material/Storage';
import CloudIcon from '@mui/icons-material/Cloud';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import React from 'react';

const DRAWER_WIDTH = 240;

const StyledDrawer = styled(Drawer)(({ theme }) => ({
	width: DRAWER_WIDTH,
	flexShrink: 0,
	'& .MuiDrawer-paper': {
		width: DRAWER_WIDTH,
		boxSizing: 'border-box',
		marginTop: '64px',
	},
	'& .MuiListItem-root': {
		marginBottom: theme.spacing(0.5),
		marginLeft: theme.spacing(1),
		marginRight: theme.spacing(1),
		borderRadius: theme.shape.borderRadius,
		'&.Mui-selected': {
			backgroundColor: 'rgba(255, 23, 68, 0.15)',
			'&:hover': {
				backgroundColor: 'rgba(255, 23, 68, 0.25)',
			},
			'& .MuiListItemIcon-root': {
				color: theme.palette.primary.light,
			},
		},
		'&:hover': {
			backgroundColor: 'rgba(255, 255, 255, 0.05)',
		},
	},
}));

interface SidebarProps {
	open: boolean;
	currentTab: string | SidebarTab;
	onTabChange: (tab: SidebarTab) => void;
}

export const Sidebar = (props: SidebarProps): JSX.Element => {
	const menuItems = [
		{ text: 'KeyVal', icon: <StorageIcon />, id: SidebarTab.KEYVAL },
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
	KEYVAL = 'keyval',
	SETTINGS = 'settings',
	DEVICES = 'devices',
	EWELINK = 'ewelink',
	WLED = 'wled',
}
