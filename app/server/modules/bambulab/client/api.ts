import type {
	ModelStateSchema,
	P1SReportState,
	PrinterController,
} from 'bambu-js' with { 'resolution-mode': 'import' };
import { logTag } from '../../../lib/logging/logger';
import type { PrinterStatus } from '../types';
import { Data } from '../../../lib/data';
import { PrintState } from '../types';

interface FullP1SReportState extends P1SReportState {
	ams?: NonNullable<P1SReportState['ams']> & {
		ams: NonNullable<P1SReportState['ams']>['ams'] &
			{
				humidity_raw: string;
				temp: string;
				tray: NonNullable<NonNullable<P1SReportState['ams']>['ams'][number]>['tray'] & {}[];
			}[];
	};
}

export class BambuLabAPI {
	private _client: PrinterController<ModelStateSchema<'P1S'>> | null = null;
	public status: Data<PrinterStatus | null> = new Data<PrinterStatus | null>(null);
	private _isConnecting = false;

	constructor(
		private _ip: string,
		public serial: string,
		private _accessCode: string
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
				serial: this.serial,
				options: {
					connectionTimeout: 10000,
					autoReconnect: true,
					reconnectDelay: 5000,
				},
			});

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

			this._client.on('report', (state) => {
				if (state.print) {
					void this._handleStateUpdate(state.print as FullP1SReportState);
				}
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
			this.status.set(null);
			logTag('bambulab', 'yellow', 'Disconnected from printer');
		}
	}

	public isConnected(): boolean {
		return this._client?.isConnected ?? false;
	}

	public async setLight(lightName: 'chamber_light', on: boolean): Promise<void> {
		if (!this._client) {
			throw new Error('Not connected to printer');
		}
		// Dynamic import for ESM module
		const { P1SCommands } = await import('bambu-js');
		await this._client.sendCommand(P1SCommands.setLedCommand(lightName, on ? 'on' : 'off'));
		this.status.set(
			this._joinPartialStatus(this.status.current(), {
				lights: {
					...(this.status.current() ?? {}).lights,
					[lightName]: on,
				},
			})
		);
	}

	private _joinPartialStatus(
		lastStatus: PrinterStatus | null,
		state: Partial<PrinterStatus>
	): PrinterStatus {
		const joinedStatus = { ...lastStatus } as PrinterStatus;
		let didChange = false;
		for (const _key in state) {
			const key = _key as keyof PrinterStatus;
			if (key in state) {
				if (state[key] !== undefined && state[key] !== joinedStatus[key]) {
					didChange = true;
					(joinedStatus as any)[key] = state[key] as any;
				}
			}
		}
		if (!didChange) {
			return (
				lastStatus ?? {
					lights: {},
					ams: undefined,
					layers: undefined,
					remainingTime: undefined,
					progress: undefined,
					currentFile: undefined,
					bedTemperature: undefined,
					nozzleTemperature: undefined,
					bedTargetTemperature: undefined,
					nozzleTargetTemperature: undefined,
					state: undefined,
				}
			);
		}
		return joinedStatus;
	}

	private async _handleStateUpdate(state: FullP1SReportState): Promise<void> {
		try {
			// Extract relevant information from the state
			const lastStatus = this.status.current();
			let lights = undefined;
			if (state.lights_report) {
				lights = {} as { [name: string]: boolean };
				for (const light of state.lights_report) {
					lights[light.node] = light.mode === 'on' ? true : false;
				}
			}
			const status = this._joinPartialStatus(lastStatus, {
				lights,
				state: this._extractPrintState(state),
				bedTemperature: state.bed_temper,
				nozzleTemperature: state.nozzle_temper,
				bedTargetTemperature: state.bed_target_temper,
				nozzleTargetTemperature: state.nozzle_target_temper,
				layers:
					state.layer_num !== undefined && state.total_layer_num !== undefined
						? {
								current: state.layer_num,
								total: state.total_layer_num,
							}
						: undefined,
				remainingTime: state.mc_remaining_time,
				progress: state.mc_percent ? state.mc_percent / 100 : undefined,
				currentFile: state.subtask_name,
				ams: state.ams
					? {
							temp: parseFloat(state.ams.ams[0].temp),
							humidity: parseFloat(state.ams.ams[0].humidity_raw) / 100,
							usedTray: state.ams.tray_now ? parseInt(state.ams.tray_now) : undefined,
							trays: state.ams.ams[0].tray.map((tray) =>
								tray.tray_color && tray.tray_type
									? {
											empty: false,
											color: tray.tray_color,
											type: tray.tray_type,
											remaining: tray.remain ?? -1,
										}
									: {
											empty: true,
										}
							),
						}
					: undefined,
			});

			this.status.set(status);
		} catch (error) {
			logTag('bambulab', 'red', 'Error handling state update:', error);
		}
	}

	private _extractPrintState(state: FullP1SReportState): PrintState | undefined {
		// Map the gcode_state to a human-readable state
		const gcodeState = state.gcode_state;

		switch (gcodeState) {
			case 'IDLE':
				return PrintState.IDLE;
			case 'RUNNING':
				return PrintState.PRINTING;
			case 'PAUSE':
				return PrintState.PAUSED;
			case 'FINISH':
				return PrintState.FINISHED;
			case 'FAILED':
				return PrintState.FAILED;
			default:
				return undefined;
		}
	}
}
