export namespace SpotifyTypes {
	export type DeviceType =
		| 'Computer'
		| 'Tablet'
		| 'Smartphone'
		| 'Speaker'
		| 'TV'
		| 'AVR'
		| 'STB'
		| 'AudioDongle'
		| 'GameConsole'
		| 'CastVideo'
		| 'CastAudio'
		| 'Automobile'
		| 'unknown';

	export interface Device {
		id: string;
		is_active: boolean;
		is_private_session: boolean;
		is_restricted: boolean;
		name: string;
		type: DeviceType;
		volume_percent: number | null;
	}

	export interface ExternalURLs {
		[key: string]: string;
	}

	export interface Context {
		uri: string;
		href: string;
		type: 'album' | 'artist' | 'playlist';
		external_urls: ExternalURLs;
	}

	export interface SimpleArtist {
		external_urls: ExternalURLs;
		href: string;
		id: string;
		name: string;
		type: 'artist';
		uri: string;
	}

	export interface Image {
		height?: number | null;
		url: string;
		width?: number | null;
	}

	export interface SimpleAlbum {
		album_group?: 'album' | 'single' | 'compilation' | 'appears_on';
		album_type: 'album' | 'single' | 'compilation';
		artists: SimpleArtist[];
		available_markets: string[];
		external_urls: ExternalURLs;
		href: string;
		id: string;
		images: Image[];
		name: string;
		release_date: string;
		release_date_precision: string;
		restrictions?: {
			reason: string;
		};
		type: 'album';
		uri: string;
	}

	export interface ExternalIDs {
		[key: string]: string;
	}

	export interface LinkedTrack {
		external_urls: ExternalURLs;
		href: string;
		id: string;
		type: 'track';
		uri: string;
	}

	export interface Track {
		album: SimpleAlbum;
		artists: SimpleArtist[];
		available_markets: string[];
		disc_number: number;
		duration_ms: number;
		explicit: boolean;
		external_ids: ExternalIDs;
		external_urls: ExternalURLs;
		href: string;
		id: string;
		is_playable: boolean;
		linked_from: LinkedTrack;
		restrictions: {
			reason: string;
		};
		name: string;
		popularity: number;
		preview_url: string | null;
		track_number: number;
		type: 'track';
		uri: string;
		is_local: boolean;
	}

	export interface TimeInterval {
		start: number;
		duration: number;
		confidence: number;
	}

	export interface Section {
		start: number;
		duration: number;
		confidence: number;
		loudness: number;
		tempo: number;
		tempo_confidence: number;
		key: number;
		key_confidence: number;
		mode: number;
		mode_confidence: number;
		time_signature: number;
		time_signature_confidence: number;
	}

	export interface Segment {
		start: number;
		duration: number;
		confidence: number;
		loudness_start: number;
		loudness_max_time: number;
		loudness_max: number;
		loudness_end: number;
		pitches: number[];
		timbre: number[];
	}

	export interface Paging<V> {
		href: string;
		items: V[];
		limit: number;
		next: string | null;
		offset: number;
		previous: string | null;
		total: number;
	}

	export interface Followers {
		href: string | null;
		total: number;
	}

	export interface PublicUser {
		display_name: string;
		external_urls: ExternalURLs;
		followers: Followers;
		href: string;
		id: string;
		images: Image[];
		type: 'user';
		uri: string;
	}

	export interface Playlist {
		collaborative: boolean;
		description: string;
		external_urls: ExternalURLs;
		followers: Followers;
		href: string;
		id: string;
		images: Image[];
		name: string;
		owner: PublicUser;
		public: boolean | null;
		snapshot_id: string;
		tracks: Paging<PlaylistTrack>;
		type: 'playlist';
		uri: string;
	}

	export interface PlaylistTrack {
		added_at: number;
		added_by: PublicUser;
		is_local: boolean;
		track: Track;
	}

	export namespace Endpoints {
		export interface AuthToken {
			access_token: string;
			token_type: string;
			scope: string;
			expires_in: number;
			refresh_token: string;
		}

		export interface Player {
			device: Device;
			repeat_state: 'off' | 'track' | 'context';
			shuffle_state: boolean;
			context: Context;
			timestamp: number;
			progress_ms: number;
			is_playing: boolean;
			item: Track | null;
			currently_playing_type: 'track' | 'episode' | 'ad' | 'unknown';
			actions: {
				disallows: {
					[key: string]: boolean;
				};
			};
		}

		export interface Devices {
			devices: Device[];
		}

		export interface AudioAnalysis {
			meta: {
				analyzer_version: string;
				platform: string;
				detailed_status: string;
				status_code: number;
				timestamp: number;
				analysis_time: number;
				input_process: string;
			};
			track: {
				num_samples: number;
				duration: number;
				sample_md5: string;
				offset_seconds: number;
				window_seconds: number;
				analysis_sample_rate: number;
				analysis_channels: number;
				end_of_fade_in: number;
				start_of_fade_out: number;
				loudness: number;
				tempo: number;
				tempo_confidence: number;
				time_signature: number;
				time_signature_confidence: number;
				key: number;
				key_confidence: number;
				mode: number;
				mode_confidence: number;
				codestring: string;
				code_version: number;
				echoprintstring: string;
				echorint_vesion: number;
				synchstring: string;
				synch_version: number;
				rhythmstring: string;
				rhythm_version: number;
			};
			bars: TimeInterval[];
			beats: TimeInterval[];
			tatums: TimeInterval[];
			sections: Section[];
			segments: Segment[];
		}

		export type Play = Playlist;
	}
}
