declare module '*/node-switchbot' {
	export interface SwitchbotAdvertisement {
		id: string;
		address: string;
		rssi: number;
		serviceData: {
			model: string;
			modelName: string;
			calibration: boolean;
			battery: number;
			inMotion: boolean;
			position: number;
			lightLevel: number;
			deviceChain: number;
		};
	}

	export declare class SwitchbotWoDeviceBase {
		readonly id: string;
		readonly address: string;
		readonly model: string;
		readonly modelName: string;
		readonly connectionState: 'disconnected' | 'connecting' | 'connected';

		onconnect: () => void;
		ondisconnect: () => void;

		connect(): Promise<void>;
		disconnect(): Promise<void>;

		getDeviceName(): Promise<string>;
		setDeviceName(name: string): Promise<void>;
	}

	declare enum SwitchbotCurtainMode {
		Performance = 0,
		Silent = 1,
		Default = 0xff,
	}

	export declare class SwitchbotWoDeviceCurtain extends SwitchbotWoDeviceBase {
		open: () => Promise<void>;
		close: () => Promise<void>;
		pause: () => Promise<void>;
		runToPos: (
			percent: number,
			mode?: SwitchbotCurtainMode
		) => Promise<void>;
	}

	export type SwitchBotDevice = SwitchbotWoDeviceCurtain;

	export class SwitchBot {
		public startScan(): Promise<void>;
		public stopScan(): Promise<void>;
		public wait(time: number): Promise<void>;
		public onadvertisement: (ad: SwitchbotAdvertisement) => void;

		public discover(options?: {
			duration?: number;
			model?: string;
			id?: string;
			quick?: boolean;
		}): Promise<SwitchBotDevice[]>;
	}
}
