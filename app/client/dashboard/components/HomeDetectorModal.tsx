import {
	Box,
	Button,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	IconButton,
	TextField,
	Typography,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import type { Host } from '../../../server/modules/home-detector/routing';
import React, { useState, useEffect } from 'react';

interface HomeDetectorModalProps {
	open: boolean;
	onClose: () => void;
	onSave: (host: { name: string; ips: string[] }) => Promise<void>;
	host?: Host;
}

export const HomeDetectorModal = React.memo((props: HomeDetectorModalProps): JSX.Element => {
	const [name, setName] = useState('');
	const [ips, setIps] = useState<string[]>(['']);

	useEffect(() => {
		if (props.open) {
			if (props.host) {
				setName(props.host.name);
				setIps(props.host.ips.length > 0 ? props.host.ips : ['']);
			} else {
				setName('');
				setIps(['']);
			}
		}
	}, [props.open, props.host]);

	const handleSave = async () => {
		if (name.trim() === '') {
			alert('Please enter a host name');
			return;
		}

		const validIps = ips.filter((ip) => ip.trim() !== '');
		if (validIps.length === 0) {
			alert('Please enter at least one IP address');
			return;
		}

		await props.onSave({
			name: name.trim(),
			ips: validIps,
		});
	};

	const handleIpChange = (index: number, value: string) => {
		const newIps = [...ips];
		newIps[index] = value;
		setIps(newIps);
	};

	const handleAddIp = () => {
		setIps([...ips, '']);
	};

	const handleRemoveIp = (index: number) => {
		if (ips.length > 1) {
			setIps(ips.filter((_, i) => i !== index));
		}
	};

	return (
		<Dialog
			open={props.open}
			onClose={props.onClose}
			maxWidth="sm"
			fullWidth
			PaperProps={{ sx: { borderRadius: 2 } }}
		>
			<DialogTitle>{props.host ? 'Edit Host' : 'Add New Host'}</DialogTitle>
			<DialogContent>
				<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
					<TextField
						label="Host Name"
						value={name}
						onChange={(e) => setName(e.target.value)}
						fullWidth
						required
						helperText="e.g., Phone, Laptop, Tablet"
					/>

					<Box>
						<Typography variant="subtitle2" sx={{ mb: 1 }}>
							IP Addresses:
						</Typography>
						{ips.map((ip, index) => (
							<Box
								key={index}
								sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}
							>
								<TextField
									value={ip}
									onChange={(e) => handleIpChange(index, e.target.value)}
									placeholder="192.168.1.100"
									fullWidth
									size="small"
								/>
								<IconButton
									size="small"
									onClick={() => handleRemoveIp(index)}
									disabled={ips.length === 1}
									sx={{ color: 'error.main' }}
								>
									<DeleteIcon />
								</IconButton>
							</Box>
						))}
						<Button
							startIcon={<AddIcon />}
							onClick={handleAddIp}
							size="small"
							sx={{ mt: 1 }}
						>
							Add IP Address
						</Button>
					</Box>

					<Typography variant="caption" sx={{ color: 'text.secondary' }}>
						The host is considered "home" if any of the IP addresses responds to ping.
					</Typography>
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
});
HomeDetectorModal.displayName = 'HomeDetectorModal';
