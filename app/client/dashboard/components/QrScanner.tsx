import {
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Button,
	Alert,
	Box,
	Typography,
	CircularProgress,
} from '@mui/material';
import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface QrScannerProps {
	open: boolean;
	onClose: () => void;
	onScan: (qrCode: string) => void;
}

export const QrScanner = (props: QrScannerProps): JSX.Element => {
	const [error, setError] = useState<string | null>(null);
	const [scanning, setScanning] = useState(false);
	const [hasCamera, setHasCamera] = useState<boolean | null>(null);
	const scannerRef = useRef<Html5Qrcode | null>(null);
	const containerId = 'qr-scanner-container';

	// Check camera availability
	useEffect(() => {
		const checkCamera = async () => {
			if (!navigator.mediaDevices?.getUserMedia) {
				setHasCamera(false);
				setError('Camera access is not available in this browser');
				return;
			}

			try {
				const devices = await navigator.mediaDevices.enumerateDevices();
				const videoDevices = devices.filter((device) => device.kind === 'videoinput');
				setHasCamera(videoDevices.length > 0);
				if (videoDevices.length === 0) {
					setError('No camera found on this device');
				}
			} catch (err) {
				console.error('Error checking camera:', err);
				setHasCamera(false);
				setError('Failed to check camera availability');
			}
		};

		if (props.open) {
			void checkCamera();
		}
	}, [props.open]);

	const stopScanning = React.useCallback(async () => {
		if (scannerRef.current) {
			try {
				await scannerRef.current.stop();
				scannerRef.current.clear();
			} catch (err) {
				console.error('Error stopping scanner:', err);
			}
			scannerRef.current = null;
			setScanning(false);
		}
	}, []);

	// Extract onScan to satisfy linter while following project rules (no prop destructuring)
	const onScan = props.onScan;

	// Start/stop scanning
	useEffect(() => {
		if (!props.open || hasCamera === false) {
			return;
		}

		const startScanning = async () => {
			if (scannerRef.current) {
				return;
			}

			try {
				setError(null);
				setScanning(true);

				const html5QrCode = new Html5Qrcode(containerId);
				scannerRef.current = html5QrCode;

				await html5QrCode.start(
					{ facingMode: 'environment' },
					{
						fps: 10,
						qrbox: { width: 250, height: 250 },
					},
					(decodedText: string) => {
						// Successfully scanned
						onScan(decodedText);
						void stopScanning();
					},
					() => {
						// Error callback - ignore, we'll keep trying
					}
				);
			} catch (err) {
				console.error('Error starting QR scanner:', err);
				setScanning(false);
				if (err instanceof Error) {
					if (err.message.includes('Permission denied')) {
						setError(
							'Camera permission denied. Please allow camera access and try again.'
						);
					} else if (err.message.includes('No devices found')) {
						setError('No camera found on this device');
					} else {
						setError(`Failed to start camera: ${err.message}`);
					}
				} else {
					setError('Failed to start camera');
				}
			}
		};

		void startScanning();

		return () => {
			void stopScanning();
		};
	}, [props.open, hasCamera, onScan, stopScanning]);

	const handleClose = () => {
		void stopScanning();
		setError(null);
		props.onClose();
	};

	return (
		<Dialog open={props.open} onClose={handleClose} maxWidth="sm" fullWidth>
			<DialogTitle>Scan QR Code</DialogTitle>
			<DialogContent>
				<Box
					sx={{
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						gap: 2,
						py: 2,
					}}
				>
					{error && <Alert severity="error">{error}</Alert>}

					{hasCamera === null && (
						<Box
							sx={{
								display: 'flex',
								flexDirection: 'column',
								alignItems: 'center',
								gap: 2,
							}}
						>
							<CircularProgress />
							<Typography variant="body2" color="text.secondary">
								Checking camera availability...
							</Typography>
						</Box>
					)}

					{hasCamera === false && !error && (
						<Typography variant="body2" color="text.secondary">
							No camera available on this device
						</Typography>
					)}

					{hasCamera === true && (
						<Box
							sx={{
								width: '100%',
								display: 'flex',
								justifyContent: 'center',
								position: 'relative',
								minHeight: '300px',
							}}
						>
							<div id={containerId} style={{ width: '100%' }} />
							{scanning && (
								<Box
									sx={{
										position: 'absolute',
										top: '50%',
										left: '50%',
										transform: 'translate(-50%, -50%)',
										display: 'flex',
										flexDirection: 'column',
										alignItems: 'center',
										gap: 1,
									}}
								>
									<CircularProgress />
									<Typography variant="body2" color="text.secondary">
										Scanning...
									</Typography>
								</Box>
							)}
						</Box>
					)}

					<Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
						Position the Matter device QR code within the frame
					</Typography>
				</Box>
			</DialogContent>
			<DialogActions>
				<Button onClick={handleClose}>Close</Button>
			</DialogActions>
		</Dialog>
	);
};
