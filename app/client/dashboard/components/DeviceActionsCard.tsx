import { cardVariants, staggerContainer, staggerItem, smoothSpring } from '../../lib/animations';
import type { DashboardDeviceClusterActions } from '../../../server/modules/device/routing';
import { Box, Card, CardContent, Typography, Chip, CircularProgress } from '@mui/material';
import { motion } from 'framer-motion';
import React from 'react';

interface DeviceActionsCardProps {
	actionsCluster: DashboardDeviceClusterActions;
	executingActionId: number | null;
	onExecuteAction: (actionId: number) => void;
}

export const DeviceActionsCard = (props: DeviceActionsCardProps): JSX.Element => {
	return (
		<motion.div
			variants={cardVariants}
			initial="initial"
			animate="animate"
			transition={{ delay: 0.5 }}
		>
			<Card
				sx={{
					mt: 3,
					borderRadius: 3,
					boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
					background: 'linear-gradient(135deg, #2a2a2a 0%, #353535 100%)',
				}}
			>
				<CardContent sx={{ p: { xs: 2, sm: 3 } }}>
					<Typography
						variant="h6"
						gutterBottom
						sx={{
							fontWeight: 600,
							letterSpacing: '-0.01em',
						}}
					>
						Actions
					</Typography>
					<motion.div variants={staggerContainer} initial="initial" animate="animate">
						<Box
							sx={{
								display: 'flex',
								flexDirection: 'column',
								gap: 2,
								mt: 2,
							}}
						>
							{props.actionsCluster.actions.map((action) => {
								const isActive = action.id === props.actionsCluster.activeActionId;
								const isExecuting = action.id === props.executingActionId;

								return (
									<motion.div
										key={action.id}
										variants={staggerItem}
										whileHover={isExecuting ? {} : { scale: 1.02, x: 4 }}
										whileTap={isExecuting ? {} : { scale: 0.98 }}
										transition={smoothSpring}
									>
										<Box
											onClick={() =>
												!isExecuting &&
												void props.onExecuteAction(action.id)
											}
											sx={{
												p: 2.5,
												borderRadius: 2,
												border: '2px solid',
												borderColor: isActive ? 'primary.main' : 'divider',
												backgroundColor: isActive
													? 'rgba(25, 118, 210, 0.08)'
													: 'background.paper',
												cursor: isExecuting ? 'wait' : 'pointer',
												boxShadow: isActive
													? '0 2px 8px rgba(25, 118, 210, 0.2)'
													: '0 1px 3px rgba(0,0,0,0.05)',
												transition: 'all 0.2s',
												'&:hover': {
													backgroundColor: isActive
														? 'rgba(25, 118, 210, 0.12)'
														: 'rgba(0, 0, 0, 0.04)',
													borderColor: 'primary.main',
													boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
												},
											}}
										>
											<Box
												sx={{
													display: 'flex',
													alignItems: 'center',
													justifyContent: 'space-between',
												}}
											>
												<Typography
													variant="body1"
													sx={{
														fontWeight: isActive ? 600 : 500,
													}}
												>
													{action.name}
												</Typography>
												{isActive && (
													<Chip
														label="Active"
														color="primary"
														size="small"
														sx={{
															fontWeight: 600,
														}}
													/>
												)}
												{isExecuting && <CircularProgress size={20} />}
											</Box>
										</Box>
									</motion.div>
								);
							})}
						</Box>
					</motion.div>
				</CardContent>
			</Card>
		</motion.div>
	);
};
