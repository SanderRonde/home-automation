import { AppBar, IconButton, Toolbar, Typography, styled } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import type { SidebarTab } from './Sidebar';
import React from 'react';

const StyledAppBar = styled(AppBar)(({ theme }) => ({
	backgroundColor: theme.palette.background.paper,
	borderBottom: `1px solid ${theme.palette.divider}`,
}));

interface TopBarProps {
	open: boolean;
	setOpen: (open: boolean) => void;
	currentTab: string | SidebarTab;
}

const getTabDisplayName = (tab: string | SidebarTab): string => {
	switch (tab) {
		case 'home':
			return 'Home';
		case 'temperature':
			return 'Temperature';
		case 'energy-usage':
			return 'Energy Usage';
		case 'settings':
			return 'Settings';
		case 'devices':
			return 'Devices';
		case 'ewelink':
			return 'eWeLink';
		case 'wled':
			return 'WLED';
		case 'temperature-config':
			return 'Temperature Config';
		case 'homewizard':
			return 'HomeWizard';
		default:
			return 'Home Automation';
	}
};

export const TopBar = (props: TopBarProps): JSX.Element => {
	return (
		<StyledAppBar position="fixed">
			<Toolbar sx={{ height: TOP_BAR_HEIGHT }}>
				<IconButton
					color="inherit"
					aria-label="toggle drawer"
					onClick={() => props.setOpen(!props.open)}
					edge="start"
					sx={{ mr: 2 }}
				>
					<MenuIcon />
				</IconButton>
				<Typography variant="h6" noWrap component="div">
					{getTabDisplayName(props.currentTab)}
				</Typography>
			</Toolbar>
		</StyledAppBar>
	);
};

export const TOP_BAR_HEIGHT = 64;
