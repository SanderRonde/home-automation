import * as Icons from '@mui/icons-material';
import React from 'react';

export const getClusterIcon = (
	iconName?: string
): React.ReactElement | null => {
	// Use the icon name provided by the backend
	if (iconName) {
		const IconComponent = (Icons as Record<string, React.ComponentType>)[
			iconName
		];
		if (IconComponent) {
			return <IconComponent />;
		}
	}

	return null;
};
