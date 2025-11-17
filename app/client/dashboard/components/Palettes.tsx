import {
	Box,
	Card,
	CardContent,
	Typography,
	IconButton,
	Button,
	CircularProgress,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import { PaletteCreateModal } from './PaletteCreateModal';
import type { Palette } from '../../../../types/palette';
import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../lib/fetch';

export const Palettes = (): JSX.Element => {
	const [palettes, setPalettes] = useState<Palette[]>([]);
	const [loading, setLoading] = useState(true);
	const [modalOpen, setModalOpen] = useState(false);
	const [editingPalette, setEditingPalette] = useState<Palette | undefined>(undefined);

	const loadPalettes = async () => {
		try {
			const response = await apiGet('device', '/palettes/list', {});
			if (response.ok) {
				const data = await response.json();
				setPalettes(data.palettes);
			}
		} catch (error) {
			console.error('Failed to load palettes:', error);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		void loadPalettes();
	}, []);

	const handleCreatePalette = () => {
		setEditingPalette(undefined);
		setModalOpen(true);
	};

	const handleEditPalette = (palette: Palette) => {
		setEditingPalette(palette);
		setModalOpen(true);
	};

	const handleSavePalette = async (paletteData: Omit<Palette, 'id'>) => {
		try {
			if (editingPalette) {
				// Update existing palette
				const response = await apiPost(
					'device',
					'/palettes/:paletteId/update',
					{ paletteId: editingPalette.id },
					paletteData
				);
				if (response.ok) {
					await loadPalettes();
					setModalOpen(false);
				}
			} else {
				// Create new palette
				const response = await apiPost('device', '/palettes/create', {}, paletteData);
				if (response.ok) {
					await loadPalettes();
					setModalOpen(false);
				}
			}
		} catch (error) {
			console.error('Failed to save palette:', error);
		}
	};

	const handleDeletePalette = async (paletteId: string, event: React.MouseEvent) => {
		event.stopPropagation();
		if (!confirm('Are you sure you want to delete this palette?')) {
			return;
		}

		try {
			const response = await apiPost('device', '/palettes/:paletteId/delete', {
				paletteId,
			});
			if (response.ok) {
				await loadPalettes();
			}
		} catch (error) {
			console.error('Failed to delete palette:', error);
		}
	};

	if (loading) {
		return (
			<Box
				sx={{
					display: 'flex',
					justifyContent: 'center',
					alignItems: 'center',
					height: '50vh',
				}}
			>
				<CircularProgress />
			</Box>
		);
	}

	return (
		<Box sx={{ p: { xs: 2, sm: 3 } }}>
			<Box
				sx={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					mb: 3,
				}}
			>
				<Typography variant="h4">Color Palettes</Typography>
				<Button
					variant="contained"
					startIcon={<AddIcon />}
					onClick={handleCreatePalette}
					sx={{ borderRadius: 2 }}
				>
					Create Palette
				</Button>
			</Box>

			<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
				{palettes.map((palette) => {
					return (
						<Card key={palette.id} sx={{ borderRadius: 2 }}>
							<CardContent>
								<Box
									sx={{
										display: 'flex',
										justifyContent: 'space-between',
										alignItems: 'flex-start',
									}}
								>
									<Box sx={{ flexGrow: 1 }}>
										<Typography variant="h6" sx={{ mb: 1 }}>
											{palette.name}
										</Typography>
										<Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
											{palette.colors.map((color, idx) => (
												<Box
													key={idx}
													sx={{
														width: 40,
														height: 40,
														backgroundColor: color,
														borderRadius: 1,
														border: '1px solid',
														borderColor: 'divider',
													}}
												/>
											))}
											<Typography
												variant="caption"
												sx={{ color: 'text.secondary', ml: 1 }}
											>
												{palette.colors.length} color
												{palette.colors.length !== 1 ? 's' : ''}
											</Typography>
										</Box>
									</Box>
									<Box sx={{ display: 'flex', gap: 1 }}>
										<IconButton
											size="small"
											onClick={() => handleEditPalette(palette)}
											sx={{ color: 'primary.main' }}
										>
											<EditIcon />
										</IconButton>
										<IconButton
											size="small"
											onClick={(e) => handleDeletePalette(palette.id, e)}
											sx={{ color: 'error.main' }}
										>
											<DeleteIcon />
										</IconButton>
									</Box>
								</Box>
							</CardContent>
						</Card>
					);
				})}

				{palettes.length === 0 && (
					<Typography
						variant="body1"
						sx={{ color: 'text.secondary', textAlign: 'center', mt: 4 }}
					>
						No palettes created yet. Create a palette to define color schemes for your
						lights.
					</Typography>
				)}
			</Box>

			<PaletteCreateModal
				open={modalOpen}
				onClose={() => setModalOpen(false)}
				onSave={handleSavePalette}
				palette={editingPalette}
			/>
		</Box>
	);
};
