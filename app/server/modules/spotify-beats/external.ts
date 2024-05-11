import {
	ExtendedResponse,
	getPlayState,
	getSpotifyAPI,
	PlaybackState,
} from '@server/modules/spotify-beats/spotify/api';
import { createExternalClass } from '@server/lib/external';
import { SpotifyTypes } from '@server/types/spotify';

export class ExternalHandler extends createExternalClass(true) {
	public requiresInit = true;

	public async test(): Promise<boolean | null> {
		return this.runRequest(() => {
			return getSpotifyAPI().testAuth();
		});
	}

	public async play(
		uri: string,
		device: string
	): Promise<ExtendedResponse<SpotifyTypes.Playlist> | null> {
		return this.runRequest(() => {
			return getSpotifyAPI().endpoints.play(uri, device);
		});
	}

	public async getDevices(): Promise<ExtendedResponse<SpotifyTypes.Endpoints.Devices> | null> {
		return this.runRequest(() => {
			return getSpotifyAPI().endpoints.getDevices();
		});
	}

	public async getPlayState(): Promise<PlaybackState> {
		return this.runRequest(() => {
			return getPlayState();
		});
	}
}
