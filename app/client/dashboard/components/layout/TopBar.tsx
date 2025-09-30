import { AppBar, IconButton, Toolbar, Typography, styled } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import React from 'react';

const StyledAppBar = styled(AppBar)(({ theme }) => ({
	backgroundColor: theme.palette.background.paper,
	borderBottom: `1px solid ${theme.palette.divider}`,
}));

interface TopBarProps {
	open: boolean;
	setOpen: (open: boolean) => void;
}

export const TopBar = (props: TopBarProps): JSX.Element => {
	return (
		<StyledAppBar position="fixed">
			<Toolbar>
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
					Home Automation
				</Typography>
			</Toolbar>
		</StyledAppBar>
	);
}
