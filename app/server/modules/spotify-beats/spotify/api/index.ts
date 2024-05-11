import { logOutgoingRes, logTag } from '@server/lib/logger';
import { SpotifyTypes } from '@server/types/spotify';
import { SpotifyAPIEndpoints } from '@server/modules/spotify-beats/spotify/api/endpoints';
import { Database } from '@server/lib/db';
import { wait } from '@server/lib/util';
import { getEnv } from '@server/lib/io';
import chalk from 'chalk';

export interface ExtendedResponse<R> extends Response {
	clone(): ExtendedResponse<R>;
	json(): Promise<R>;
}

export class API {
	private static readonly SPOTIFY_BASE = 'https://api.spotify.com';
	private readonly _clientId: string;
	private readonly _clientSecret: string;
	private readonly _redirectURI: string;
	private _token?: string;
	private readonly _db: Database;

	private _refreshToken?: string;
	private _refresher: NodeJS.Timeout | null = null;
	public endpoints = new SpotifyAPIEndpoints(this);

	public constructor({
		clientId,
		clientSecret,
		redirectURI,
		token,
		db,
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

	private async _checkCreatedToken(
		response: ExtendedResponse<SpotifyTypes.Endpoints.AuthToken>
	) {
		if (response.status !== 200) {
			return false;
		}

		const { access_token, refresh_token, expires_in } =
			await response.json();

		this.setToken(access_token);
		this.setRefresh(refresh_token, expires_in);

		return await this.testAuth();
	}

	private _getHeaders() {
		return {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			Authorization: `Bearer ${this._token!}`,
		};
	}

	public setToken(token: string): void {
		this._token = token;

		this._db.setVal('token', token);
	}

	public setRefresh(token: string, expireTime: number): void {
		if (this._refresher) {
			clearTimeout(this._refresher);
		}
		this._refreshToken = token;
		this._db.setVal('refresh', token);

		this._refresher = setTimeout(
			() => {
				void this.refreshToken().then(() => {
					if (this._refresher) {
						clearTimeout(this._refresher);
					}
				});
			},
			expireTime * 1000 * 0.9
		);
	}

	public async refreshToken(): Promise<boolean | null> {
		const response = await this.post<SpotifyTypes.Endpoints.AuthToken>(
			'/api/token',
			`grant_type=refresh_token&refresh_token=${this._refreshToken!}`,
			{
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					Authorization: `Basic ${Buffer.from(
						`${this._clientId}:${this._clientSecret}`
					).toString('base64')}`,
				},
				base: 'https://accounts.spotify.com',
			}
		);
		if (!response) {
			return false;
		}
		return this._checkCreatedToken(response);
	}

	public async wrapRequest<R>(
		path: string,
		request: () => Promise<ExtendedResponse<R>>,
		method: string,
		silent = false
	): Promise<ExtendedResponse<R> | null> {
		const url = `${API.SPOTIFY_BASE}${path}`;
		try {
			const response = await request();
			logOutgoingRes(response, {
				method,
				path,
			});
			switch (response.status) {
				case 200:
				case 201:
				case 202:
				case 204:
				case 304:
					return response;
				case 400:
				case 401:
				case 403:
				case 500:
				case 502:
					if (!silent) {
						logTag(
							'spotify',
							'cyan',
							chalk.red(
								`Spotify API request failed on URL ${url}`
							),
							await response.text()
						);
					}
					return null;
				case 429:
					await wait(
						1000 *
							(parseInt(
								response.headers.get('Retry-After') || '60',
								10
							) +
								1)
					);
					return this.wrapRequest(path, request, method, silent);
				case 503:
					await wait(1000 * 60);
					return this.wrapRequest(path, request, method, silent);
			}
			if (!silent) {
				logTag(
					'spotify',
					'cyan',
					chalk.red(
						`Unknown status code ${response.status} on URL ${url}`
					),
					await response.text()
				);
			}
			return null;
		} catch (e) {
			logTag(
				'spotify',
				'cyan',
				chalk.red(`Error in making request on URL ${url}`),
				e
			);
			return null;
		}
	}

	public async get<R>(
		path: string,
		silent = false
	): Promise<ExtendedResponse<R> | null> {
		const ret = await this.wrapRequest(
			path,
			() => {
				return fetch(`${API.SPOTIFY_BASE}${path}`, {
					headers: this._getHeaders(),
				});
			},
			'get',
			silent
		);
		return ret;
	}

	public post<R>(
		path: string,
		data: string,
		options: {
			headers?: {
				[key: string]: string;
			};
			base?: string;
			silent?: boolean;
		} = {}
	): Promise<ExtendedResponse<R> | null> {
		return this.wrapRequest(
			path,
			() => {
				return fetch(`${options.base || API.SPOTIFY_BASE}${path}`, {
					method: 'post',
					headers: {
						...this._getHeaders(),
						...(options.headers || {}),
					},
					body: data,
				});
			},
			'post',
			options.silent || false
		);
	}

	public put<R>(
		path: string,
		data: string,
		options: {
			headers?: {
				[key: string]: string;
			};
			base?: string;
			silent?: boolean;
		} = {}
	): Promise<ExtendedResponse<R> | null> {
		return this.wrapRequest(
			path,
			() => {
				return fetch(`${options.base || API.SPOTIFY_BASE}${path}`, {
					method: 'put',
					headers: {
						...this._getHeaders(),
						...(options.headers || {}),
					},
					body: data,
				});
			},
			'put',
			options.silent || false
		);
	}

	public createAuthURL(scopes: string[], state = ''): string {
		return `https://accounts.spotify.com/authorize?client_id=${
			this._clientId
		}&response_type=code&redirect_uri=${
			this._redirectURI
		}&scope=${scopes.join('%20')}&state=${state}`;
	}

	public async grantAuthCode(token: string): Promise<boolean | null> {
		const response = await this.post<SpotifyTypes.Endpoints.AuthToken>(
			'/api/token',
			`grant_type=authorization_code&code=${token}&redirect_uri=${this._redirectURI}`,
			{
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					Authorization: `Basic ${Buffer.from(
						`${this._clientId}:${this._clientSecret}`
					).toString('base64')}`,
				},
				base: 'https://accounts.spotify.com',
			}
		);
		if (!response) {
			return false;
		}
		return this._checkCreatedToken(response);
	}

	public async testAuth(): Promise<boolean> {
		try {
			const response = await this.get('/v1/me', true);
			return !!(response && response.status === 200);
		} catch (e) {
			console.log('error', e);
		}
		return false;
	}
}

let _api: API | null = null;
export function createSpotifyAPI(db: Database): API | null {
	try {
		const { id, secret, redirect_url_base } = {
			id: getEnv('SECRET_SPOTIFY_ID', true),
			secret: getEnv('SECRET_SPOTIFY_SECRET', true),
			redirect_url_base: getEnv('SECRET_SPOTIFY_REDIRECT_URL_BASE', true),
		};
		return (_api = new API({
			clientId: id,
			clientSecret: secret,
			redirectURI: `${redirect_url_base}/spotify/redirect`,
			db,
		}));
	} catch (e) {
		logTag('spotify', 'cyan', chalk.red('Failed to set up spotify API'), e);
		return null;
	}
}

export function getSpotifyAPI(): API {
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
	const api = getSpotifyAPI();
	const response = await api.endpoints.player();
	const responseTime = Date.now();
	if (!response) {
		return { playing: false };
	}

	if (response.status === 204) {
		return {
			playing: false,
		};
	}

	const { is_playing, item, progress_ms } = await response.json();
	const playStart = responseTime - progress_ms;

	return {
		playing: is_playing,
		playStart,
		playingID: item?.id || undefined,
		duration: item?.duration_ms || undefined,
		playTime: progress_ms,
	};
}

export interface SongInfo {
	beats: SpotifyTypes.TimeInterval[];
	duration: number;
}
export async function getSongInfo(id: string): Promise<SongInfo | null> {
	const api = getSpotifyAPI();
	const response = await api.endpoints.audioAnalysis(id);
	if (!response) {
		return null;
	}

	const { beats, track } = await response.json();
	return {
		beats: beats,
		duration: track.duration,
	};
}
