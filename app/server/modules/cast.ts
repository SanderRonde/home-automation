import {
	LOCAL_URLS as _LOCAL_URLS,
	PASTAS as _PASTAS,
	CAST_DEVICE_NAMES
} from '../config/casts';
import {
	attachMessage,
	attachSourcedMessage,
	ResponseLike
} from '../lib/logger';
import * as playlist from 'castv2-player/lib/playlist';
import { requireParams } from '../lib/decorators';
import { errorHandle } from '../lib/decorators';
import { createExternalClass } from '../lib/external';
import { BotState } from '../lib/bot-state';
import { ModuleConfig } from './modules';
import { auth } from '../lib/decorators';
import * as castv2 from 'castv2-player';
import { Bot as _Bot } from './bot';
import { ModuleMeta } from './meta';
import { Auth } from './auth';
import { createRouter } from '../lib/api';

class DummyLog {
	constructor(public componentName: string = 'castv2') {}

	_addPrefix(firstArg?: any, ...args: any[]) {
		if (firstArg) {
			return [`${this.componentName} - ${firstArg}`, ...args];
		}
		return [];
	}

	error() {
		console.error.apply(console, this._addPrefix(...arguments));
	}
	warn() {}
	info() {}
	debug() {}
}

const scannerPromise = castv2.ScannerPromise(new DummyLog());
const MediaPlayer = castv2.MediaPlayer(new DummyLog());
const Playlist = playlist(new DummyLog());
const MAX_PART_LEN = 190;

export namespace Cast {
	export const meta = new (class Meta extends ModuleMeta {
		name = 'cast';

		async init(config: ModuleConfig) {
			await Routing.init(config);
		}

		get external() {
			return External;
		}

		get bot() {
			return Bot;
		}
	})();

	export namespace Scanning {
		export async function scan(): Promise<castv2.Device[]> {
			return (devices = (
				await Promise.all(
					CAST_DEVICE_NAMES.map(name => scannerPromise(name))
				)
			).filter(device => !!device));
		}

		export let devices: castv2.Device[] = [];
	}

	namespace TTS {
		function splitTTSParts(text: string) {
			const words = text.split(' ');
			const parts: string[] = [];

			let charLen = 0;
			let partIndex = 0;
			for (let i = 0; i < words.length; i++) {
				charLen += words[i].length + 1;
				if (charLen >= MAX_PART_LEN) {
					partIndex++;
					charLen = 0;
				}
				parts[partIndex] = parts[partIndex] || '';
				parts[partIndex] += words[i] + ' ';
			}
			return parts;
		}

		export function tts(text: string, lang: string) {
			return async (source: string, loggable: any) => {
				if (await meta.explainHook) {
					(await meta.explainHook)(
						`Casting TTS ${text} in lang ${lang}`,
						source,
						loggable
					);
				}

				const parts = splitTTSParts(text);
				return parts.map(part => {
					return `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&q=${encodeURIComponent(
						part
					)}&client=tw-ob`;
				});
			};
		}
	}

	namespace Pasta {
		export const PASTAS = _PASTAS;
	}

	namespace LocalURLS {
		export const LOCAL_URLS = _LOCAL_URLS;
	}

	namespace Casting {
		export namespace Media {
			const mediaPlayers: WeakMap<
				castv2.Device,
				castv2.MediaPlayerClass
			> = new WeakMap();

			async function assertMediaPlayers() {
				if (Scanning.devices.length === 0) {
					await Scanning.scan();
				}

				Scanning.devices.forEach(assertMediaPlayer);
			}

			function assertMediaPlayer(device: castv2.Device) {
				if (mediaPlayers.has(device)) return;

				mediaPlayers.set(device, new MediaPlayer(device));
			}

			export async function playURL(
				url: string
			): Promise<castv2.MediaPlayerClass[]> {
				await assertMediaPlayers();

				const players = Scanning.devices.map(d => mediaPlayers.get(d)!);
				await Promise.all(players.map(p => p.stopClientPromise()));

				await Promise.all(players.map(p => p.playUrlPromise(url)));

				return players;
			}

			export async function playURLs(
				urls: string[]
			): Promise<castv2.MediaPlayerClass[]> {
				await assertMediaPlayers();

				const players = Scanning.devices.map(d => mediaPlayers.get(d)!);
				await Promise.all(players.map(p => p.stopClientPromise()));

				await Promise.all(
					players.map(async p => {
						const playlist = new Playlist(p.connection.name, {
							on() {}
						});
						const list = playlist._addItems(
							urls.map(url => ({
								url: url,
								contentType: 'audio/mpeg',
								metadata: {}
							})),
							{},
							false
						);
						await p._player.queueLoadPromise(p._player, list, {
							startIndex: 0,
							repeatMode: 'REPEAT_OFF'
						});
					})
				);

				return players;
			}

			export async function stop() {
				Scanning.devices.forEach(assertMediaPlayer);

				const players = Scanning.devices.map(d => mediaPlayers.get(d)!);
				await Promise.all(players.map(p => p.stopClientPromise()));
				return players;
			}
		}
	}

	export namespace External {
		export class Handler extends createExternalClass(true) {
			async stop() {
				return this.runRequest((res, source) => {
					return API.Handler.stop(
						res,
						{
							auth: Auth.Secret.getKey()
						},
						source
					);
				});
			}

			async pasta(pasta: string) {
				return this.runRequest((res, source) => {
					return API.Handler.pasta(
						res,
						{
							pasta: pasta,
							auth: Auth.Secret.getKey()
						},
						source
					);
				});
			}

			async say(text: string, lang: string = 'en') {
				return this.runRequest((res, source) => {
					return API.Handler.say(
						res,
						{
							text,
							lang,
							auth: Auth.Secret.getKey()
						},
						source
					);
				});
			}

			async url(url: string) {
				return this.runRequest((res, source) => {
					return API.Handler.url(
						res,
						{
							url,
							auth: Auth.Secret.getKey()
						},
						source
					);
				});
			}
		}
	}

	export namespace Bot {
		export interface JSON {}

		export class Bot extends BotState.Base {
			static readonly commands = {
				'/castoff': 'Turn off cast that is playing',
				'/casturl': 'Cast given URL',
				'/say': 'Say given text',
				'/pasta': 'Serve given pasta',
				'/pastas': 'List all pastas',
				'/mp3s': 'List all mp3 files'
			};

			static readonly botName = 'Cast';

			static readonly matches = Bot.createMatchMaker(
				({ matchMaker: mm }) => {
					mm('/castoff', /stop cast(ing)?/, async ({ logObj }) => {
						await new External.Handler(logObj, 'CAST.BOT').stop();
						return 'Stopped casting';
					});
					mm(
						/(cast url|\/casturl)(\s*)(.*)/,
						async ({ logObj, match }) => {
							await new External.Handler(logObj, 'CAST.BOT').url(
								match[3]
							);
							return `Casting URL "${match[3]}"`;
						}
					);
					mm(
						/(say|\/say)(\s*)(in lang(uage)?(\s*)(\w+))?(\s*)(.*)/,
						async ({ logObj, match }) => {
							const lang = match[6] || 'en';
							const text = match[8];
							await new External.Handler(logObj, 'CAST.BOT').say(
								text,
								lang
							);
							return `Saying "${text}" in lang "${lang}"`;
						}
					);
					mm(
						/\/pastas/,
						/show me all (of your)? pasta(s)?/,
						/what pasta(s)? do you have/,
						async ({}) => {
							return `The pastas we have are: ${Bot.formatList(
								Object.keys(Pasta.PASTAS)
							)}`;
						}
					);
					mm(
						/(pasta|show pasta|play pasta|\/pasta)(\s*)(.*)/,
						async ({ logObj, match }) => {
							const pasta = match[3];
							if (!(pasta in Pasta.PASTAS)) {
								return 'We don\'t have that pasta';
							}
							await new External.Handler(
								logObj,
								'CAST.BOT'
							).pasta(pasta);
							return `Played pasta: "${pasta}"`;
						}
					);
					mm(/\/mp3s/, /show all mp3s/, async ({}) => {
						return `The mp3s are: ${Bot.formatList(
							Object.keys(LocalURLS.LOCAL_URLS)
						)}`;
					});
				}
			);

			constructor(_json?: JsonWebKey) {
				super();
			}

			static async match(
				config: _Bot.Message.MatchParameters
			): Promise<_Bot.Message.MatchResponse | undefined> {
				return await this.matchLines({
					...config,
					matchConfig: Bot.matches
				});
			}

			toJSON(): JSON {
				return {};
			}
		}
	}

	export namespace API {
		export class Handler {
			@errorHandle
			@requireParams('url')
			@auth
			static async url(
				res: ResponseLike,
				{
					url
				}: {
					url: string;
					auth?: string;
				},
				source: string
			) {
				if (url in LocalURLS.LOCAL_URLS) {
					url = LocalURLS.LOCAL_URLS[url];
				}

				const mediaPlayers = await Casting.Media.playURL(url);
				const playerLog = attachSourcedMessage(
					res,
					source,
					await meta.explainHook,
					`Playing on ${mediaPlayers.length} players`
				);
				attachMessage(
					playerLog,
					`Device names: ${mediaPlayers.map(p => p.connection.name)}`
				);
				attachMessage(
					playerLog,
					`Device IPs: ${mediaPlayers.map(p => p.connection.host)}`
				);
				res.status(200).write('Success');
				res.end();
				return mediaPlayers;
			}

			@errorHandle
			@auth
			static async stop(
				res: ResponseLike,
				{}: {
					auth?: string;
				},
				source: string
			) {
				const mediaPlayers = await Casting.Media.stop();
				attachSourcedMessage(
					res,
					source,
					await meta.explainHook,
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
					lang = 'en'
				}: {
					text: string;
					lang?: string;
					auth?: string;
				},
				source: string
			) {
				const urls = await TTS.tts(text, lang)('API.say', res);
				attachMessage(res, `Got urls ${urls.join(', ')}`);

				const mediaPlayers = await Casting.Media.playURLs(urls);
				attachSourcedMessage(
					res,
					source,
					await meta.explainHook,
					`Saying in lang "${lang}": "${text}"`
				);
				const playerLog = attachMessage(
					res,
					`Playing on ${mediaPlayers.length} players`
				);
				attachMessage(
					playerLog,
					`Device names: ${mediaPlayers.map(p => p.connection.name)}`
				);
				attachMessage(
					playerLog,
					`Device IPs: ${mediaPlayers.map(p => p.connection.host)}`
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
					pasta
				}: {
					pasta: string;
					auth?: string;
				},
				source: string
			) {
				if (!(pasta in Pasta.PASTAS)) {
					res.status(400).write('Unknown pasta');
					res.end();
					return;
				}
				const { lang, text } = Pasta.PASTAS[pasta];
				const urls = await TTS.tts(text, lang)('API.pasta', res);

				attachMessage(res, `Got urls ${urls.join(', ')}`);
				const mediaPlayers = await Casting.Media.playURLs(urls);
				attachSourcedMessage(
					res,
					source,
					await meta.explainHook,
					`Saying pasta in lang "${lang}": "${text}"`
				);
				const playerLog = attachMessage(
					res,
					`Playing on ${mediaPlayers.length} players`
				);
				attachMessage(
					playerLog,
					`Device names: ${mediaPlayers.map(p => p.connection.name)}`
				);
				attachMessage(
					playerLog,
					`Device IPs: ${mediaPlayers.map(p => p.connection.host)}`
				);
				res.status(200).write('Success');
				res.end();
				return mediaPlayers;
			}
		}
	}

	export namespace Routing {
		export async function init({ app }: ModuleConfig) {
			await External.Handler.init();

			const router = createRouter(Cast, API.Handler);
			router.get('/:auth/stop', 'stop');
			router.post('/stop', 'stop');
			router.get('/:auth/cast/:url', 'url');
			router.post('/cast/:url?', 'url');
			router.get('/:auth/say/:text/:lang?', 'say');
			router.post('/say/:text?/:lang?', 'say');
			router.post('/pasta/:pasta?', 'pasta');
			router.use(app);
		}
	}
}
