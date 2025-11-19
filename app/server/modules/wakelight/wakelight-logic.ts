import { DeviceColorControlCluster } from '../device/cluster';
import { DeviceLevelControlCluster } from '../device/cluster';
import { logTag, warning } from '../../lib/logging/logger';
import { DeviceOnOffCluster } from '../device/cluster';
import type { AlarmState, WakelightDB } from './types';
import type { Database } from '../../lib/db';
import type { AllModules } from '../modules';
import { Color } from '../../lib/color.js';

const UPDATE_INTERVAL_SECONDS = 5;

export class WakelightLogic {
	private _intervalId: Timer | null = null;
	private _startTime: number = 0;
	private _deviceSubscriptions: Array<() => void> = [];
	private _isUpdatingDevices: boolean = false;
	private _alarmTimer: Timer | null = null;
	private _alarmState: AlarmState | null = null;

	public constructor(
		private readonly _db: Database<WakelightDB>,
		private readonly _getModules: <T>() => Promise<T>
	) {}

	public getAlarmState(): AlarmState | null {
		return this._alarmState;
	}

	public setAlarmState(state: AlarmState | null): void {
		this._alarmState = state;
	}

	public scheduleAlarm(minutesToAlarm: number): void {
		// Clear existing alarm
		if (this._alarmTimer !== null) {
			clearTimeout(this._alarmTimer);
			this._alarmTimer = null;
		}
		this.cancelWakelight();

		// Get config
		const wakelightConfig = this._db.current().config || {
			deviceIds: [],
			durationMinutes: 7,
		};
		if (wakelightConfig.deviceIds.length === 0) {
			warning('No devices configured for wakelight');
			return;
		}

		const alarmTimestamp = Date.now() + minutesToAlarm * 60 * 1000;
		const startTimestamp = alarmTimestamp - wakelightConfig.durationMinutes * 60 * 1000;
		const timeUntilStart = startTimestamp - Date.now();

		logTag(
			'wakelight',
			'cyan',
			`Alarm scheduled for ${new Date(alarmTimestamp).toLocaleString()}`
		);
		logTag(
			'wakelight',
			'cyan',
			`Wakelight will start at ${new Date(startTimestamp).toLocaleString()}`
		);

		// If start time is in the past, don't start
		if (timeUntilStart < 0) {
			warning(
				'Wakelight start time is in the past, alarm is too soon. Need at least',
				wakelightConfig.durationMinutes,
				'minutes'
			);
			return;
		}

		// Store alarm state
		this._alarmState = {
			alarmTimestamp,
			startTimestamp,
			deviceIds: wakelightConfig.deviceIds,
			durationMinutes: wakelightConfig.durationMinutes,
		};

		// Schedule the wakelight to start
		this._alarmTimer = setTimeout(() => {
			logTag('wakelight', 'green', 'Starting wakelight effect');
			if (this._alarmState) {
				void this.startWakelight(this._alarmState);
			}
			this._alarmTimer = null;
		}, timeUntilStart);
	}

	public async startWakelight(state: AlarmState): Promise<void> {
		// Clear any existing wakelight
		this.cancelWakelight();

		logTag(
			'wakelight',
			'cyan',
			`Starting wakelight for ${state.deviceIds.length} devices over ${state.durationMinutes} minutes`
		);

		// Get devices and validate they support ColorControl
		const devices = await this._getValidDevices(state.deviceIds);
		if (devices.length === 0) {
			warning('No valid devices found for wakelight');
			return;
		}

		// Subscribe to device changes to detect manual intervention
		this._subscribeToDeviceChanges(devices, () => {
			// Only cancel if the change wasn't triggered by our own updates
			if (!this._isUpdatingDevices) {
				logTag(
					'wakelight',
					'yellow',
					'Manual device change detected, cancelling wakelight'
				);
				this.cancelWakelight();
			}
		});

		// Store start time
		this._startTime = Date.now();

		// Set up interval to update brightness
		const totalDurationMs = state.durationMinutes * 60 * 1000;
		const updateIntervalMs = UPDATE_INTERVAL_SECONDS * 1000;

		this._intervalId = setInterval(() => {
			const now = Date.now();
			const elapsed = now - this._startTime;
			const progress = Math.min(elapsed / totalDurationMs, 1.0);

			// Linear brightness curve from 0 to 1
			void this._updateDevicesBrightness(devices, progress);

			// Stop when complete
			if (progress >= 1.0) {
				logTag('wakelight', 'green', 'Wakelight complete');
				this.cancelWakelight();
			}
		}, updateIntervalMs);

		// Set initial brightness to 0
		await this._updateDevicesBrightness(devices, 0);
	}

	public cancelWakelight(): void {
		if (this._intervalId !== null) {
			clearInterval(this._intervalId);
			this._intervalId = null;
		}

		// Unsubscribe from device changes
		for (const unsubscribe of this._deviceSubscriptions) {
			unsubscribe();
		}
		this._deviceSubscriptions = [];

		logTag('wakelight', 'cyan', 'Wakelight cancelled');
	}

	public isActive(): boolean {
		return this._intervalId !== null;
	}

	private async _getValidDevices(deviceIds: string[]) {
		const modules = await this._getModules<AllModules>();
		const allDevices = (await modules.device.api.value).devices.current();
		const validDevices = [];

		for (const deviceId of deviceIds) {
			const device = allDevices[deviceId];
			if (!device) {
				warning(`Device not found: ${deviceId}`);
				continue;
			}

			const colorControlCluster = device.getClusterByType(DeviceColorControlCluster);
			if (!colorControlCluster) {
				warning(`Device does not support ColorControl: ${deviceId}`);
				continue;
			}

			validDevices.push(device);
		}

		return validDevices;
	}

	private async _updateDevicesBrightness(
		devices: Awaited<ReturnType<typeof this._getValidDevices>>,
		brightness: number
	): Promise<void> {
		// Set flag to prevent self-cancellation
		this._isUpdatingDevices = true;

		try {
			await Promise.all(
				devices.map(async (device) => {
					const deviceId = device.getUniqueId();
					try {
						// Try to use LevelControl if available, otherwise use ColorControl value
						const levelControlCluster =
							device.getClusterByType(DeviceLevelControlCluster);
						const onOffCluster = device.getClusterByType(DeviceOnOffCluster);

						// Turn on the device if it's off
						if (onOffCluster) {
							const isOn = await onOffCluster.isOn.get();
							if (!isOn) {
								await onOffCluster.setOn(true);
							}
						}

						// Set brightness
						if (levelControlCluster) {
							await levelControlCluster.setLevel({ level: brightness });
						} else {
							// Fall back to ColorControl with current color but updated value
							const colorControlCluster =
								device.getClusterByType(DeviceColorControlCluster);
							if (colorControlCluster) {
								const currentColor = await colorControlCluster.color.get();
								if (currentColor) {
									// Keep current hue/saturation but update brightness
									const hsv = currentColor.toHSV();
									const updatedColor = Color.fromHSV(
										hsv.hue / 360,
										hsv.saturation / 100,
										brightness
									);
									await colorControlCluster.setColor({ colors: [updatedColor] });
								}
							}
						}
					} catch (error) {
						warning(`Failed to update device ${deviceId}:`, error);
					}
				})
			);
		} finally {
			// Reset flag after updates complete
			this._isUpdatingDevices = false;
		}
	}

	private _subscribeToDeviceChanges(
		devices: Awaited<ReturnType<typeof this._getValidDevices>>,
		onChangeCallback: () => void
	): void {
		for (const device of devices) {
			// Subscribe to OnOff changes
			const onOffCluster = device.getClusterByType(DeviceOnOffCluster);
			if (onOffCluster) {
				const unsubscribe = onOffCluster.isOn.subscribe((value, isInitial) => {
					if (isInitial || value || value === undefined) {
						return;
					}
					onChangeCallback();
				});
				this._deviceSubscriptions.push(unsubscribe);
			}
		}
	}
}
