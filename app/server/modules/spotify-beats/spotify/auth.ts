import { getSpotifyAPI } from '@server/modules/spotify-beats/spotify/api';

export async function authFromToken(token: string): Promise<void> {
	const api = getSpotifyAPI();
	if (!(await api.grantAuthCode(token))) {
		return;
	}
}

export async function finishManualAuth(token: string): Promise<void> {
	await authFromToken(token);
}

let lastURL: string | null = null;
export function generateNew(): string {
	const api = getSpotifyAPI();
	const url = api.createAuthURL(
		[
			'user-read-currently-playing',
			'user-read-playback-state',
			'user-read-private',
			'user-read-email',
			'user-read-playback-state',
			'user-modify-playback-state',
		],
		'generate-new'
	);
	lastURL = url;
	return url;
}

export function getURL(): string {
	return lastURL || generateNew();
}
