import { DeviceThermostatCluster, ThermostatMode } from './cluster';
import { logTag } from '../../lib/logging/logger';
import type { DeviceAPI } from './api';
import { Data } from '../../lib/data';

interface ThermostatOrchestrationConfig {
	masterDeviceIds: string[];
	slaveDeviceIds: string[];
}

export class ThermostatOrchestrator implements Disposable {
	private _disposables: Set<() => void> = new Set();
	private _masterThermostats: DeviceThermostatCluster[] = [];
	private _slaveThermostats: DeviceThermostatCluster[] = [];
	private _config: Data<ThermostatOrchestrationConfig>;

	public constructor(
		private readonly _deviceApi: DeviceAPI,
		config: ThermostatOrchestrationConfig
	) {
		this._config = new Data(config);
		this.init();
	}

	private init() {
		// Subscribe to device changes
		this._deviceApi.devices.subscribe(async (devices) => {
			if (!devices) return;

			const config = this._config.current();
			this._masterThermostats = [];
			this._slaveThermostats = [];

			// Find master thermostats
			for (const masterId of config.masterDeviceIds) {
				const device = devices[masterId];
				if (!device) continue;

				const thermostats = device.getAllClustersByType(DeviceThermostatCluster);
				for (const thermostat of thermostats) {
					if (thermostat.role === 'master') {
						this._masterThermostats.push(thermostat);
						this.subscribeToThermostat(thermostat, 'master');
					}
				}
			}

			// Find slave thermostats
			for (const slaveId of config.slaveDeviceIds) {
				const device = devices[slaveId];
				if (!device) continue;

				const thermostats = device.getAllClustersByType(DeviceThermostatCluster);
				for (const thermostat of thermostats) {
					if (thermostat.role === 'slave') {
						this._slaveThermostats.push(thermostat);
						this.subscribeToThermostat(thermostat, 'slave');
					}
				}
			}

			logTag(
				'thermostat-orchestrator',
				'blue',
				`Initialized with ${this._masterThermostats.length} master(s) and ${this._slaveThermostats.length} slave(s)`
			);
		});
	}

	private subscribeToThermostat(
		thermostat: DeviceThermostatCluster,
		type: 'master' | 'slave'
	) {
		// Subscribe to mode changes
		const modeUnsubscribe = thermostat.mode.subscribe(async () => {
			await this.orchestrate();
		});
		this._disposables.add(modeUnsubscribe);

		// Subscribe to heating state changes
		const heatingUnsubscribe = thermostat.isHeating.subscribe(async () => {
			await this.orchestrate();
		});
		this._disposables.add(heatingUnsubscribe);

		logTag(
			'thermostat-orchestrator',
			'blue',
			`Subscribed to ${type} thermostat state changes`
		);
	}

	/**
	 * Main orchestration logic:
	 * 1. Master can only be ON if at least one slave is ON
	 * 2. If a slave is ON, the master must be ON
	 */
	private async orchestrate() {
		try {
			// Check if any slave is actively heating
			const anySlaveHeating = this._slaveThermostats.some((slave) => {
				const mode = slave.mode.current();
				const isHeating = slave.isHeating.current();
				return mode !== ThermostatMode.OFF && isHeating;
			});

			// Check if any slave needs heat (is in heating mode but not at target)
			const anySlaveNeedsHeat = this._slaveThermostats.some((slave) => {
				const mode = slave.mode.current();
				return mode === ThermostatMode.HEAT || mode === ThermostatMode.AUTO;
			});

			logTag(
				'thermostat-orchestrator',
				'cyan',
				`Orchestrating: anySlaveHeating=${anySlaveHeating}, anySlaveNeedsHeat=${anySlaveNeedsHeat}`
			);

			// Update master thermostats
			for (const master of this._masterThermostats) {
				const currentMode = master.mode.current();

				// Safety rule: Master should be ON if any slave needs heat
				if (anySlaveNeedsHeat) {
					if (currentMode === ThermostatMode.OFF) {
						logTag(
							'thermostat-orchestrator',
							'yellow',
							'Turning master ON because slaves need heat'
						);
						await master.setMode(ThermostatMode.HEAT);
					}
				}
				// Safety rule: Master should be OFF if no slaves need heat
				else {
					if (currentMode !== ThermostatMode.OFF) {
						logTag(
							'thermostat-orchestrator',
							'yellow',
							'Turning master OFF because no slaves need heat'
						);
						await master.setMode(ThermostatMode.OFF);
					}
				}
			}
		} catch (error) {
			logTag(
				'thermostat-orchestrator',
				'red',
				'Error during orchestration:',
				error instanceof Error ? error.message : String(error)
			);
		}
	}

	/**
	 * Update the orchestration configuration
	 */
	public updateConfig(config: ThermostatOrchestrationConfig) {
		this._config.set(config);
		// Re-initialize with new config
		this.init();
	}

	/**
	 * Get current status of all thermostats
	 */
	public getStatus() {
		return {
			masters: this._masterThermostats.map((t) => ({
				mode: t.mode.current(),
				isHeating: t.isHeating.current(),
				currentTemp: t.currentTemperature.current(),
				targetTemp: t.targetTemperature.current(),
			})),
			slaves: this._slaveThermostats.map((t) => ({
				mode: t.mode.current(),
				isHeating: t.isHeating.current(),
				currentTemp: t.currentTemperature.current(),
				targetTemp: t.targetTemperature.current(),
			})),
		};
	}

	public [Symbol.dispose](): void {
		this._disposables.forEach((disposable) => disposable());
	}
}
