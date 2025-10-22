import {
	Box,
	Button,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	IconButton,
	TextField,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import type { Palette } from '../../../../types/palette';
import React, { useState, useEffect } from 'react';

interface PaletteCreateModalProps {
	open: boolean;
	onClose: () => void;
	onSave: (palette: Omit<Palette, 'id'>) => Promise<void>;
	palette?: Palette;
}

export const PaletteCreateModal = (props: PaletteCreateModalProps): JSX.Element => {
	const [name, setName] = useState('');
	const [colors, setColors] = useState<string[]>(['#ff5733']);

	useEffect(() => {
		if (props.open) {
			if (props.palette) {
				setName(props.palette.name);
				setColors(props.palette.colors);
			} else {
				setName('');
				setColors(['#ff5733']);
			}
		}
	}, [props.open, props.palette]);

	const handleSave = async () => {
		if (name.trim() === '') {
			alert('Please enter a palette name');
			return;
		}

		if (colors.length === 0) {
			alert('Please add at least one color');
			return;
		}

		await props.onSave({
			name: name.trim(),
			colors,
		});
	};

	const handleAddColor = () => {
		setColors([...colors, '#ff5733']);
	};

	const handleRemoveColor = (index: number) => {
		if (colors.length > 1) {
			setColors(colors.filter((_, i) => i !== index));
		}
	};

	const handleColorChange = (index: number, value: string) => {
		const newColors = [...colors];
		newColors[index] = value;
		setColors(newColors);
	};

	return (
		<Dialog
			open={props.open}
			onClose={props.onClose}
			maxWidth="sm"
			fullWidth
			PaperProps={{ sx: { borderRadius: 2 } }}
		>
			<DialogTitle>{props.palette ? 'Edit Palette' : 'Create New Palette'}</DialogTitle>
			<DialogContent>
				<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
					<TextField
						label="Palette Name"
						value={name}
						onChange={(e) => setName(e.target.value)}
						fullWidth
						required
					/>

					<Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
						{colors.map((color, index) => (
							<Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
								<Box
									sx={{
										width: 48,
										height: 48,
										backgroundColor: color,
										borderRadius: 1,
										border: '1px solid',
										borderColor: 'divider',
										cursor: 'pointer',
										position: 'relative',
										overflow: 'hidden',
									}}
								>
									<input
										type="color"
										value={color}
										onChange={(e) => handleColorChange(index, e.target.value)}
										style={{
											position: 'absolute',
											width: '100%',
											height: '100%',
											border: 'none',
											cursor: 'pointer',
											opacity: 0,
										}}
									/>
								</Box>
								<TextField
									value={color}
									onChange={(e) => handleColorChange(index, e.target.value)}
									size="small"
									fullWidth
									placeholder="#ff5733"
								/>
								<IconButton
									onClick={() => handleRemoveColor(index)}
									disabled={colors.length === 1}
									size="small"
									sx={{ color: 'error.main' }}
								>
									<DeleteIcon />
								</IconButton>
							</Box>
						))}
					</Box>

					<Button
						startIcon={<AddIcon />}
						onClick={handleAddColor}
						variant="outlined"
						sx={{ mt: 1 }}
					>
						Add Color
					</Button>
				</Box>
			</DialogContent>
			<DialogActions sx={{ p: 2 }}>
				<Button onClick={props.onClose}>Cancel</Button>
				<Button onClick={handleSave} variant="contained">
					Save
				</Button>
			</DialogActions>
		</Dialog>
	);
};
