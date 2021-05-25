import { auth, errorHandle, requireParams } from '../../lib/decorators';
import {
	attachMessage,
	attachSourcedMessage,
	ResponseLike,
} from '../../lib/logger';
import * as castv2 from 'castv2-player';
import { LOCAL_URLS } from './local-urls';
import { Media } from './casting';
import { Cast } from './index';
import { tts } from './tts';
import { PASTAS } from './pasta';

export class Handler {
	@errorHandle
	@requireParams('url')
	@auth
	static async url(
		res: ResponseLike,
		{
			url,
		}: {
			url: string;
			auth?: string;
		},
		source: string
	): Promise<castv2.MediaPlayerClass[]> {
		if (url in LOCAL_URLS) {
			url = LOCAL_URLS[url];
		}

		const mediaPlayers = await Media.playURL(url);
		const playerLog = attachSourcedMessage(
			res,
			source,
			await Cast.explainHook,
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
	static async stop(
		res: ResponseLike,
		_options: {
			auth?: string;
		},
		source: string
	): Promise<castv2.MediaPlayerClass[]> {
		const mediaPlayers = await Media.stop();
		attachSourcedMessage(
			res,
			source,
			await Cast.explainHook,
			`Stopped ${mediaPlayers.length} players`
		);
		res.status(200).write('Success');
		res.end();
		return mediaPlayers;
	}

	@errorHandle
	@auth
	static async say(
		res: ResponseLike,
		{
			text,
			lang = 'en',
		}: {
			text: string;
			lang?: string;
			auth?: string;
		},
		source: string
	): Promise<castv2.MediaPlayerClass[]> {
		const urls = await tts(text, lang)('API.say', res);
		attachMessage(res, `Got urls ${urls.join(', ')}`);

		const mediaPlayers = await Media.playURLs(urls);
		attachSourcedMessage(
			res,
			source,
			await Cast.explainHook,
			`Saying in lang "${lang}": "${text}"`
		);
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
	static async pasta(
		res: ResponseLike,
		{
			pasta,
		}: {
			pasta: string;
			auth?: string;
		},
		source: string
	): Promise<castv2.MediaPlayerClass[] | undefined> {
		if (!(pasta in PASTAS)) {
			res.status(400).write('Unknown pasta');
			res.end();
			return;
		}
		const { lang, text } = PASTAS[pasta];
		const urls = await tts(text, lang)('API.pasta', res);

		attachMessage(res, `Got urls ${urls.join(', ')}`);
		const mediaPlayers = await Media.playURLs(urls);
		attachSourcedMessage(
			res,
			source,
			await Cast.explainHook,
			`Saying pasta in lang "${lang}": "${text}"`
		);
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
