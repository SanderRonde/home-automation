import { LOCAL_URLS as _LOCAL_URLS, PASTAS as _PASTAS } from '../config/casts';
import { attachMessage, ResDummy } from '../lib/logger';
import * as playlist from 'castv2-player/lib/playlist';
import { requireParams } from '../lib/decorators';
import { errorHandle } from '../lib/decorators';
import { BotState } from '../lib/bot-state';
import { AppWrapper } from '../lib/routes';
import { auth } from '../lib/decorators';
import * as castv2 from 'castv2-player';
import { ResponseLike } from './multi';
import { Bot as _Bot } from './bot';
import { Auth } from '../lib/auth';

class DummyLog {
	constructor (public componentName: string = 'castv2'){ };  

	_addPrefix (firstArg?: any, ...args: any[]) {
		if (firstArg) {
			return [`${this.componentName} - ${firstArg}`, ...args]
		};
		return [];
	}

	error () {
		console.error.apply(console, this._addPrefix(...arguments));
	}
	warn () {}  
	info() {}
	debug() {}
}

const scannerPromise = castv2.ScannerPromise(new DummyLog());
const MediaPlayer = castv2.MediaPlayer(new DummyLog());
const Playlist = playlist(new DummyLog());
const MAX_PART_LEN = 190;

export namespace Cast {
	export namespace Scanning {
		export async function scan(): Promise<castv2.Device> {
			const device = await scannerPromise();
			if (device) {
				devices = [device];
			}
			return device;
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
			const parts = splitTTSParts(text);
			return parts.map((part) => {
				return `https://translate.google.com/translate_tts?ie=UTF-8&tl=${
					lang}&q=${encodeURIComponent(part)}&client=tw-ob`;
			});
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
			const mediaPlayers: WeakMap<castv2.Device, castv2.MediaPlayerClass> = new WeakMap();

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

			export async function playURL(url: string): Promise<castv2.MediaPlayerClass[]> {
				await assertMediaPlayers();

				const players = Scanning.devices.map(d => mediaPlayers.get(d)!);
				await Promise.all(players.map(p => p.stopClientPromise()));

				await Promise.all(players.map(p => p.playUrlPromise(url)));

				return players;
			}

			export async function playURLs(urls: string[]): Promise<castv2.MediaPlayerClass[]> {
				await assertMediaPlayers();

				const players = Scanning.devices.map(d => mediaPlayers.get(d)!);
				await Promise.all(players.map(p => p.stopClientPromise()));

				await Promise.all(players.map(async (p) => {
					const playlist = new Playlist(p.connection.name, {
						on() {}
					});
					const list = playlist._addItems(urls.map((url) => ({
						url: url,
						contentType: 'audio/mpeg',
						metadata: {}
					})), {}, false);
					await p._player.queueLoadPromise(p._player,
						list, {
							startIndex: 0,
							repeatMode: 'REPEAT_OFF'
						});
				}));

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
		type ExternalRequest = ({
			type: 'stop';
		}|{
			type: 'pasta';
			pasta: string;
		}|{
			type: 'say';
			text: string;
			lang?: string;
		}|{
			type: 'url';
			url: string;
		}) & {
			logObj: any;
			resolver: () => void;
		};

		export class Handler {
			private static _requests: ExternalRequest[] = [];
			private static _ready: boolean = false;

			constructor(private _logObj: any) {}

			static async init() {
				this._ready = true;
				for (const req of this._requests) {
					await this._handleRequest(req);
				}
			}

			private static async _handleRequest(request: ExternalRequest) {
				const { logObj } = request;
				const resDummy = new ResDummy();
				switch (request.type) {
					case 'url':
						await API.Handler.url(resDummy, {
							url: request.url,
							auth: await Auth.Secret.getKey()
						});
						resDummy.transferTo(logObj);
						request.resolver();
						break;
					case 'say':
						await API.Handler.say(resDummy, {
							text: request.text,
							lang: request.lang,
							auth: await Auth.Secret.getKey()
						});
						resDummy.transferTo(logObj);
						request.resolver();
						break;
					case 'pasta':
						await API.Handler.pasta(resDummy, {
							pasta: request.pasta,
							auth: await Auth.Secret.getKey()
						});
						resDummy.transferTo(logObj);
						request.resolver();
						break;
					case 'stop':
						await API.Handler.stop(resDummy, {
							auth: await Auth.Secret.getKey()
						});
						resDummy.transferTo(logObj);
						request.resolver();
						break;
				}
			}

			async stop() {
				return new Promise((resolve) => {
					const req: ExternalRequest = {
						type: 'stop',
						logObj: this._logObj,
						resolver: resolve
					};
					if (Handler._ready) {
						Handler._handleRequest(req);
					} else {
						Handler._requests.push(req);
					}
				});
			}

			async pasta(pasta: string) {
				return new Promise((resolve) => {
					const req: ExternalRequest = {
						type: 'pasta',
						pasta: pasta,
						logObj: this._logObj,
						resolver: resolve
					};
					if (Handler._ready) {
						Handler._handleRequest(req);
					} else {
						Handler._requests.push(req);
					}
				});
			}

			async say(text: string, lang: string = 'en') {
				return new Promise((resolve) => {
					const req: ExternalRequest = {
						type: 'say',
						text,
						lang,
						logObj: this._logObj,
						resolver: resolve
					};
					if (Handler._ready) {
						Handler._handleRequest(req);
					} else {
						Handler._requests.push(req);
					}
				});
			}

			async url(url: string) {
				return new Promise((resolve) => {
					const req: ExternalRequest = {
						type: 'url',
						url,
						logObj: this._logObj,
						resolver: resolve
					};
					if (Handler._ready) {
						Handler._handleRequest(req);
					} else {
						Handler._requests.push(req);
					}
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

			static readonly matches = Bot.createMatchMaker(({
				matchMaker: mm
			}) => {
				mm('/castoff', /stop cast(ing)?/, async ({
					logObj
				}) => {
					await new External.Handler(logObj).stop();
					return 'Stopped casting';
				});
				mm(/(cast url|\/casturl)(\s*)(.*)/, async ({
					logObj, match
				}) => {
					await new External.Handler(logObj).url(match[3]);
					return `Casting URL "${match[3]}"`;
				});
				mm(/(say|\/say)(\s*)(in lang(uage)?(\s*)(\w+))?(\s*)(.*)/, async ({
					logObj, match
				}) => {
					const lang = match[6] || 'en';
					const text = match[8];
					await new External.Handler(logObj).say(text, lang);
					return `Saying "${text}" in lang "${lang}"`;
				});
				mm(/\/pastas/, /show me all (of your)? pasta(s)?/, /what pasta(s)? do you have/, async ({}) => {
					return `The pastas we have are: ${Bot.formatList(Object.keys(Pasta.PASTAS))}`;
				});
				mm(/(pasta|show pasta|play pasta|\/pasta)(\s*)(.*)/, async ({
					logObj, match
				}) => {
					const pasta = match[3];
					if (!(pasta in Pasta.PASTAS)) {
						return 'We don\'t have that pasta';
					}
					await new External.Handler(logObj).pasta(pasta);
					return `Played pasta: "${pasta}"`;
				});
				mm(/\/mp3s/, /show all mp3s/, async ({}) => {
					return `The mp3s are: ${Bot.formatList(Object.keys(LocalURLS.LOCAL_URLS))}`;
				});
			});

			constructor(_json?: JsonWebKey) {
				super();
			}

			static async match(config: { 
				logObj: any; 
				text: string; 
				message: _Bot.TelegramMessage; 
				state: _Bot.Message.StateKeeping.ChatState; 
			}): Promise<_Bot.Message.MatchResponse | undefined> {
				return await this.matchLines({ ...config, matchConfig: Bot.matches });
			}

			toJSON(): JSON {
				return {}
			}
		}
	}

	export namespace API {
		export class Handler {
			@errorHandle
			@requireParams('url')
			@auth
			static async url(res:  ResponseLike, { url }: {
				url: string;
				auth?: string;
			}) {
				if (url in LocalURLS.LOCAL_URLS) {
					url = LocalURLS.LOCAL_URLS[url];
				}

				const mediaPlayers = await Casting.Media.playURL(url);
				const playerLog = attachMessage(res, `Playing on ${mediaPlayers.length} players`);
				attachMessage(playerLog,
					`Device names: ${mediaPlayers.map(p => p.connection.name)}`);
				attachMessage(playerLog,
					`Device IPs: ${mediaPlayers.map(p => p.connection.host)}`);
				res.status(200).write('Success');
				res.end();
				return mediaPlayers;
			}

			@errorHandle
			@auth
			static async stop(res:  ResponseLike, { }: {
				auth?: string;
			}) {
				const mediaPlayers = await Casting.Media.stop();
				attachMessage(res, `Stopped ${mediaPlayers.length} players`)
				res.status(200).write('Success');
				res.end();
				return mediaPlayers;
			}

			@errorHandle
			@auth
			static async say(res: ResponseLike, { text, lang = 'en' }: {
				text: string;
				lang?: string;
				auth?: string;
			}) {
				const urls = TTS.tts(text, lang);
				attachMessage(res, `Got urls ${urls.join(', ')}`);
				
				const mediaPlayers = await Casting.Media.playURLs(urls);
				attachMessage(res, `Saying in lang "${lang}": "${text}"`);
				const playerLog = attachMessage(res, `Playing on ${mediaPlayers.length} players`);
				attachMessage(playerLog,
					`Device names: ${mediaPlayers.map(p => p.connection.name)}`);
				attachMessage(playerLog,
					`Device IPs: ${mediaPlayers.map(p => p.connection.host)}`);
				res.status(200).write('Success');
				res.end();
				return mediaPlayers;
			}

			@errorHandle
			@requireParams('pasta')
			@auth
			static async pasta(res: ResponseLike, { pasta }: {
				pasta: string;
				auth?: string;
			}) {
				if (!(pasta in Pasta.PASTAS)) {
					res.status(400).write('Unknown pasta');
					res.end();
					return;
				}
				const { lang, text } = Pasta.PASTAS[pasta];
				const urls = TTS.tts(text, lang);

				attachMessage(res, `Got urls ${urls.join(', ')}`);
				const mediaPlayers = await Casting.Media.playURLs(urls);
				attachMessage(res, `Saying pasta in lang "${lang}": "${text}"`);
				const playerLog = attachMessage(res, `Playing on ${mediaPlayers.length} players`);
				attachMessage(playerLog,
					`Device names: ${mediaPlayers.map(p => p.connection.name)}`);
				attachMessage(playerLog,
					`Device IPs: ${mediaPlayers.map(p => p.connection.host)}`);
				res.status(200).write('Success');
				res.end();
				return mediaPlayers;
			}
		}
	}

	export namespace Routing {
		export async function init({ 
			app 
		}: { 
			app: AppWrapper; 
		}) {
			await External.Handler.init();

			app.get('/cast/:auth/stop', async (req, res) => {
				await API.Handler.stop(res, {...req.params, ...req.body});
			});
			app.post('/cast/stop', async (req, res) => {
				await API.Handler.stop(res, {...req.params, ...req.body});
			});
			app.get('/cast/:auth/cast/:url', async (req, res) => {
				await API.Handler.url(res, {...req.params, ...req.body});
			});
			app.post('/cast/cast/:url?', async (req, res) => {
				await API.Handler.url(res, {...req.params, ...req.body});
			});
			app.get('/cast/:auth/say/:text/:lang?', async (req, res) => {
				await API.Handler.say(res, {...req.params, ...req.body});
			});
			app.post('/cast/say/:text?/:lang?', async (req, res) => {
				await API.Handler.say(res, {...req.params, ...req.body});
			});
			app.post('/cast/pasta/:pasta?', async (req, res) => {
				await API.Handler.pasta(res, {...req.params, ...req.body});
			})
		}
	}
}

// https://translate.google.com/translate_tts?ie=UTF-8&$tl=en&q=hi%20there&client=tw-ob
// https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=Hello+World
