import type { Palette, PaletteId } from '../../../../types/palette';
import type { Database } from '../../lib/db';
import type { DeviceDB } from '.';

export class PaletteAPI {
	public constructor(private readonly _db: Database<DeviceDB>) {}

	public listPalettes(): Palette[] {
		const palettes = this._db.current().palettes ?? {};
		return Object.values(palettes);
	}

	public getPalette(id: PaletteId): Palette | undefined {
		const palettes = this._db.current().palettes ?? {};
		return palettes[id];
	}

	public createPalette(palette: Omit<Palette, 'id'>): PaletteId {
		// Validate at least one color
		if (palette.colors.length === 0) {
			throw new Error('Palette must have at least one color');
		}

		const paletteId = `palette_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
		const newPalette: Palette = {
			...palette,
			id: paletteId,
		};

		this._db.update((old) => ({
			...old,
			palettes: {
				...(old.palettes ?? {}),
				[paletteId]: newPalette,
			},
		}));

		return paletteId;
	}

	public updatePalette(id: PaletteId, palette: Omit<Palette, 'id'>): boolean {
		const palettes = this._db.current().palettes ?? {};
		if (!palettes[id]) {
			return false;
		}

		// Validate at least one color
		if (palette.colors.length === 0) {
			throw new Error('Palette must have at least one color');
		}

		this._db.update((old) => ({
			...old,
			palettes: {
				...(old.palettes ?? {}),
				[id]: {
					...palette,
					id,
				},
			},
		}));

		return true;
	}

	public deletePalette(id: PaletteId): boolean {
		const palettes = this._db.current().palettes ?? {};
		if (!palettes[id]) {
			return false;
		}

		const newPalettes = { ...palettes };
		delete newPalettes[id];

		this._db.update((old) => ({
			...old,
			palettes: newPalettes,
		}));

		return true;
	}
}
