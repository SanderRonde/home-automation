import { logTag } from '../../../lib/logging/logger';
import type { PrinterStatus } from '../types';

/**
 * Subset of P1S printer state that we use for monitoring
 * Based on bambu-js P1SState interface
 */
interface P1SReportState {
	gcode_state: string;
	bed_temper?: number;
	nozzle_temper?: number;
	mc_percent?: number;
	subtask_name?: string;
}

/**
 * Type-safe wrapper for bambu-js PrinterController
 * Using dynamic import to avoid ESM/CommonJS issues
 */
interface BambuPrinterClient {
	connect(): Promise<void>;
	disconnect(): Promise<void>;
	on(event: 'connect', listener: () => void): void;
	on(event: 'disconnect', listener: () => void): void;
	on(event: 'error', listener: (error: Error) => void): void;
	on(event: 'report', listener: (state: { print: P1SReportState }) => void): void;
	isConnected: boolean;
}

export class BambuLabAPI {
	private _client: BambuPrinterClient | null = null;
	private _lastStatus: PrinterStatus | null = null;
	private _isConnecting = false;

	constructor(
		private _ip: string,
		private _serial: string,
		private _accessCode: string,
		private _onStatusUpdate: (status: PrinterStatus) => Promise<void>
	) {}

	public async connect(): Promise<void> {
		if (this._client || this._isConnecting) {
			return;
		}

		this._isConnecting = true;

		try {
			// Dynamic import for ESM module
			const { PrinterController } = await import('bambu-js');

			// Note: P1P uses the same protocol as P1S
			this._client = PrinterController.create({
				model: 'P1S',
				host: this._ip,
				accessCode: this._accessCode,
				serial: this._serial,
				options: {
					connectionTimeout: 10000,
					autoReconnect: true,
					reconnectDelay: 5000,
				},
			}) as BambuPrinterClient;

			// Set up event listeners
			this._client.on('connect', () => {
				logTag('bambulab', 'green', 'Connected to printer');
			});

			this._client.on('disconnect', () => {
				logTag('bambulab', 'yellow', 'Disconnected from printer');
			});

			this._client.on('error', (error: Error) => {
				logTag('bambulab', 'red', 'Printer error:', error);
			});

			this._client.on('report', (state: { print: P1SReportState }) => {
				void this._handleStateUpdate(state.print);
			});

			// Connect to the printer
			await this._client.connect();
			logTag('bambulab', 'green', `Connected to printer at ${this._ip}`);
		} catch (error) {
			logTag('bambulab', 'red', 'Failed to connect to printer:', error);
			this._client = null;
			throw error;
		} finally {
			this._isConnecting = false;
		}
	}

	public disconnect(): void {
		if (this._client) {
			void this._client.disconnect();
			this._client = null;
			this._lastStatus = null;
			logTag('bambulab', 'yellow', 'Disconnected from printer');
		}
	}

	public getStatus(): PrinterStatus | null {
		return this._lastStatus;
	}

	public isConnected(): boolean {
		return this._client?.isConnected ?? false;
	}

	private async _handleStateUpdate(state: P1SReportState): Promise<void> {
		try {
			// Extract relevant information from the state
			const status: PrinterStatus = {
				timestamp: Date.now(),
				state: this._extractPrintState(state),
				temperature: {
					bed: state.bed_temper,
					nozzle: state.nozzle_temper,
				},
				progress: state.mc_percent,
				currentFile: state.subtask_name ?? undefined,
			};

			this._lastStatus = status;
			await this._onStatusUpdate(status);
		} catch (error) {
			logTag('bambulab', 'red', 'Error handling state update:', error);
		}
	}

	private _extractPrintState(state: P1SReportState): string {
		// Map the gcode_state to a human-readable state
		const gcodeState = state.gcode_state;

		switch (gcodeState) {
			case 'IDLE':
				return 'idle';
			case 'RUNNING':
				return 'printing';
			case 'PAUSE':
				return 'paused';
			case 'FINISH':
				return 'finished';
			case 'FAILED':
				return 'failed';
			default:
				return gcodeState?.toLowerCase() ?? 'unknown';
		}
	}
}
