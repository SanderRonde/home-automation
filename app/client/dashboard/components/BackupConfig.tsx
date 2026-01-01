import {
	Box,
	Card,
	CardContent,
	Typography,
	Button,
	Alert,
	Stack,
	TextField,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	Paper,
	IconButton,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Checkbox,
	FormControlLabel,
	FormGroup,
	CircularProgress,
	Tooltip,
} from '@mui/material';
import { apiGet, apiPost, apiDelete } from '../../lib/fetch';
import DownloadIcon from '@mui/icons-material/Download';
import RestoreIcon from '@mui/icons-material/Restore';
import DeleteIcon from '@mui/icons-material/Delete';
import BackupIcon from '@mui/icons-material/Backup';
import React, { useState, useEffect } from 'react';
import SaveIcon from '@mui/icons-material/Save';
import { formatDistanceToNow } from 'date-fns';

interface BackupMetadata {
	id: string;
	timestamp: number;
	description: string;
	filePath: string;
	size: number;
	deviceCount: number;
	moduleCount: number;
	modules: string[];
}

interface BackupConfig {
	backupPath: string;
	intervalDays: number;
	retentionDays: number;
}

export const BackupConfig = (): JSX.Element => {
	const [backups, setBackups] = useState<readonly BackupMetadata[]>([]);
	const [config, setConfig] = useState<BackupConfig | null>(null);
	const [loading, setLoading] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [createDialogOpen, setCreateDialogOpen] = useState<boolean>(false);
	const [restoreDialogOpen, setRestoreDialogOpen] = useState<boolean>(false);
	const [selectedBackup, setSelectedBackup] = useState<BackupMetadata | null>(null);
	const [restoreSelection, setRestoreSelection] = useState<{
		modules: string[];
		restoreMatter: boolean;
	}>({
		modules: [],
		restoreMatter: false,
	});
	const [description, setDescription] = useState<string>('');
	const [creating, setCreating] = useState<boolean>(false);
	const [restoring, setRestoring] = useState<boolean>(false);
	const [showSettings, setShowSettings] = useState<boolean>(false);

	// Load backups and config on component mount
	useEffect(() => {
		void loadBackups();
		void loadConfig();
	}, []);

	const loadBackups = async () => {
		try {
			const response = await apiGet('backup', '/list', {});
			if (response.ok) {
				const data = await response.json();
				setBackups(data.backups);
			}
		} catch (err) {
			console.error('Failed to load backups:', err);
		}
	};

	const loadConfig = async () => {
		try {
			const response = await apiGet('backup', '/config', {});
			if (response.ok) {
				const data = await response.json();
				setConfig(data.config);
			}
		} catch (err) {
			console.error('Failed to load config:', err);
		}
	};

	const createBackup = async () => {
		setCreating(true);
		setError(null);
		setSuccess(null);

		try {
			const response = await apiPost(
				'backup',
				'/create',
				{},
				{
					description:
						description.trim() || `Manual backup - ${new Date().toISOString()}`,
				}
			);

			if (response.ok) {
				setSuccess('Backup created successfully');
				setDescription('');
				setCreateDialogOpen(false);
				await loadBackups();
				setTimeout(() => setSuccess(null), 3000);
			} else {
				const errorData = await response.json();
				setError(errorData.error || 'Failed to create backup');
			}
		} catch {
			setError('Failed to create backup');
		} finally {
			setCreating(false);
		}
	};

	const deleteBackup = async (backupId: string) => {
		if (!confirm('Are you sure you want to delete this backup?')) {
			return;
		}

		try {
			const response = await apiDelete('backup', '/delete/:backupId', { backupId });
			if (response.ok) {
				setSuccess('Backup deleted successfully');
				await loadBackups();
				setTimeout(() => setSuccess(null), 3000);
			} else {
				const errorData = await response.json();
				setError(errorData.error || 'Failed to delete backup');
			}
		} catch {
			setError('Failed to delete backup');
		}
	};

	const downloadBackup = (backupId: string) => {
		window.open(`/backup/download/${backupId}`, '_blank');
	};

	const openRestoreDialog = (backup: BackupMetadata) => {
		setSelectedBackup(backup);
		setRestoreSelection({
			modules: backup.modules || [],
			restoreMatter: true,
		});
		setRestoreDialogOpen(true);
	};

	const restoreBackup = async () => {
		if (!selectedBackup) {
			return;
		}

		if (
			!confirm(
				'Are you sure you want to restore from this backup? This will overwrite current data.'
			)
		) {
			return;
		}

		setRestoring(true);
		setError(null);
		setSuccess(null);

		try {
			const response = await apiPost(
				'backup',
				'/restore',
				{},
				{
					backupId: selectedBackup.id,
					selection: restoreSelection,
				}
			);

			if (response.ok) {
				setSuccess(
					'Backup restored successfully. Please restart the server for changes to take effect.'
				);
				setRestoreDialogOpen(false);
				setTimeout(() => setSuccess(null), 5000);
			} else {
				const errorData = await response.json();
				setError(errorData.error || 'Failed to restore backup');
			}
		} catch {
			setError('Failed to restore backup');
		} finally {
			setRestoring(false);
		}
	};

	const saveConfig = async () => {
		if (!config) {
			return;
		}

		setLoading(true);
		setError(null);
		setSuccess(null);

		try {
			const response = await apiPost('backup', '/config', {}, config);

			if (response.ok) {
				setSuccess('Configuration saved successfully');
				setTimeout(() => setSuccess(null), 3000);
			} else {
				const errorData = await response.json();
				setError(errorData.error || 'Failed to save configuration');
			}
		} catch {
			setError('Failed to save configuration');
		} finally {
			setLoading(false);
		}
	};

	const formatFileSize = (bytes: number): string => {
		if (bytes < 1024) {
			return `${bytes} B`;
		}
		if (bytes < 1024 * 1024) {
			return `${(bytes / 1024).toFixed(2)} KB`;
		}
		return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
	};

	return (
		<Box sx={{ p: 3, maxWidth: 1200 }}>
			<Stack spacing={3}>
				<Box
					sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
				>
					<Typography variant="h4">Backup Management</Typography>
					<Stack direction="row" spacing={2}>
						<Button
							variant="outlined"
							onClick={() => setShowSettings(!showSettings)}
							startIcon={<SaveIcon />}
						>
							Settings
						</Button>
						<Button
							variant="contained"
							onClick={() => setCreateDialogOpen(true)}
							startIcon={<BackupIcon />}
						>
							Create Backup
						</Button>
					</Stack>
				</Box>

				{error && (
					<Alert severity="error" onClose={() => setError(null)}>
						{error}
					</Alert>
				)}

				{success && (
					<Alert severity="success" onClose={() => setSuccess(null)}>
						{success}
					</Alert>
				)}

				{showSettings && config && (
					<Card>
						<CardContent>
							<Typography variant="h6" gutterBottom>
								Backup Settings
							</Typography>
							<Stack spacing={3}>
								<TextField
									label="Backup Path"
									value={config.backupPath}
									onChange={(e) =>
										setConfig({ ...config, backupPath: e.target.value })
									}
									fullWidth
								/>

								<TextField
									label="Backup Interval (days)"
									type="number"
									value={config.intervalDays}
									onChange={(e) =>
										setConfig({
											...config,
											intervalDays: parseInt(e.target.value) || 0,
										})
									}
									helperText="0 = disabled, 7 = weekly"
									fullWidth
								/>

								<TextField
									label="Retention Period (days)"
									type="number"
									value={config.retentionDays}
									onChange={(e) =>
										setConfig({
											...config,
											retentionDays: parseInt(e.target.value) || 0,
										})
									}
									helperText="Backups older than this will be automatically deleted"
									fullWidth
								/>

								<Button
									variant="contained"
									onClick={saveConfig}
									disabled={loading}
									startIcon={<SaveIcon />}
								>
									{loading ? <CircularProgress size={20} /> : 'Save Settings'}
								</Button>
							</Stack>
						</CardContent>
					</Card>
				)}

				<Card>
					<CardContent>
						<Typography variant="h6" gutterBottom>
							Backups ({backups.length})
						</Typography>
						<TableContainer component={Paper}>
							<Table>
								<TableHead>
									<TableRow>
										<TableCell>Date</TableCell>
										<TableCell>Description</TableCell>
										<TableCell>Size</TableCell>
										<TableCell>Devices</TableCell>
										<TableCell>Modules</TableCell>
										<TableCell align="right">Actions</TableCell>
									</TableRow>
								</TableHead>
								<TableBody>
									{backups.length === 0 ? (
										<TableRow>
											<TableCell colSpan={6} align="center">
												No backups found
											</TableCell>
										</TableRow>
									) : (
										backups.map((backup) => (
											<TableRow key={backup.id}>
												<TableCell>
													{formatDistanceToNow(
														new Date(backup.timestamp),
														{ addSuffix: true }
													)}
												</TableCell>
												<TableCell>{backup.description}</TableCell>
												<TableCell>{formatFileSize(backup.size)}</TableCell>
												<TableCell>{backup.deviceCount}</TableCell>
												<TableCell>{backup.moduleCount}</TableCell>
												<TableCell align="right">
													<Stack
														direction="row"
														spacing={1}
														justifyContent="flex-end"
													>
														<Tooltip title="Download">
															<IconButton
																size="small"
																onClick={() =>
																	downloadBackup(backup.id)
																}
															>
																<DownloadIcon />
															</IconButton>
														</Tooltip>
														<Tooltip title="Restore">
															<IconButton
																size="small"
																onClick={() =>
																	openRestoreDialog(backup)
																}
															>
																<RestoreIcon />
															</IconButton>
														</Tooltip>
														<Tooltip title="Delete">
															<IconButton
																size="small"
																onClick={() =>
																	deleteBackup(backup.id)
																}
															>
																<DeleteIcon />
															</IconButton>
														</Tooltip>
													</Stack>
												</TableCell>
											</TableRow>
										))
									)}
								</TableBody>
							</Table>
						</TableContainer>
					</CardContent>
				</Card>
			</Stack>

			{/* Create Backup Dialog */}
			<Dialog
				open={createDialogOpen}
				onClose={() => setCreateDialogOpen(false)}
				maxWidth="sm"
				fullWidth
			>
				<DialogTitle>Create Backup</DialogTitle>
				<DialogContent>
					<TextField
						label="Description (optional)"
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						fullWidth
						multiline
						rows={3}
						placeholder="Enter a description for this backup..."
						sx={{ mt: 2 }}
					/>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
					<Button onClick={createBackup} variant="contained" disabled={creating}>
						{creating ? <CircularProgress size={20} /> : 'Create Backup'}
					</Button>
				</DialogActions>
			</Dialog>

			{/* Restore Backup Dialog */}
			<Dialog
				open={restoreDialogOpen}
				onClose={() => setRestoreDialogOpen(false)}
				maxWidth="sm"
				fullWidth
			>
				<DialogTitle>Restore from Backup</DialogTitle>
				<DialogContent>
					{selectedBackup && (
						<Stack spacing={2} sx={{ mt: 2 }}>
							<Alert severity="warning">
								Select what you want to restore from this backup. This will
								overwrite current data.
							</Alert>

							<FormGroup>
								<FormControlLabel
									control={
										<Checkbox
											checked={restoreSelection.restoreMatter}
											onChange={(e) =>
												setRestoreSelection({
													...restoreSelection,
													restoreMatter: e.target.checked,
												})
											}
										/>
									}
									label="Restore Matter Server Database"
								/>
							</FormGroup>

							<Typography variant="subtitle2">Select Modules to Restore:</Typography>
							<FormGroup>
								{selectedBackup.modules.map((moduleName) => (
									<FormControlLabel
										key={moduleName}
										control={
											<Checkbox
												checked={restoreSelection.modules.includes(
													moduleName
												)}
												onChange={(e) => {
													if (e.target.checked) {
														setRestoreSelection({
															...restoreSelection,
															modules: [
																...restoreSelection.modules,
																moduleName,
															],
														});
													} else {
														setRestoreSelection({
															...restoreSelection,
															modules:
																restoreSelection.modules.filter(
																	(m) => m !== moduleName
																),
														});
													}
												}}
											/>
										}
										label={moduleName}
									/>
								))}
							</FormGroup>
						</Stack>
					)}
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setRestoreDialogOpen(false)}>Cancel</Button>
					<Button
						onClick={restoreBackup}
						variant="contained"
						disabled={
							restoring ||
							(restoreSelection.modules.length === 0 &&
								!restoreSelection.restoreMatter)
						}
					>
						{restoring ? <CircularProgress size={20} /> : 'Restore'}
					</Button>
				</DialogActions>
			</Dialog>
		</Box>
	);
};
