export interface BambuLabConfig {
	ip: string;
	serial: string;
	accessCode: string;
	enabled?: boolean;
	videoStreamUrl?: string;
}

export interface PrinterStatus {
	lights: {
		[name: string]: boolean;
	};
	state: PrintState | undefined;
	/** Current temperature of the printer */
	bedTemperature: number | undefined;
	nozzleTemperature: number | undefined;
	/** Target temperature for bed (Celsius) */
	bedTargetTemperature: number | undefined;
	/** Target temperature for nozzle (Celsius) */
	nozzleTargetTemperature: number | undefined;
	/** Progress as a float */
	progress: number | undefined;
	/** Current file being printed */
	currentFile: string | undefined;
	layers:
		| {
				current: number;
				total: number;
		  }
		| undefined;
	/** In minutes */
	remainingTime: number | undefined;
	ams:
		| {
				/** Temperature in Celsius */
				temp: number;
				/** Humidity as a float */
				humidity: number;
				usedTray: number | undefined;
				trays: (
					| {
							/** Whether the tray is empty */
							empty: true;
					  }
					| {
							/** Whether the tray is empty */
							empty: false;
							/** Color of the filament (in hex format) */
							color: string;
							/** Filament type (PLA, PETG, ABS, etc.) */
							type: string;
							/** Percentage of filament remaining (-1 means uncalibrated) */
							remaining: number;
					  }
				)[];
		  }
		| undefined;
}

export interface BambuLabDB {
	config?: BambuLabConfig;
	lastStatus?: PrinterStatus;
}

export enum PrintState {
	IDLE = 'idle',
	PRINTING = 'printing',
	PAUSED = 'paused',
	FINISHED = 'finished',
	FAILED = 'failed',
}
