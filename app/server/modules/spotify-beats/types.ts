import { SpotifyTypes } from '../../types/spotify';

export interface BeatChanges {
	playState?: boolean;
	beats?: SpotifyTypes.TimeInterval[];
	playStart?: number;
	duration?: number;

	playbackTime: number;
}

export type FullState = {
	[K in keyof BeatChanges]-?: BeatChanges[K];
};
