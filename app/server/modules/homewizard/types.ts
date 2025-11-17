export type MeasurementSource = 'homewizard' | 'aggregated';

export interface MeasurementSummary {
	timestamp: number | null;
	powerW: number | null;
	energyImportKwh: number | null;
	temperatureC: number | null;
	source: MeasurementSource;
}

export interface HistoryEntry {
	timestamp: number;
	powerW: number | null;
	energyImportKwh: number | null;
}
