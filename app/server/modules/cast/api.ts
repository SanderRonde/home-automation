import { auth, errorHandle, requireParams } from '../../lib/decorators';
import { ResponseLike } from '../../lib/logging/response-logger';
import { playURL, playURLs, stop } from './casting';
import { LogObj } from '../../lib/logging/lob-obj';
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
		const playerLog = LogObj.fromRes(res).attachMessage(
			`Playing on ${mediaPlayers.length} players`
		);
		playerLog.attachMessage(
			`Device names: ${mediaPlayers
				.map((p) => p.connection.name)
				.join(', ')}`
		);
		playerLog.attachMessage(
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
		LogObj.fromRes(res).attachMessage(
			`Stopped ${mediaPlayers.length} players`
		);
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
		const urls = tts(text, lang)(LogObj.fromRes(res));
		const logObj = LogObj.fromRes(res);
		logObj.attachMessage(`Got urls ${urls.join(', ')}`);

		const mediaPlayers = await playURLs(urls);
		logObj.attachMessage(`Saying in lang "${lang}": "${text}"`);
		const playerLog = logObj.attachMessage(
			`Playing on ${mediaPlayers.length} players`
		);
		playerLog.attachMessage(
			`Device names: ${mediaPlayers
				.map((p) => p.connection.name)
				.join(', ')}`
		);
		playerLog.attachMessage(
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
		const logObj = LogObj.fromRes(res);
		const urls = tts(text, lang)(logObj);

		logObj.attachMessage(`Got urls ${urls.join(', ')}`);
		const mediaPlayers = await playURLs(urls);
		logObj.attachMessage(`Saying pasta in lang "${lang}": "${text}"`);
		const playerLog = logObj.attachMessage(
			`Playing on ${mediaPlayers.length} players`
		);
		playerLog.attachMessage(
			`Device names: ${mediaPlayers
				.map((p) => p.connection.name)
				.join(', ')}`
		);
		playerLog.attachMessage(
			`Device IPs: ${mediaPlayers
				.map((p) => p.connection.host)
				.join(', ')}`
		);
		res.status(200).write('Success');
		res.end();
		return mediaPlayers;
	}
}
