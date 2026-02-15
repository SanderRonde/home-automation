import {
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Button,
	TextField,
	Box,
	IconButton,
	Typography,
	useMediaQuery,
	useTheme,
	Card,
	CardContent,
	CircularProgress,
	LinearProgress,
	Chip,
	FormControl,
	InputLabel,
	Select,
	MenuItem,
	Slider,
} from '@mui/material';
import {
	Close as CloseIcon,
	Add as AddIcon,
	Edit as EditIcon,
	Delete as DeleteIcon,
} from '@mui/icons-material';
import type { FilamentSpool, FilamentType } from '../../../../types/filament';
import React, { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiDelete } from '../../lib/fetch';
import { FILAMENT_TYPES } from '../../../../types/filament';

interface FilamentModalProps {
	open: boolean;
	onClose: () => void;
}

export const FilamentModal = (props: FilamentModalProps): JSX.Element => {
	const theme = useTheme();
	const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

	const [spools, setSpools] = useState<FilamentSpool[]>([]);
	const [loading, setLoading] = useState(true);
	const [formOpen, setFormOpen] = useState(false);
	const [editingSpool, setEditingSpool] = useState<FilamentSpool | undefined>(undefined);
	const [saving, setSaving] = useState(false);
	const [filterType, setFilterType] = useState<FilamentType | ''>('');

	const loadSpools = useCallback(async () => {
		try {
			const response = await apiGet('filament', '/spools/list', {});
			if (response.ok) {
				const data = await response.json();
				setSpools(data.spools ?? []);
			}
		} catch (error) {
			console.error('Failed to load filament spools:', error);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (props.open) {
			setLoading(true);
			void loadSpools();
		}
	}, [props.open, loadSpools]);

	const filteredSpools = filterType === '' ? spools : spools.filter((s) => s.type === filterType);

	const handleAdd = (): void => {
		setEditingSpool(undefined);
		setFormOpen(true);
	};

	const handleEdit = (spool: FilamentSpool): void => {
		setEditingSpool(spool);
		setFormOpen(true);
	};

	const handleDelete = async (spool: FilamentSpool): Promise<void> => {
		if (!window.confirm(`Delete filament "${spool.type} (${spool.color})"?`)) {
			return;
		}
		try {
			const response = await apiDelete('filament', '/spools/:spoolId/delete', {
				spoolId: spool.id,
			});
			if (response.ok) {
				void loadSpools();
			}
		} catch (error) {
			console.error('Failed to delete spool:', error);
		}
	};

	const handleFormClose = (): void => {
		setFormOpen(false);
		setEditingSpool(undefined);
	};

	return (
		<>
			<Dialog
				open={props.open}
				onClose={props.onClose}
				maxWidth="md"
				fullWidth
				fullScreen={isMobile}
			>
				<DialogTitle>
					<Box
						sx={{
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between',
						}}
					>
						<Typography variant="h6">Filament Inventory</Typography>
						{isMobile && (
							<IconButton onClick={props.onClose}>
								<CloseIcon />
							</IconButton>
						)}
					</Box>
				</DialogTitle>
				<DialogContent>
					<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, py: 1 }}>
						<Box
							sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}
						>
							<FormControl size="small" sx={{ minWidth: 120 }}>
								<InputLabel>Type</InputLabel>
								<Select
									value={filterType}
									label="Type"
									onChange={(e) =>
										setFilterType(e.target.value as FilamentType | '')
									}
								>
									<MenuItem value="">All</MenuItem>
									{FILAMENT_TYPES.map((t) => (
										<MenuItem key={t} value={t}>
											{t}
										</MenuItem>
									))}
								</Select>
							</FormControl>
							<Button
								variant="contained"
								startIcon={<AddIcon />}
								onClick={handleAdd}
								sx={{ ml: 'auto' }}
							>
								Add Filament
							</Button>
						</Box>

						{loading ? (
							<Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
								<CircularProgress />
							</Box>
						) : (
							<Box
								sx={{
									display: 'grid',
									gridTemplateColumns: {
										xs: '1fr',
										sm: 'repeat(2, 1fr)',
									},
									gap: 2,
								}}
							>
								{filteredSpools.map((spool) => (
									<SpoolCard
										key={spool.id}
										spool={spool}
										onEdit={() => handleEdit(spool)}
										onDelete={() => handleDelete(spool)}
									/>
								))}
							</Box>
						)}

						{!loading && filteredSpools.length === 0 && (
							<Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
								{spools.length === 0
									? 'No filament spools. Add one to get started.'
									: 'No spools match the selected type.'}
							</Typography>
						)}
					</Box>
				</DialogContent>
				<DialogActions sx={{ px: 2, pb: 2 }}>
					<Button onClick={props.onClose}>Close</Button>
				</DialogActions>
			</Dialog>

			<SpoolFormDialog
				open={formOpen}
				onClose={handleFormClose}
				existingSpool={editingSpool}
				onSaved={() => {
					handleFormClose();
					void loadSpools();
				}}
				saving={saving}
				setSaving={setSaving}
			/>
		</>
	);
};

interface SpoolCardProps {
	spool: FilamentSpool;
	onEdit: () => void;
	onDelete: () => void;
}

const SpoolCard = (props: SpoolCardProps): JSX.Element => {
	const luminance =
		(0.299 * parseInt(props.spool.color.slice(1, 3), 16) +
			0.587 * parseInt(props.spool.color.slice(3, 5), 16) +
			0.114 * parseInt(props.spool.color.slice(5, 7), 16)) /
		255;
	const textColor = luminance > 0.5 ? '#000' : '#fff';

	return (
		<Card variant="outlined" sx={{ overflow: 'hidden' }}>
			<CardContent sx={{ p: 2 }}>
				<Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
					<Box
						sx={{
							width: 56,
							height: 56,
							borderRadius: 2,
							backgroundColor: props.spool.color,
							color: textColor,
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							flexShrink: 0,
							border: '1px solid',
							borderColor: 'divider',
						}}
					/>
					<Box sx={{ flex: 1, minWidth: 0 }}>
						<Box
							sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
						>
							<Chip label={props.spool.type} size="small" />
							{props.spool.specialProperties && (
								<Chip
									label={props.spool.specialProperties}
									size="small"
									variant="outlined"
								/>
							)}
						</Box>
						<Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
							{props.spool.currentWeight}g / {props.spool.maxWeight}g (
							{props.spool.percentage.toFixed(1)}%)
						</Typography>
						<LinearProgress
							variant="determinate"
							value={props.spool.percentage}
							sx={{ mt: 1, height: 6, borderRadius: 1 }}
							color={props.spool.percentage < 20 ? 'error' : 'primary'}
						/>
					</Box>
					<Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
						<IconButton size="small" onClick={props.onEdit} aria-label="Edit">
							<EditIcon fontSize="small" />
						</IconButton>
						<IconButton size="small" onClick={props.onDelete} aria-label="Delete">
							<DeleteIcon fontSize="small" color="error" />
						</IconButton>
					</Box>
				</Box>
			</CardContent>
		</Card>
	);
};

export interface SpoolFormDialogProps {
	open: boolean;
	onClose: () => void;
	existingSpool?: FilamentSpool;
	onSaved: () => void;
	saving: boolean;
	setSaving: (v: boolean) => void;
}

export const SpoolFormDialog = (props: SpoolFormDialogProps): JSX.Element => {
	const [color, setColor] = useState('#808080');
	const [type, setType] = useState<FilamentType>('PLA');
	const [specialProperties, setSpecialProperties] = useState('');
	const [maxWeight, setMaxWeight] = useState(1000);
	const [percentage, setPercentage] = useState(100);

	React.useEffect(() => {
		if (props.open) {
			if (props.existingSpool) {
				setColor(props.existingSpool.color);
				setType(props.existingSpool.type);
				setSpecialProperties(props.existingSpool.specialProperties ?? '');
				setMaxWeight(props.existingSpool.maxWeight);
				setPercentage(props.existingSpool.percentage);
			} else {
				setColor('#808080');
				setType('PLA');
				setSpecialProperties('');
				setMaxWeight(1000);
				setPercentage(100);
			}
		}
	}, [props.open, props.existingSpool]);

	const handleSave = async (): Promise<void> => {
		props.setSaving(true);
		try {
			if (props.existingSpool) {
				const response = await apiPost(
					'filament',
					'/spools/:spoolId/update',
					{ spoolId: props.existingSpool.id },
					{
						color,
						type,
						specialProperties: specialProperties || undefined,
						maxWeight,
						percentage,
					}
				);
				if (response.ok) {
					props.onSaved();
				}
			} else {
				const response = await apiPost(
					'filament',
					'/spools/create',
					{},
					{
						color,
						type,
						specialProperties: specialProperties || undefined,
						maxWeight,
						percentage,
					}
				);
				if (response.ok) {
					props.onSaved();
				}
			}
		} catch (error) {
			console.error('Failed to save spool:', error);
		} finally {
			props.setSaving(false);
		}
	};

	return (
		<Dialog open={props.open} onClose={props.onClose} maxWidth="xs" fullWidth>
			<DialogTitle>{props.existingSpool ? 'Edit Filament' : 'Add Filament'}</DialogTitle>
			<DialogContent>
				<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
					<Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
						<TextField
							label="Color"
							type="color"
							value={color}
							onChange={(e) => setColor(e.target.value)}
							sx={{ minWidth: 80 }}
							inputProps={{ style: { height: 40, padding: 0 } }}
						/>
						<TextField
							label="Hex"
							value={color}
							onChange={(e) => setColor(e.target.value)}
							size="small"
							sx={{ flex: 1 }}
						/>
					</Box>
					<FormControl fullWidth size="small">
						<InputLabel>Type</InputLabel>
						<Select
							value={type}
							label="Type"
							onChange={(e) => setType(e.target.value as FilamentType)}
						>
							{FILAMENT_TYPES.map((t) => (
								<MenuItem key={t} value={t}>
									{t}
								</MenuItem>
							))}
						</Select>
					</FormControl>
					<TextField
						label="Special (e.g. flexible, stone-like)"
						value={specialProperties}
						onChange={(e) => setSpecialProperties(e.target.value)}
						size="small"
						fullWidth
					/>
					<TextField
						label="Max weight (g)"
						type="number"
						value={maxWeight}
						onChange={(e) => {
							const v = Number(e.target.value);
							if (!Number.isNaN(v) && v > 0) {
								setMaxWeight(v);
							}
						}}
						inputProps={{ min: 1, step: 1 }}
						size="small"
						fullWidth
					/>
					<Box>
						<Typography gutterBottom>Remaining: {percentage.toFixed(1)}%</Typography>
						<Slider
							value={percentage}
							onChange={(_, value) =>
								setPercentage(Array.isArray(value) ? value[0] : value)
							}
							min={0}
							max={100}
							step={0.5}
							valueLabelDisplay="auto"
							valueLabelFormat={(v) => `${v}%`}
						/>
						<Typography variant="caption" color="text.secondary">
							~{Math.round((percentage / 100) * maxWeight)}g left
						</Typography>
					</Box>
				</Box>
			</DialogContent>
			<DialogActions>
				<Button onClick={props.onClose} disabled={props.saving}>
					Cancel
				</Button>
				<Button
					onClick={() => void handleSave()}
					variant="contained"
					disabled={props.saving}
				>
					{props.saving ? (
						<CircularProgress size={24} />
					) : props.existingSpool ? (
						'Save'
					) : (
						'Add'
					)}
				</Button>
			</DialogActions>
		</Dialog>
	);
};
