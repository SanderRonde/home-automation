export type PaletteId = string;

export interface Palette {
	id: PaletteId;
	name: string;
	colors: string[]; // Hex color strings like "#ff5733"
}
