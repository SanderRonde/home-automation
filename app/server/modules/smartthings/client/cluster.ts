import { DeviceFridgeCluster, DeviceWasherCluster } from '../../device/cluster';
import { EventEmitter } from '../../../lib/event-emitter';
import type { SmartApp } from '@smartthings/smartapp';
import { Data, MappedData } from '../../../lib/data';

export type SmartAppContext = Awaited<ReturnType<InstanceType<typeof SmartApp>['withContext']>>;

export class SmartThingsWasherCluster extends DeviceWasherCluster {
	public getBaseCluster(): typeof DeviceWasherCluster {
		return DeviceWasherCluster;
	}

	private _disposables = new Set<() => void>();
	public onChange: EventEmitter<void> = new EventEmitter();

	public constructor(initialData: SmartThingsDeviceData, ctx: SmartAppContext) {
		super();
		const { dataD, interval } = getDeviceData(ctx, initialData, this.onChange);
		if (interval) {
			this._disposables.add(() => clearInterval(interval));
		}
		const status = new MappedData(dataD, this.mapDeviceToWasherStatus);
		this.machineState = new MappedData(status, (status) => status.machineState);
		this.operatingState = new MappedData(status, (status) => status.operatingState);
		this.washerJobState = new MappedData(status, (status) => status.washerJobState);
		this.done = new MappedData(status, (status) => status.done);
		this.completionTime = new MappedData(status, (status) => status.completionTime);
		this.remainingTimeMinutes = new MappedData(status, (status) => status.remainingTimeMinutes);
		this.remainingTimeStr = new MappedData(status, (status) => status.remainingTimeStr);
		this.detergentRemainingCc = new MappedData(status, (status) => status.detergentRemainingCc);
		this.detergentInitialCc = new MappedData(status, (status) => status.detergentInitialCc);
		this.softenerRemainingCc = new MappedData(status, (status) => status.softenerRemainingCc);
		this.softenerInitialCc = new MappedData(status, (status) => status.softenerInitialCc);
		this.cycle = new MappedData(status, (status) => status.cycle);
		this.cycleType = new MappedData(status, (status) => status.cycleType);
		this.phase = new MappedData(status, (status) => status.phase);
		this.progressPercent = new MappedData(status, (status) => status.progressPercent);
		this.scheduledPhases = new MappedData(status, (status) => status.scheduledPhases);
	}

	/**
	 * Maps a single SmartThings device (with components/capabilities/status) to WasherStatus if it is a washer.
	 */
	private mapDeviceToWasherStatus(device: SmartThingsDeviceData) {
		const main = getComponent(device, 'main');
		if (!main) {
			throw new Error('Main component not found');
		}

		const std = getCapability(main, 'washerOperatingState');
		const samsung = getCapability(main, 'samsungce.washerOperatingState');
		const cycleCap = getCapability(main, 'samsungce.washerCycle');
		const detergent = getCapability(main, 'samsungce.detergentState');
		const softener = getCapability(main, 'samsungce.softenerState');

		const machineState = getStatusValue<'stop' | 'run' | 'pause'>(std, 'machineState');
		const operatingState = getStatusValue<'ready' | 'running' | 'paused'>(
			samsung,
			'operatingState'
		);
		const washerJobState =
			getStatusValue<'none' | string>(std, 'washerJobState') ??
			getStatusValue<'none' | string>(samsung, 'washerJobState');
		const done =
			machineState === 'stop' &&
			(washerJobState === 'none' || washerJobState === null) &&
			(operatingState === 'ready' || operatingState === null);

		const completionTime = getStatusValue<string>(std, 'completionTime');
		const remainingTime = getStatusValue<number>(samsung, 'remainingTime');
		const remainingTimeStr = getStatusValue<string>(samsung, 'remainingTimeStr');

		const detergentRemainingCc = getStatusValue<number>(detergent, 'remainingAmount');
		const detergentInitialCc = getStatusValue<number>(detergent, 'initialAmount');
		const softenerRemainingCc = getStatusValue<number>(softener, 'remainingAmount');
		const softenerInitialCc = getStatusValue<number>(softener, 'initialAmount');

		const cycle = getStatusValue<string>(cycleCap, 'washerCycle');
		const cycleType = getStatusValue<'washingOnly'>(cycleCap, 'cycleType');
		const phase = getStatusValue<'wash' | 'rinse' | 'spin' | 'none'>(samsung, 'washerJobPhase');
		const progressPercent = getStatusValue<number>(samsung, 'progress');
		const scheduledPhasesRaw = getStatusValue<
			{
				phaseName: string;
				timeInMin: number;
			}[]
		>(samsung, 'scheduledPhases');
		const scheduledPhases = Array.isArray(scheduledPhasesRaw) ? scheduledPhasesRaw : [];

		return {
			machineState: machineState,
			operatingState: operatingState,
			washerJobState: washerJobState,
			done,
			completionTime: completionTime,
			remainingTimeMinutes: remainingTime,
			remainingTimeStr: remainingTimeStr,
			detergentRemainingCc: detergentRemainingCc,
			detergentInitialCc: detergentInitialCc,
			softenerRemainingCc: softenerRemainingCc,
			softenerInitialCc: softenerInitialCc,
			cycle: cycle,
			cycleType: cycleType,
			phase: phase,
			progressPercent: progressPercent,
			scheduledPhases,
		};
	}

	/** "stop" | "run" | "pause" */
	public machineState: Data<'stop' | 'run' | 'pause' | undefined>;
	/** "ready" | "running" | "paused" (Samsung) */
	public operatingState: Data<'ready' | 'running' | 'paused' | undefined>;
	/** "none" or job name (Samsung) */
	public washerJobState: Data<'none' | string | undefined>;
	/** Is the cycle done (idle, no job). */
	public done: Data<boolean | undefined>;
	/** When the current/last run is scheduled to finish (ISO string). */
	public completionTime: Data<string | undefined>;
	/** Remaining time in minutes (when running). */
	public remainingTimeMinutes: Data<number | undefined>;
	/** Remaining time string e.g. "02:36". */
	public remainingTimeStr: Data<string | undefined>;
	/** Detergent remaining (cc). */
	public detergentRemainingCc: Data<number | undefined>;
	/** Detergent initial capacity (cc). */
	public detergentInitialCc: Data<number | undefined>;
	/** Softener remaining (cc). */
	public softenerRemainingCc: Data<number | undefined>;
	/** Softener initial capacity (cc). */
	public softenerInitialCc: Data<number | undefined>;
	/** Current cycle/course e.g. "Table_02_Course_1C". */
	public cycle: Data<string | undefined>;
	/** Cycle type e.g. "washingOnly". */
	public cycleType: Data<'washingOnly' | undefined>;
	/** Phase: "wash" | "rinse" | "spin" | "none". */
	public phase: Data<'wash' | 'rinse' | 'spin' | 'none' | undefined>;
	/** Progress 0–100 (%). */
	public progressPercent: Data<number | undefined>;
	/** Scheduled phases with names and durations (min). */
	public scheduledPhases: Data<Array<{ phaseName: string; timeInMin: number }> | undefined>;

	public static isInstance(initialData: SmartThingsDeviceData): boolean {
		const main = getComponent(initialData, 'main');
		if (!main) {
			return false;
		}

		const hasWasher =
			getCapability(main, 'washerOperatingState') ??
			getCapability(main, 'samsungce.washerOperatingState');
		if (!hasWasher) {
			return false;
		}

		return true;
	}

	public [Symbol.dispose](): void {
		for (const disposable of this._disposables) {
			disposable();
		}
		this._disposables.clear();
	}
}

export class SmartThingsFridgeCluster extends DeviceFridgeCluster {
	public getBaseCluster(): typeof DeviceFridgeCluster {
		return DeviceFridgeCluster;
	}

	private _disposables = new Set<() => void>();
	public onChange: EventEmitter<void> = new EventEmitter();

	public constructor(initialData: SmartThingsDeviceData, ctx: SmartAppContext) {
		super();
		const { dataD, interval } = getDeviceData(ctx, initialData, this.onChange);
		if (interval) {
			this._disposables.add(() => clearInterval(interval));
		}
		const status = new MappedData(dataD, this.mapDeviceToFridgeStatus);
		this.freezerDoorOpen = new MappedData(status, (status) => status.freezerDoorOpen);
		this.coolerDoorOpen = new MappedData(status, (status) => status.coolerDoorOpen);
		this.fridgeTempC = new MappedData(status, (status) => status.fridgeTempC ?? undefined);
		this.freezerTempC = new MappedData(status, (status) => status.freezerTempC ?? undefined);
	}

	/**
	 * Maps a single SmartThings device (with components/capabilities/status) to WasherStatus if it is a washer.
	 */
	private mapDeviceToFridgeStatus(device: SmartThingsDeviceData) {
		const freezer = getComponent(device, 'freezer');
		const cooler = getComponent(device, 'cooler');

		// Freezer door and temp
		const freezerContact = freezer ? getCapability(freezer, 'contactSensor') : undefined;
		const freezerTempCap = freezer
			? getCapability(freezer, 'temperatureMeasurement')
			: undefined;

		const freezerDoorOpen = getStatusValue(freezerContact, 'contact') === 'open';
		const freezerTempC = getStatusValue(freezerTempCap, 'temperature') as number | null;

		// Cooler (fridge) door and temp
		const coolerContact = cooler ? getCapability(cooler, 'contactSensor') : undefined;
		const coolerTempCap = cooler ? getCapability(cooler, 'temperatureMeasurement') : undefined;

		const coolerDoorOpen = getStatusValue(coolerContact, 'contact') === 'open';
		const fridgeTempC = getStatusValue(coolerTempCap, 'temperature') as number | null;

		return {
			freezerDoorOpen,
			coolerDoorOpen,
			fridgeTempC: fridgeTempC ?? null,
			freezerTempC: freezerTempC ?? null,
		};
	}

	/** Freezer door open. */
	public freezerDoorOpen: Data<boolean>;
	/** Fridge (cooler) door open. */
	public coolerDoorOpen: Data<boolean>;
	/** Fridge (cooler) current temp °C. */
	public fridgeTempC: Data<number | undefined>;
	/** Freezer current temp °C. */
	public freezerTempC: Data<number | undefined>;

	public static isInstance(initialData: SmartThingsDeviceData): boolean {
		const main = getComponent(initialData, 'main');
		const freezer = getComponent(initialData, 'freezer');
		const cooler = getComponent(initialData, 'cooler');

		// Treat as fridge if it has refrigeration on main or has freezer/cooler components with temp
		const hasRefrigeration = main && getCapability(main, 'refrigeration');
		const hasFreezerTemp = freezer && getCapability(freezer, 'temperatureMeasurement');
		const hasCoolerTemp = cooler && getCapability(cooler, 'temperatureMeasurement');
		if (!hasRefrigeration && !hasFreezerTemp && !hasCoolerTemp) {
			return false;
		}
		return true;
	}

	public [Symbol.dispose](): void {
		for (const disposable of this._disposables) {
			disposable();
		}
		this._disposables.clear();
	}
}

function getStatusValue<T>(cap: SmartThingsCapability | undefined, attr: string): T | undefined {
	return (cap?.status?.[attr]?.value ?? undefined) as T | undefined;
}

export function getComponent(
	device: SmartThingsDeviceData,
	componentId: string
): SmartThingsComponent | undefined {
	return device.components?.find((c) => c.id === componentId);
}

function getCapability(
	component: SmartThingsComponent,
	capabilityId: string
): SmartThingsCapability | undefined {
	return component.capabilities?.find((c) => c.id === capabilityId);
}

function getDeviceData(
	ctx: SmartAppContext,
	initialData: SmartThingsDeviceData,
	onChange: EventEmitter<void>
): { dataD: Data<SmartThingsDeviceData>; interval?: Timer } {
	const dataD = new Data<SmartThingsDeviceData>(initialData);
	let lastData: string = JSON.stringify(initialData);
	if (initialData.deviceId) {
		const deviceId = initialData.deviceId;
		const interval = setInterval(() => {
			void ctx.api.devices.get(deviceId, { includeStatus: true }).then((device) => {
				if (JSON.stringify(device) !== lastData) {
					dataD.set(device);
					lastData = JSON.stringify(device);
					onChange.emit(undefined);
				}
			});
		}, 1000 * 10);
		return { interval, dataD };
	}

	return { dataD };
}

type SmartThingsCapability = { id: string; status?: Record<string, { value?: unknown }> };
type SmartThingsComponent = { id: string; capabilities?: SmartThingsCapability[] };
export type SmartThingsDeviceData = {
	deviceId?: string;
	name?: string;
	label?: string;
	components?: SmartThingsComponent[];
};
