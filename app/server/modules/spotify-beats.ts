import {
	PLAYSTATE_CHECK_INTERVAL,
	SPOTIFY_SECRETS_FILE,
	BEAT_CACHE_CLEAR_INTERVAL,
	PLAYBACK_CLOSE_RANGE
} from '../lib/constants';
import { SpotifyTypes } from '../types/spotify';
import { log, getTime } from '../lib/logger';
import { BotState } from '../lib/bot-state';
import { AllModules, ModuleConfig } from './modules';
import { Bot as _Bot } from './index';
import { Database } from '../lib/db';
import { Response } from 'node-fetch';
import { ModuleMeta } from './meta';
import { wait } from '../lib/util';
import fetch from 'node-fetch';
import * as fs from 'fs-extra';
import chalk from 'chalk';

export interface BeatChanges {
	playState?: boolean;
	beats?: SpotifyTypes.TimeInterval[];
	playStart?: number;
	duration?: number;

	playbackTime: number;
}

export type FullState = {
	[K in keyof BeatChanges]-?: BeatChanges[K];
};

export namespace SpotifyBeats {
	export const meta = new (class Meta extends ModuleMeta {
		name = 'spotify-beats';

		async init(config: ModuleConfig) {
			Transfer.init(config.db);
			Routing.init(config);
		}

		async notifyModules(modules: AllModules) {
			Transfer.setModules(modules);
		}

		get bot() {
			return Bot;
		}
	})();

	export namespace Spotify {
		export namespace API {
			interface ExtendedResponse<R> extends Response {
				clone(): ExtendedResponse<R>;
				json(): Promise<R>;
			}

			export namespace Endpoints {
				export class Endpoints {
					constructor(public api: API) {}

					player() {
						return this.api.get<SpotifyTypes.Endpoints.Player>(
							'/v1/me/player'
						);
					}

					audioAnalysis(id: string) {
						return this.api.get<
							SpotifyTypes.Endpoints.AudioAnalysis
						>(`/v1/audio-analysis/${id}`);
					}
				}
			}

			class API {
				private _clientId: string;
				private _clientSecret: string;
				private _redirectURI: string;
				private _token?: string;
				private _db: Database;

				private _refreshToken?: string;
				public endpoints = new Endpoints.Endpoints(this);

				constructor({
					clientId,
					clientSecret,
					redirectURI,
					token,
					db
				}: {
					clientId: string;
					clientSecret: string;
					redirectURI: string;
					token?: string;
					db: Database;
				}) {
					this._clientId = clientId;
					this._clientSecret = clientSecret;
					this._redirectURI = redirectURI;
					this._token = token;
					this._db = db;
				}

				async setToken(token: string) {
					this._token = token;

					await this._db.setVal('token', token);
				}

				private _refresher: NodeJS.Timeout | null = null;
				async setRefresh(token: string, expireTime: number) {
					if (this._refresher) {
						clearTimeout(this._refresher);
					}
					this._refreshToken = token;
					await this._db.setVal('refresh', token);

					this._refresher = setTimeout(() => {
						this.refreshToken();
						this._refresher && clearTimeout(this._refresher);
					}, expireTime * 1000 * 0.9);
				}

				private async _checkCreatedToken(
					response: ExtendedResponse<SpotifyTypes.Endpoints.AuthToken>
				) {
					if (response.status !== 200) return false;

					const {
						access_token,
						refresh_token,
						expires_in
					} = await response.json();

					await this.setToken(access_token);
					await this.setRefresh(refresh_token, expires_in);

					return await this.testAuth();
				}

				async refreshToken() {
					const response = await this.post<
						SpotifyTypes.Endpoints.AuthToken
					>(
						'/api/token',
						`grant_type=refresh_token&refresh_token=${this._refreshToken}`,
						{
							headers: {
								'Content-Type':
									'application/x-www-form-urlencoded',
								Authorization: `Basic ${Buffer.from(
									`${this._clientId}:${this._clientSecret}`
								).toString('base64')}`
							},
							base: 'https://accounts.spotify.com'
						}
					);
					if (!response) return false;
					return this._checkCreatedToken(response);
				}

				private static readonly SPOTIFY_BASE =
					'https://api.spotify.com';
				private _getHeaders() {
					return {
						Accept: 'application/json',
						'Content-Type': 'application/json',
						Authorization: `Bearer ${this._token}`
					};
				}

				async wrapRequest<R>(
					path: string,
					request: () => Promise<ExtendedResponse<R>>
				): Promise<ExtendedResponse<R> | null> {
					const url = `${API.SPOTIFY_BASE}${path}`;
					try {
						const response = await request();
						switch (response.status) {
							case 200:
							case 201:
							case 202:
							case 204:
							case 304:
								return response;
							case 400:
							case 403:
							case 500:
							case 502:
								log(
									getTime(),
									chalk.cyan('[spotify]'),
									chalk.red(
										`Spotify API request failed on URL ${url}`
									),
									await response.text()
								);
								return null;
							case 401:
								log(
									getTime(),
									chalk.cyan('[spotify]'),
									`Spotify API request failed (on URL ${url})`,
									await response.text()
								);
								if (!(await this.refreshToken())) {
									await Auth.authFromToken(
										await Auth.generateNew()
									);
								}
								log(
									getTime(),
									chalk.cyan('[spotify]'),
									`Refreshed token`
								);
								return this.wrapRequest(path, request);
							case 429:
								const retryAfter = response.headers.get(
									'Retry-After'
								);
								await wait(
									1000 *
										(parseInt(retryAfter || '60', 10) + 1)
								);
								return this.wrapRequest(path, request);
							case 503:
								await wait(1000 * 60);
								return this.wrapRequest(path, request);
						}
						log(
							getTime(),
							chalk.cyan('[spotify]'),
							chalk.red(
								`Unknown status code ${response.status} on URL ${url}`
							),
							await response.text()
						);
						return null;
					} catch (e) {
						log(
							getTime(),
							chalk.cyan('[spotify]'),
							chalk.red(`Error in making request on URL ${url}`),
							e
						);
						return null;
					}
				}

				async get<R>(
					path: string
				): Promise<ExtendedResponse<R> | null> {
					const ret = await this.wrapRequest(path, () => {
						return fetch(`${API.SPOTIFY_BASE}${path}`, {
							headers: this._getHeaders()
						});
					});
					return ret;
				}

				post<R>(
					path: string,
					data: string,
					options: {
						headers?: {
							[key: string]: string;
						};
						base?: string;
					} = {}
				): Promise<ExtendedResponse<R> | null> {
					return this.wrapRequest(path, () => {
						return fetch(
							`${options.base || API.SPOTIFY_BASE}${path}`,
							{
								method: 'post',
								headers: {
									...this._getHeaders(),
									...(options.headers || {})
								},
								body: data
							}
						);
					});
				}

				createAuthURL(scopes: string[], state: string = '') {
					return `https://accounts.spotify.com/authorize?client_id=${
						this._clientId
					}&response_type=code&redirect_uri=${
						this._redirectURI
					}&scope=${scopes.join('%20')}&state=${state}`;
				}

				async grantAuthCode(token: string) {
					const response = await this.post<
						SpotifyTypes.Endpoints.AuthToken
					>(
						'/api/token',
						`grant_type=authorization_code&code=${token}&redirect_uri=${this._redirectURI}`,
						{
							headers: {
								'Content-Type':
									'application/x-www-form-urlencoded',
								Authorization: `Basic ${Buffer.from(
									`${this._clientId}:${this._clientSecret}`
								).toString('base64')}`
							},
							base: 'https://accounts.spotify.com'
						}
					);
					if (!response) return false;
					return this._checkCreatedToken(response);
				}

				async testAuth() {
					try {
						const response = await this.get('/v1/me');
						return response && response.status === 200;
					} catch (e) {}
					return false;
				}
			}

			let _api: API | null = null;
			export async function create(db: Database) {
				try {
					const { id, secret, redirect_url_base } = JSON.parse(
						await fs.readFile(SPOTIFY_SECRETS_FILE, {
							encoding: 'utf8'
						})
					);
					return (_api = new API({
						clientId: id,
						clientSecret: secret,
						redirectURI: `${redirect_url_base}/spotify/redirect`,
						db
					}));
				} catch (e) {
					log(
						getTime(),
						chalk.cyan('[spotify]'),
						chalk.red('Failed to set up spotify API'),
						e
					);
					return null;
				}
			}

			export function get() {
				return _api!;
			}

			export interface PlaybackState {
				playing: boolean;
				playingID?: string;
				playStart?: number;
				duration?: number;
				playTime?: number;
			}
			export async function getPlayState(): Promise<PlaybackState> {
				const api = get();
				const response = await api.endpoints.player();
				const responseTime = Date.now();
				if (!response) return { playing: false };

				if (response.status === 204) {
					return {
						playing: false
					};
				}

				const { is_playing, item, progress_ms } = await response.json();
				const playStart = responseTime - progress_ms;

				return {
					playing: is_playing,
					playStart,
					playingID: (item && item.id) || undefined,
					duration: (item && item.duration_ms) || undefined,
					playTime: progress_ms
				};
			}

			export interface SongInfo {
				beats: SpotifyTypes.TimeInterval[];
				duration: number;
			}
			export async function getSongInfo(
				id: string
			): Promise<SongInfo | null> {
				const api = get();
				const response = await api.endpoints.audioAnalysis(id);
				if (!response) return null;

				const { beats, track } = await response.json();
				return {
					beats: beats,
					duration: track.duration
				};
			}
		}

		export namespace Checking {
			function isInRange(base: number, target: number, diff: number) {
				return Math.abs(base - target) <= diff;
			}

			const beatCache: Map<
				string,
				SpotifyTypes.TimeInterval[]
			> = new Map();

			async function checkForChanges(
				oldState: API.PlaybackState | null,
				newState: API.PlaybackState
			): Promise<BeatChanges> {
				const changes: BeatChanges = {
					playbackTime: newState.playTime!
				};
				if (!oldState || oldState.playing !== newState.playing) {
					changes.playState = newState.playing;
				}
				if (!oldState || oldState.playingID !== newState.playingID) {
					if (!newState.playingID) {
						changes.beats = [];
					} else {
						if (beatCache.has(newState.playingID)) {
							changes.beats = beatCache.get(newState.playingID)!;
						} else {
							const response = await API.getSongInfo(
								newState.playingID
							);
							if (!response) {
								changes.beats = [];
							} else {
								beatCache.set(
									newState.playingID,
									response.beats
								);
								changes.beats = response.beats;
							}
						}
					}
				}
				if (
					newState.playStart &&
					(!oldState || oldState.playStart !== newState.playStart) &&
					!isInRange(
						oldState?.playStart || 0,
						newState.playStart,
						PLAYBACK_CLOSE_RANGE
					) &&
					// Don't send time difference when we are pausing and don't
					// keep sending time differences while paused
					newState.playing !== false
				) {
					changes.playStart = newState.playStart;
				}
				if (oldState?.duration !== newState.duration) {
					changes.duration = newState.duration;
				}
				return changes;
			}

			function getFullState(state: API.PlaybackState): FullState {
				return {
					beats: beatCache.get(state.playingID!)!,
					duration: state.duration!,
					playStart: state.playStart!,
					playState: state.playing,
					playbackTime: state.playTime!
				};
			}

			export async function start() {
				let lastState: API.PlaybackState | null = null;
				while (true) {
					const state = await API.getPlayState();
					const changes = await checkForChanges(lastState, state);
					lastState = state;

					await Transfer.notifyChanges(getFullState(state), changes);
					await wait(PLAYSTATE_CHECK_INTERVAL);
				}
			}

			export function init() {
				setInterval(() => {
					beatCache.clear();
				}, BEAT_CACHE_CLEAR_INTERVAL);
			}
		}

		export namespace Auth {
			export async function authFromToken(token: string) {
				const api = API.get();
				if (!(await api.grantAuthCode(token))) return;
			}

			let _resolveGenerateNew: null | ((token: string) => void) = null;
			export async function finishManualAuth(token: string) {
				if (_resolveGenerateNew) {
					_resolveGenerateNew(token);
				}
			}

			export let lastURL: string | null = null;
			export async function generateNew() {
				const api = API.get()!;
				const url = api!.createAuthURL(
					[
						'user-read-currently-playing',
						'user-read-playback-state',
						'user-read-private',
						'user-read-email'
					],
					'generate-new'
				);
				lastURL = url;
				console.log(url);

				return new Promise<string>(resolve => {
					_resolveGenerateNew = resolve;
				});
			}

			export async function loopForToken() {
				let token = await Auth.generateNew();
				do {
					try {
						await Auth.authFromToken(token);
						break;
					} catch (e) {
						console.log('Failed', e);
						// We need to get a fresh token
						token = await Auth.generateNew();
					}
				} while (true);
			}
		}

		export async function init(db: Database) {
			const api = await API.create(db);
			if (!api) return;

			let token = db.get('token', 'default');
			let refresh = db.get('refresh', 'default');
			await api.setToken(token);
			await api.setRefresh(refresh, 100000);

			// Test it
			if (!(await api.testAuth())) {
				await Auth.loopForToken();
			}

			log(getTime(), chalk.cyan('[spotify]'), 'Authenticated');

			Checking.start();
		}
	}

	export namespace Bot {
		export interface JSON {}

		export class Bot extends BotState.Base {
			static readonly commands = {
				'/auth': 'Authenticate spotify (if needed)'
			};

			static readonly botName = 'Spotify';

			static readonly matches = Bot.createMatchMaker(
				({ matchMaker: mm, fallbackSetter: fallback }) => {
					mm('/auth', /auth(enticate)?( spotify)?/, async () => {
						const api = Spotify.API.get();
						if (await api.testAuth()) {
							return 'Authenticated!';
						}
						return `Please authenticate with URL ${Spotify.Auth.lastURL}`;
					});
					mm(
						'/help_spotify',
						/what commands are there for keyval/,
						async () => {
							return `Commands are:\n${Bot.matches.matches
								.map(match => {
									return `RegExps: ${match.regexps
										.map(r => r.source)
										.join(', ')}. Texts: ${match.texts.join(
										', '
									)}}`;
								})
								.join('\n')}`;
						}
					);

					fallback(({ state }) => {
						Bot.resetState(state);
					});
				}
			);

			lastSubjects: string[] | null = null;

			constructor(_json?: JSON) {
				super();
			}

			static async match(config: {
				logObj: any;
				text: string;
				message: _Bot.TelegramMessage;
				state: _Bot.Message.StateKeeping.ChatState;
			}): Promise<_Bot.Message.MatchResponse | undefined> {
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

	export namespace Transfer {
		let _modules: AllModules | null = null;
		let _modulePromiseResolve: () => void;
		let _modulesPromise: Promise<void> = new Promise(resolve => {
			_modulePromiseResolve = resolve;
		});
		export async function getModules() {
			if (_modules) return _modules;
			await _modulesPromise;
			return _modules!;
		}

		export function setModules(modules: AllModules) {
			_modules = modules;
			_modulePromiseResolve();
		}

		export async function init(db: Database) {
			await Spotify.init(db);
		}

		export async function notifyChanges(
			fullState: FullState,
			changes: BeatChanges
		) {
			if (!_modules) return;

			await _modules.RGB.Board.BeatFlash.notifyChanges(
				fullState,
				changes
			);
		}
	}

	export namespace Routing {
		export async function init({ app }: ModuleConfig) {
			app.get('/spotify/redirect', async (req, res) => {
				const getParams = req.query;
				const code = getParams['code'];
				if (code) {
					Spotify.Auth.finishManualAuth(code);
				}

				res.write('Done!');
				res.status(200);
				res.end();
			});
		}
	}
}
