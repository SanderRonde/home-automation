import { SpotifyTypes } from '../../../../types/spotify';
import { API, ExtendedResponse } from '.';

export class SpotifyAPIEndpoints {
	public constructor(public api: API) {}

	public player(): Promise<ExtendedResponse<SpotifyTypes.Endpoints.Player> | null> {
		return this.api.get<SpotifyTypes.Endpoints.Player>('/v1/me/player');
	}

	public audioAnalysis(
		id: string
	): Promise<ExtendedResponse<SpotifyTypes.Endpoints.AudioAnalysis> | null> {
		return this.api.get<SpotifyTypes.Endpoints.AudioAnalysis>(
			`/v1/audio-analysis/${id}`
		);
	}

	public getDevices(): Promise<ExtendedResponse<SpotifyTypes.Endpoints.Devices> | null> {
		return this.api.get<SpotifyTypes.Endpoints.Devices>(
			'/v1/me/player/devices'
		);
	}

	public play(
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
