import { AndroidControlLevelControlCluster, AndroidControlOnOffCluster } from '../cluster';
import { Device as AdbDevice } from '@devicefarmer/adbkit';
import { DEBUG_FOLDER } from '../../../../lib/constants';
import { logTag } from '../../../../lib/logging/logger';
import { DeviceEndpoint } from '../../../device/device';
import { AndroidControlProfileClient } from './base';
import { Cluster } from '../../../device/cluster';
import { wait } from '../../../../lib/time';
import { Data } from '../../../../lib/data';
import { AppConfig } from '../../../../app';
import { intToRGBA, Jimp } from 'jimp';
import { mkdir } from 'fs/promises';
import path from 'path';

interface FanState {
	isOn: boolean;
	level: number;
	step: number;
	name: string;
}

export class CreateHomeFanClient extends AndroidControlProfileClient implements Disposable {
	private readonly _levelXPositions: number[] = [130, 290, 458, 626, 789, 952];
	private readonly _levelYPosition = 1994;
	private readonly _onOffXPosition = 900;
	private readonly _onOffYPosition = 1695;
	private readonly _step = 1 / 5;

	private _disposables: (() => void)[] = [];
	public readonly clusters: Cluster[] = [];
	public readonly endpoints: DeviceEndpoint[] = [];

	public constructor(
		_deviceId: string,
		device: AdbDevice | null,
		private readonly _appConfig: AppConfig
	) {
		super(_deviceId, device);

		const stateD: Data<FanState> = new Data({
			isOn: false,
			level: 0,
			step: this._step,
			name: 'Speed',
		});

		this.clusters = [
			new AndroidControlOnOffCluster(stateD),
			new AndroidControlLevelControlCluster(stateD),
		];

		// Keep track of "known" state
		let currentState: FanState = stateD.current();

		const interval = setInterval(async () => {
			const stateGetter = this._refreshState();
			const newState = {
				...stateD.current(),
				...(await stateGetter),
			};
			currentState = newState;
			stateD.set(currentState);
		}, 1000);
		this._disposables.push(() => clearInterval(interval));

		// Update handler from children
		this._disposables.push(
			stateD.subscribe((state) => {
				this.onChange.emit(undefined);
				if (!state) {
					return;
				}
				if (currentState.isOn !== state.isOn) {
					this._toggleOn();
				}
				if (currentState.level !== state.level) {
					this._setLevel(state.level, state);
				}
				currentState = state;
			})
		);
	}

	private async _toggleOn() {
		if (!this._device) {
			return;
		}
		await Bun.$`adb -s ${this._deviceId} shell input tap ${this._onOffXPosition} ${this._onOffYPosition}`.quiet();
	}

	private async _setLevel(level: number, state: FanState) {
		if (!this._device) {
			return;
		}
		if (!state.isOn) {
			await this._toggleOn();
			await wait(2000);
		}
		if (level === 0) {
			await Bun.$`adb -s ${this._deviceId} shell input tap 130 1994`.quiet();
		} else if (level === this._step) {
			await Bun.$`adb -s ${this._deviceId} shell input tap 290 1994`.quiet();
		} else if (level === 2 * this._step) {
			await Bun.$`adb -s ${this._deviceId} shell input tap 458 1994`.quiet();
		} else if (level === 3 * this._step) {
			await Bun.$`adb -s ${this._deviceId} shell input tap 626 1994`.quiet();
		} else if (level === 4 * this._step) {
			await Bun.$`adb -s ${this._deviceId} shell input tap 789 1994`.quiet();
		} else if (level === 5 * this._step) {
			await Bun.$`adb -s ${this._deviceId} shell input tap 952 1994`.quiet();
		} else {
			throw new Error(`Invalid level: ${level}`);
		}
	}

	private async _refreshState(): Promise<Omit<FanState, 'step' | 'name'>> {
		// Take a screenshot
		let arrayBuffer: ArrayBuffer;
		try {
			arrayBuffer = await Bun.$`adb -s ${this._deviceId} exec-out screencap -p`
				.quiet()
				.arrayBuffer();
		} catch (error) {
			logTag('android-control', 'red', 'Failed to take screenshot:', error);
			return {
				level: 0,
				isOn: false,
			};
		}
		const image = await Jimp.read(arrayBuffer);
		if (this._appConfig.debug) {
			await mkdir(DEBUG_FOLDER, { recursive: true });
			await image.write(`${path.join(DEBUG_FOLDER, 'create-home-fan-capture')}.png`);
		}

		// Blue if on, white if off
		const isOn =
			intToRGBA(image.getPixelColor(this._onOffXPosition, this._onOffYPosition)).r < 128;
		if (isOn) {
			for (let i = 0; i < this._levelXPositions.length; i++) {
				// Blue if on, grey if off
				const pixelColor = intToRGBA(
					image.getPixelColor(this._levelXPositions[i], this._levelYPosition)
				);
				// The placeholder dots are dimmed blue
				if (pixelColor.r < 128 && pixelColor.b > 250) {
					return {
						level: i * this._step,
						isOn,
					};
				}
			}
		}
		return {
			level: 0,
			isOn,
		};
	}

	public getDeviceName(): Promise<string> {
		return Promise.resolve('Create Home Fan');
	}

	public [Symbol.dispose](): void {
		this._disposables.forEach((dispose) => dispose());
		this._disposables = [];
	}
}
