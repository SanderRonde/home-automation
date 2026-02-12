export interface BambuLabConfig {
	ip: string;
	serial: string;
	accessCode: string;
	enabled?: boolean;
}

export interface PrinterTemperature {
	bed?: number;
	nozzle?: number;
}

export interface PrinterStatus {
	timestamp: number;
	state: string;
	temperature?: PrinterTemperature;
	progress?: number;
	currentFile?: string;
}

export interface BambuLabDB {
	config?: BambuLabConfig;
	lastStatus?: PrinterStatus;
}
