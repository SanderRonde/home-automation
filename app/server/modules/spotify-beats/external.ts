import { createExternalClass } from '../../lib/external';
import { SpotifyTypes } from '../../types/spotify';
import {
	ExtendedResponse,
	getPlayState,
	getSpotifyAPI,
	PlaybackState,
} from './spotify/api';

export class ExternalHandler extends createExternalClass(true) {
	requiresInit = true;

	async test(): Promise<boolean | null> {
		return this.runRequest(() => {
			return getSpotifyAPI().testAuth();
		});
	}

	async play(
		uri: string,
		device: string
	): Promise<ExtendedResponse<SpotifyTypes.Playlist> | null> {
		return this.runRequest(() => {
			return getSpotifyAPI().endpoints.play(uri, device);
		});
	}

	async getDevices(): Promise<ExtendedResponse<SpotifyTypes.Endpoints.Devices> | null> {
		return this.runRequest(() => {
			return getSpotifyAPI().endpoints.getDevices();
		});
	}

	async getPlayState(): Promise<PlaybackState> {
		return this.runRequest(() => {
			return getPlayState();
		});
	}
}
