declare module 'castv2-player' {
	interface Device {
		id: string;
		name: string;
		host: string;
		port: number;
		type: string;
	}

	export function ScannerPromise(
		logger?: any
	): (name?: string) => Promise<Device>;

	interface Playlist {
		insertPromise(
			url: string,
			options?: any,
			disableCheck?: boolean
		): Promise<void>;
	}

	interface PersistentPlayer {
		_playlist: Playlist;
		queueLoadPromise(
			player: PersistentPlayer,
			list: any[],
			config: {
				startIndex: number;
				repeatMode: string;
			}
		): Promise<void>;
	}

	export class MediaPlayerClass {
		new(device: Device): MediaPlayerClass;
		constructor(device: Device);

		connection: Device;
		_player: PersistentPlayer;

		playUrlPromise(url: string, options?: any): Promise<void>;
		close(): void;

		getVolume(): number;
		isMuted(): boolean;
		getVolumePromise(): Promise<number>;
		setVolumePromise(volume: number): Promise<void>;
		mutePromise(volume: number): Promise<void>;
		unmutePromise(volume: number): Promise<void>;
		stopClientPromise(): Promise<void>;
		getClientStatus(): string;
		getPreviousClientStatus(): string;
		pausePromise(): Promise<void>;
		playPromise(): Promise<void>;
		stopPromise(): Promise<void>;

		seekPromise(currentTime: number): Promise<void>;
		getStatusPromise(): Promise<string>;
		getPlayerStatus(): string;
		getPreviousPlayerStatus(): string;

		getCurrentPlaylistIndex(): number;
		getCurrentPlaylistId(): number;
		getPlaylist(id: number): any;
		getPlaylistItemWithId(id: number): any;
		getPlaylistItemWithIndex(index: number): any;

		updatePlaylistPromise(items: any[], options?: any): Promise<void>;
		insertIntoPlaylistPromise(items: any[], options?: any): Promise<void>;
		removeFromPlaylistPromise(
			itemIds: number[],
			options?: any
		): Promise<void>;
		reorderPlaylistPromise(itemIds: number[], options?: any): Promise<void>;
		jumpInPlaylistPromise(jump: number): Promise<void>;

		//set repeatMode - REPEAT_OFF, REPEAT_ALL, REPEAT_SINGLE, REPEAT_ALL_AND_SHUFFLE
		setRepeatModePromise(
			repeatMode:
				| 'REPEAT_OFF'
				| 'REPEAT_ALL'
				| 'REPEAT_SINGLE'
				| 'REPEAT_ALL_AND_SHUFFLE'
		): Promise<void>;
		playAnnouncementPromise(url: string, options?: any): Promise<void>;

		EVENT_PLAYER_PLAYING: string;
		once(event: string, handler: Function): void;
	}

	export function MediaPlayer(logger?: any): typeof MediaPlayerClass;
}

declare module 'castv2-player/lib/playlist' {
	function playlist(logger?: any): typeof playlist.Playlist;

	namespace playlist {
		class Playlist {
			constructor(name: string, thing: any);

			_addItems(
				metaInfo: {
					url: string;
					contentType: string;
					metadata: Object;
				}[],
				options?: any,
				something?: boolean
			): Object[];
		}
	}

	export = playlist;
}
