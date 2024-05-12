import { auth, errorHandle, requireParams } from '../../lib/decorators';
import { attachMessage, ResponseLike } from '../../lib/logger';
import { playURL, playURLs, stop } from './casting';
import { LOCAL_URLS } from './local-urls';
import * as castv2 from 'castv2-player';
import { PASTAS } from './pasta';
import { tts } from './tts';

export class APIHandler {
	@errorHandle
	@requireParams('url')
	@auth
	public static async url(
		res: ResponseLike,
		{
			url,
		}: {
			url: string;
			auth?: string;
		}
	): Promise<castv2.MediaPlayerClass[]> {
		if (url in LOCAL_URLS) {
			url = LOCAL_URLS[url];
		}

		const mediaPlayers = await playURL(url);
		const playerLog = attachMessage(
			res,
			`Playing on ${mediaPlayers.length} players`
		);
		attachMessage(
			playerLog,
			`Device names: ${mediaPlayers
				.map((p) => p.connection.name)
				.join(', ')}`
		);
		attachMessage(
			playerLog,
			`Device IPs: ${mediaPlayers
				.map((p) => p.connection.host)
				.join(', ')}`
		);
		res.status(200).write('Success');
		res.end();
		return mediaPlayers;
	}

	@errorHandle
	@auth
	public static async stop(
		res: ResponseLike,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		_params?: {
			auth?: string;
		}
	): Promise<castv2.MediaPlayerClass[]> {
		const mediaPlayers = await stop();
		attachMessage(res, `Stopped ${mediaPlayers.length} players`);
		res.status(200).write('Success');
		res.end();
		return mediaPlayers;
	}

	@errorHandle
	@auth
	public static async say(
		res: ResponseLike,
		{
			text,
			lang = 'en',
		}: {
			text: string;
			lang?: string;
			auth?: string;
		}
	): Promise<castv2.MediaPlayerClass[]> {
		const urls = tts(text, lang)(res);
		attachMessage(res, `Got urls ${urls.join(', ')}`);

		const mediaPlayers = await playURLs(urls);
		attachMessage(res, `Saying in lang "${lang}": "${text}"`);
		const playerLog = attachMessage(
			res,
			`Playing on ${mediaPlayers.length} players`
		);
		attachMessage(
			playerLog,
			`Device names: ${mediaPlayers
				.map((p) => p.connection.name)
				.join(', ')}`
		);
		attachMessage(
			playerLog,
			`Device IPs: ${mediaPlayers
				.map((p) => p.connection.host)
				.join(', ')}`
		);
		res.status(200).write('Success');
		res.end();
		return mediaPlayers;
	}

	@errorHandle
	@requireParams('pasta')
	@auth
	public static async pasta(
		res: ResponseLike,
		{
			pasta,
		}: {
			pasta: string;
			auth?: string;
		}
	): Promise<castv2.MediaPlayerClass[] | undefined> {
		if (!(pasta in PASTAS)) {
			res.status(400).write('Unknown pasta');
			res.end();
			return;
		}
		const { lang, text } = PASTAS[pasta];
		const urls = tts(text, lang)(res);

		attachMessage(res, `Got urls ${urls.join(', ')}`);
		const mediaPlayers = await playURLs(urls);
		attachMessage(res, `Saying pasta in lang "${lang}": "${text}"`);
		const playerLog = attachMessage(
			res,
			`Playing on ${mediaPlayers.length} players`
		);
		attachMessage(
			playerLog,
			`Device names: ${mediaPlayers
				.map((p) => p.connection.name)
				.join(', ')}`
		);
		attachMessage(
			playerLog,
			`Device IPs: ${mediaPlayers
				.map((p) => p.connection.host)
				.join(', ')}`
		);
		res.status(200).write('Success');
		res.end();
		return mediaPlayers;
	}
}
