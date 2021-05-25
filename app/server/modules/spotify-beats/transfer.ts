import { Database } from '../../lib/db';
import { initSpotify } from './spotify/';
import { BeatChanges, FullState } from './types';

export async function initTransfer(db: Database): Promise<void> {
	await initSpotify(db);
}

export async function notifyChanges(
	_fullState: FullState,
	_changes: BeatChanges
): Promise<void> {
	// const modules = await meta.modules;
	// await _modules.RGB.Board.BeatFlash.notifyChanges(
	// 	fullState,
	// 	changes
	// );
}
