import { API, ExtendedResponse } from '.';
import { SpotifyTypes } from '../../../../types/spotify';

export class SpotifyAPIEndpoints {
	constructor(public api: API) {}

	player(): Promise<ExtendedResponse<SpotifyTypes.Endpoints.Player> | null> {
		return this.api.get<SpotifyTypes.Endpoints.Player>('/v1/me/player');
	}

	audioAnalysis(
		id: string
	): Promise<ExtendedResponse<SpotifyTypes.Endpoints.AudioAnalysis> | null> {
		return this.api.get<SpotifyTypes.Endpoints.AudioAnalysis>(
			`/v1/audio-analysis/${id}`
		);
	}

	getDevices(): Promise<ExtendedResponse<SpotifyTypes.Endpoints.Devices> | null> {
		return this.api.get<SpotifyTypes.Endpoints.Devices>(
			'/v1/me/player/devices'
		);
	}

	play(
		uri: string,
		deviceId: string
	): Promise<ExtendedResponse<SpotifyTypes.Endpoints.Play> | null> {
		return this.api.put<SpotifyTypes.Endpoints.Play>(
			`/v1/me/player/play?device_id=${deviceId}`,
			JSON.stringify({
				uris: [uri],
			})
		);
	}
}
