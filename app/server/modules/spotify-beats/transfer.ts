import { BeatChanges, FullState } from '@server/modules/spotify-beats/types';
import { initSpotify } from '@server/modules/spotify-beats/spotify';
import { Database } from '@server/lib/db';

export async function initTransfer(db: Database): Promise<void> {
	await initSpotify(db);
}

export async function notifyChanges(
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	_fullState: FullState,
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	_changes: BeatChanges
): Promise<void> {
	// const modules = await meta.modules;
	// await _modules.RGB.Board.BeatFlash.notifyChanges(
	// 	fullState,
	// 	changes
	// );
}
