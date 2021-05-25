import * as castv2 from 'castv2-player';
import * as playlist from 'castv2-player/lib/playlist';
import { devices, scan } from './scanning';
import { DummyCastLog } from './types';

const MediaPlayer = castv2.MediaPlayer(new DummyCastLog());
const Playlist = playlist(new DummyCastLog());

const mediaPlayers: WeakMap<castv2.Device, castv2.MediaPlayerClass> =
	new WeakMap();

async function assertMediaPlayers() {
	if (devices.length === 0) {
		await scan();
	}

	devices.forEach(assertMediaPlayer);
}

function assertMediaPlayer(device: castv2.Device) {
	if (mediaPlayers.has(device)) {
		return;
	}

	mediaPlayers.set(device, new MediaPlayer(device));
}

export async function playURL(url: string): Promise<castv2.MediaPlayerClass[]> {
	await assertMediaPlayers();

	const players = devices.map((d) => mediaPlayers.get(d)!);
	await Promise.all(players.map((p) => p.stopClientPromise()));

	await Promise.all(players.map((p) => p.playUrlPromise(url)));

	return players;
}

export async function playURLs(
	urls: string[]
): Promise<castv2.MediaPlayerClass[]> {
	await assertMediaPlayers();

	const players = devices.map((d) => mediaPlayers.get(d)!);
	await Promise.all(players.map((p) => p.stopClientPromise()));

	await Promise.all(
		players.map(async (p) => {
			const playlist = new Playlist(p.connection.name, {
				on() {},
			});
			const list = playlist._addItems(
				urls.map((url) => ({
					url: url,
					contentType: 'audio/mpeg',
					metadata: {},
				})),
				{},
				false
			);
			await p._player.queueLoadPromise(p._player, list, {
				startIndex: 0,
				repeatMode: 'REPEAT_OFF',
			});
		})
	);

	return players;
}

export async function stop(): Promise<castv2.MediaPlayerClass[]> {
	devices.forEach(assertMediaPlayer);

	const players = devices.map((d) => mediaPlayers.get(d)!);
	await Promise.all(players.map((p) => p.stopClientPromise()));
	return players;
}
