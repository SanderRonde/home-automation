import {
	BEAT_CACHE_CLEAR_INTERVAL,
	PLAYBACK_CLOSE_RANGE,
	PLAYSTATE_CHECK_INTERVAL,
} from '../../../lib/constants';
import { wait } from '../../../lib/util';
import { SpotifyTypes } from '../../../types/spotify';
import { notifyChanges } from '../transfer';
import { BeatChanges, FullState } from '../types';
import { getPlayState, getSongInfo, PlaybackState } from './api';

let active = false;

function isInRange(base: number, target: number, diff: number) {
	return Math.abs(base - target) <= diff;
}

const beatCache: Map<string, SpotifyTypes.TimeInterval[]> = new Map();

async function checkForChanges(
	oldState: PlaybackState | null,
	newState: PlaybackState
): Promise<BeatChanges> {
	const changes: BeatChanges = {
		playbackTime: newState.playTime!,
	};
	if (!oldState || oldState.playing !== newState.playing) {
		changes.playState = newState.playing;
	}
	if (!oldState || oldState.playingID !== newState.playingID) {
		if (!newState.playingID) {
			changes.beats = [];
		} else {
			if (beatCache.has(newState.playingID)) {
				changes.beats = beatCache.get(newState.playingID)!;
			} else {
				const response = await getSongInfo(newState.playingID);
				if (!response) {
					changes.beats = [];
				} else {
					beatCache.set(newState.playingID, response.beats);
					changes.beats = response.beats;
				}
			}
		}
	}
	if (
		newState.playStart &&
		(!oldState || oldState.playStart !== newState.playStart) &&
		!isInRange(
			oldState?.playStart || 0,
			newState.playStart,
			PLAYBACK_CLOSE_RANGE
		) &&
		// Don't send time difference when we are pausing and don't
		// keep sending time differences while paused
		newState.playing !== false
	) {
		changes.playStart = newState.playStart;
	}
	if (oldState?.duration !== newState.duration) {
		changes.duration = newState.duration;
	}
	return changes;
}

function getFullState(state: PlaybackState): FullState {
	return {
		beats: beatCache.get(state.playingID!)!,
		duration: state.duration!,
		playStart: state.playStart!,
		playState: state.playing,
		playbackTime: state.playTime!,
	};
}

export async function start(): Promise<void> {
	let lastState: PlaybackState | null = null;
	while (active) {
		const state = await getPlayState();
		const changes = await checkForChanges(lastState, state);
		lastState = state;

		await notifyChanges(getFullState(state), changes);
		await wait(PLAYSTATE_CHECK_INTERVAL);
	}
}

export async function enable(): Promise<void> {
	if (!active) {
		active = true;
		await start();
	}
}

export function disable(): void {
	active = false;
}

export function initSpotifyChecking(): void {
	setInterval(() => {
		beatCache.clear();
	}, BEAT_CACHE_CLEAR_INTERVAL);
}
