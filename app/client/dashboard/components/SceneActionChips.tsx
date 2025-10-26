import type { DeviceListWithValuesResponse } from '../../../server/modules/device/routing';
import type { DeviceGroup } from '../../../../types/group';
import type { Palette } from '../../../../types/palette';
import { Http as HttpIcon } from '@mui/icons-material';
import type { Scene } from '../../../../types/scene';
import { Box, Chip } from '@mui/material';
import { IconComponent } from './icon';
import React from 'react';

interface SceneActionChipsProps {
	actions: Scene['actions'];
	devices: DeviceListWithValuesResponse;
	groups: DeviceGroup[];
	palettes: Palette[];
	getDeviceById: (deviceId: string) => DeviceListWithValuesResponse[number] | undefined;
	getGroupById: (groupId: string) => DeviceGroup | undefined;
}

export const SceneActionChips = (props: SceneActionChipsProps): JSX.Element => {
	return (
		<Box
			sx={{
				display: 'flex',
				flexWrap: 'wrap',
				gap: 0.5,
				mt: 1,
			}}
		>
			{props.actions.map((action, index) => {
				// Handle HTTP request actions
				if (action.cluster === 'http-request') {
					const httpAction = action.action as { url: string; method: 'GET' | 'POST' };
					const urlDisplay =
						httpAction.url.length > 30
							? `${httpAction.url.substring(0, 30)}...`
							: httpAction.url;

					return (
						<Chip
							key={`http-${index}`}
							icon={<HttpIcon sx={{ fontSize: 18 }} />}
							label={`HTTP ${httpAction.method}: ${urlDisplay}`}
							size="small"
							sx={{
								paddingLeft: '4px',
								paddingRight: '4px',
								backgroundColor: 'info.light',
								'& .MuiChip-label': {
									color: 'rgba(0, 0, 0, 0.87)',
								},
								'& .MuiChip-icon': {
									color: 'rgba(0, 0, 0, 0.6)',
								},
							}}
						/>
					);
				}

				// Handle group actions
				if (action.groupId) {
					const group = props.getGroupById(action.groupId);
					if (!group) {
						return null;
					}

					let cluster = null;
					for (const device of props.devices) {
						cluster = device.flatAllClusters.find((c) => c.name === action.cluster);
						if (cluster) {
							break;
						}
					}

					// Check if this is a palette action
					const isPaletteAction = 'paletteId' in action.action;
					const palette = isPaletteAction
						? props.palettes.find(
								(p) => p.id === (action.action as { paletteId: string }).paletteId
							)
						: null;

					const exclusionCount =
						'excludeDeviceIds' in action && action.excludeDeviceIds?.length
							? action.excludeDeviceIds.length
							: 0;

					return (
						<Box
							key={`${action.groupId}-${action.cluster}-${index}`}
							sx={{
								display: 'flex',
								gap: 0.5,
								alignItems: 'center',
							}}
						>
							<Chip
								icon={
									cluster?.icon ? (
										<IconComponent
											iconName={cluster.icon}
											sx={{
												fontSize: 18,
											}}
										/>
									) : undefined
								}
								label={
									<div
										style={{
											display: 'flex',
											alignItems: 'center',
											gap: 4,
											color: 'white',
										}}
									>
										{group.name}
										{exclusionCount > 0 && (
											<span
												style={{
													fontSize: '0.75em',
													opacity: 0.8,
												}}
											>
												({exclusionCount} excluded)
											</span>
										)}
										{palette && (
											<Box
												sx={{
													display: 'flex',
													gap: 0.25,
													alignItems: 'center',
												}}
											>
												{palette.colors.map((color, idx) => (
													<Box
														key={idx}
														sx={{
															width: 12,
															height: 12,
															backgroundColor: color,
															borderRadius: '50%',
															border: '1px solid black',
														}}
													/>
												))}
											</Box>
										)}
									</div>
								}
								size="small"
								sx={{
									paddingLeft: '4px',
									paddingRight: '4px',
									backgroundColor: 'primary.light',
									'& .MuiChip-label': {
										color: 'rgba(0, 0, 0, 0.87)',
									},
									'& .MuiChip-icon': {
										color: 'rgba(0, 0, 0, 0.6)',
									},
								}}
							/>
						</Box>
					);
				}

				// Handle device actions
				const device = props.getDeviceById(action.deviceId || '');
				if (!device) {
					return null;
				}

				const cluster = device.flatAllClusters.find((c) => c.name === action.cluster);

				return (
					<Chip
						key={`${action.deviceId}-${action.cluster}-${index}`}
						icon={
							cluster?.icon ? (
								<IconComponent
									iconName={cluster.icon}
									sx={{
										fontSize: 18,
									}}
								/>
							) : undefined
						}
						label={
							<div
								style={{
									color: 'white',
									display: 'flex',
									alignItems: 'center',
								}}
							>
								{device.name}
							</div>
						}
						size="small"
						sx={{
							paddingLeft: '4px',
							paddingRight: '4px',
							backgroundColor: device.roomColor ?? 'action.hover',
							'& .MuiChip-label': {
								color: 'rgba(0, 0, 0, 0.87)',
							},
							'& .MuiChip-icon': {
								color: 'rgba(0, 0, 0, 0.6)',
							},
						}}
					/>
				);
			})}
		</Box>
	);
};
