import 'reflect-metadata';

import {
	Cluster,
	DeviceOnOffCluster,
	DeviceWindowCoveringCluster,
	DeviceLevelControlCluster,
	DevicePowerSourceCluster,
	DeviceGroupsCluster,
	DeviceOccupancySensingCluster,
	DeviceTemperatureMeasurementCluster,
	DeviceRelativeHumidityMeasurementCluster,
	DeviceBooleanStateCluster,
	DeviceSwitchCluster,
	DeviceSwitchWithLongPressCluster,
	DeviceSwitchWithMultiPressCluster,
	DeviceSwitchWithLongPressAndMultiPressCluster,
	DeviceIlluminanceMeasurementCluster,
	DeviceColorControlCluster,
	DeviceActionsCluster,
	DeviceThermostatCluster,
	DeviceGroupId,
} from './cluster';
import { EventEmitter } from '../../lib/event-emitter';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { Color } from '../../lib/color';
import { Data } from '../../lib/data';
import * as z from 'zod';

const typesForClasses = new Map<
	string,
	Record<
		string,
		| {
				variant: 'method';
				paramTypes: any[];
				returnType: any;
		  }
		| {
				variant: 'property';
				type: any;
		  }
	>
>();

function zodToOpenAiSchema(zodType: z.ZodType) {
	return zodToJsonSchema(zodType, {
		target: 'openAi',
	});
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DescribeMethod(
	returnType: z.ZodType,
	...args: {
		name: string;
		type: z.ZodType;
	}[]
) {
	return (target: Cluster, propertyKey: string) => {
		const clusterName = target.getBaseCluster().prototype.constructor.name;
		if (!typesForClasses.has(clusterName)) {
			typesForClasses.set(clusterName, {});
		}
		typesForClasses.get(clusterName)![propertyKey] = {
			variant: 'method',
			paramTypes: args.map((arg) => zodToOpenAiSchema(arg.type)),
			returnType: zodToOpenAiSchema(returnType),
		};
	};
}

function DescribeProperty(type: z.ZodType) {
	return (target: Cluster, propertyKey: string) => {
		const clusterName = target.getBaseCluster().prototype.constructor.name;
		if (!typesForClasses.has(clusterName)) {
			typesForClasses.set(clusterName, {});
		}
		typesForClasses.get(clusterName)![propertyKey] = {
			variant: 'property',
			type: zodToOpenAiSchema(type),
		};
	};
}

class DeviceOnOffClusterSpec extends DeviceOnOffCluster {
	public getBaseCluster(): typeof DeviceOnOffCluster {
		return DeviceOnOffCluster;
	}

	@DescribeProperty(z.boolean().optional())
	public isOn!: Data<boolean | undefined>;
	@DescribeMethod(z.promise(z.void()), { name: 'on', type: z.boolean() })
	public setOn!: (on: boolean) => Promise<void>;
	@DescribeMethod(z.promise(z.void()), { name: 'toggle', type: z.boolean() })
	public toggle!: () => Promise<void>;

	public onChange!: EventEmitter<void>;
	public [Symbol.dispose](): void {}
}

class DeviceWindowCoveringClusterSpec extends DeviceWindowCoveringCluster {
	public getBaseCluster(): typeof DeviceWindowCoveringCluster {
		return DeviceWindowCoveringCluster;
	}

	@DescribeProperty(z.number().optional())
	public targetPositionLiftPercentage!: Data<number | undefined>;
	@DescribeMethod(z.promise(z.void()))
	public close!: () => Promise<void>;
	@DescribeMethod(z.promise(z.void()))
	public open!: () => Promise<void>;
	@DescribeMethod(z.promise(z.void()), {
		name: 'args',
		type: z.object({ percentage: z.number() }),
	})
	public goToLiftPercentage!: (args: { percentage: number }) => Promise<void>;

	public onChange!: EventEmitter<void>;
	public [Symbol.dispose](): void {}
}

class DeviceLevelControlClusterSpec extends DeviceLevelControlCluster {
	public getBaseCluster(): typeof DeviceLevelControlCluster {
		return DeviceLevelControlCluster;
	}

	@DescribeProperty(z.number())
	public currentLevel!: Data<number>;
	@DescribeProperty(z.number())
	public startupLevel!: Data<number>;
	@DescribeMethod(z.promise(z.void()), {
		name: 'args',
		type: z.object({
			level: z.number(),
			transitionTimeDs: z.number().optional(),
		}),
	})
	public setLevel!: (args: { level: number; transitionTimeDs?: number }) => Promise<void>;
	@DescribeMethod(z.promise(z.void()), {
		name: 'args',
		type: z.object({
			groupId: z.number(),
			groupName: z.string(),
		}),
	})
	public setStartupLevel!: (args: { level: number; transitionTimeDs?: number }) => Promise<void>;
	@DescribeMethod(z.promise(z.void()))
	public stop!: () => Promise<void>;

	public onChange!: EventEmitter<void>;
	public [Symbol.dispose](): void {}
}

class DevicePowerSourceClusterSpec extends DevicePowerSourceCluster {
	public getBaseCluster(): typeof DevicePowerSourceCluster {
		return DevicePowerSourceCluster;
	}

	@DescribeProperty(z.number().optional())
	public batteryChargeLevel!: Data<number | undefined>;

	public onChange!: EventEmitter<void>;
	public [Symbol.dispose](): void {}
}

class DeviceGroupsClusterSpec extends DeviceGroupsCluster {
	public getBaseCluster(): typeof DeviceGroupsCluster {
		return DeviceGroupsCluster;
	}

	@DescribeMethod(z.promise(z.object({ status: z.number(), groupId: z.number() })), {
		name: 'args',
		type: z.object({
			groupId: z.number(),
			groupName: z.string(),
		}),
	})
	public addGroup!: (args: {
		groupId: number;
		groupName: string;
	}) => Promise<{ status: number; groupId: DeviceGroupId }>;
	@DescribeMethod(z.promise(z.object({ groupList: z.array(z.number()) })))
	public listGroupMemberships!: () => Promise<{
		groupList: DeviceGroupId[];
	}>;
	@DescribeMethod(z.promise(z.object({ groupList: z.array(z.number()) })), {
		name: 'args',
		type: z.object({ groupList: z.array(z.number()) }),
	})
	public getFilteredGroupMembership!: (args: { groupList: DeviceGroupId[] }) => Promise<{
		groupList: DeviceGroupId[];
	}>;
	@DescribeMethod(z.promise(z.object({ status: z.number(), groupId: z.number() })), {
		name: 'args',
		type: z.object({ groupId: z.number() }),
	})
	public removeGroup!: (args: { groupId: DeviceGroupId }) => Promise<{
		status: number;
		groupId: DeviceGroupId;
	}>;

	public onChange!: EventEmitter<void>;
	public [Symbol.dispose](): void {}
}

class DeviceOccupancySensingClusterSpec extends DeviceOccupancySensingCluster {
	public getBaseCluster(): typeof DeviceOccupancySensingCluster {
		return DeviceOccupancySensingCluster;
	}

	@DescribeProperty(z.boolean().optional())
	public occupancy!: Data<boolean | undefined>;

	public onOccupied!: EventEmitter<{ occupied: boolean }>;
	public onChange!: EventEmitter<void>;
	public [Symbol.dispose](): void {}
}

class DeviceTemperatureMeasurementClusterSpec extends DeviceTemperatureMeasurementCluster {
	public getBaseCluster(): typeof DeviceTemperatureMeasurementCluster {
		return DeviceTemperatureMeasurementCluster;
	}

	@DescribeProperty(z.number().optional())
	public temperature!: Data<number | undefined>;

	public onChange!: EventEmitter<void>;
	public [Symbol.dispose](): void {}
}

class DeviceRelativeHumidityMeasurementClusterSpec extends DeviceRelativeHumidityMeasurementCluster {
	public getBaseCluster(): typeof DeviceRelativeHumidityMeasurementCluster {
		return DeviceRelativeHumidityMeasurementCluster;
	}

	@DescribeProperty(z.number().optional())
	public relativeHumidity!: Data<number | undefined>;

	public onChange!: EventEmitter<void>;
	public [Symbol.dispose](): void {}
}

class DeviceBooleanStateClusterSpec<S extends boolean> extends DeviceBooleanStateCluster<S> {
	public getBaseCluster(): typeof DeviceBooleanStateCluster<S> {
		return DeviceBooleanStateCluster<S>;
	}

	@DescribeProperty(z.boolean())
	public state!: Data<S>;

	public onStateChange!: EventEmitter<{ state: S }>;
	public onChange!: EventEmitter<void>;
	public [Symbol.dispose](): void {}
}

class DeviceSwitchClusterSpec extends DeviceSwitchCluster {
	public getBaseCluster(): typeof DeviceSwitchCluster {
		return DeviceSwitchCluster;
	}

	@DescribeMethod(z.number())
	public getTotalCount!: () => number;
	@DescribeMethod(z.number())
	public getIndex!: () => number;
	@DescribeMethod(z.string())
	public getLabel!: () => string;

	public onPress!: EventEmitter<void>;
	public onChange!: EventEmitter<void>;
	public [Symbol.dispose](): void {}
}

class DeviceSwitchWithLongPressClusterSpec extends DeviceSwitchWithLongPressCluster {
	public getBaseCluster(): typeof DeviceSwitchWithLongPressCluster {
		return DeviceSwitchWithLongPressCluster;
	}

	@DescribeMethod(z.number())
	public getTotalCount!: () => number;
	@DescribeMethod(z.number())
	public getIndex!: () => number;
	@DescribeMethod(z.string())
	public getLabel!: () => string;

	public onPress!: EventEmitter<void>;
	public onLongPress!: EventEmitter<void>;
	public onChange!: EventEmitter<void>;
	public [Symbol.dispose](): void {}
}

class DeviceSwitchWithMultiPressClusterSpec extends DeviceSwitchWithMultiPressCluster {
	public getBaseCluster(): typeof DeviceSwitchWithMultiPressCluster {
		return DeviceSwitchWithMultiPressCluster;
	}

	@DescribeMethod(z.number())
	public getTotalCount!: () => number;
	@DescribeMethod(z.number())
	public getIndex!: () => number;
	@DescribeMethod(z.string())
	public getLabel!: () => string;

	public onPress!: EventEmitter<void>;
	public onMultiPress!: EventEmitter<{ pressCount: number }>;
	public onChange!: EventEmitter<void>;
	public [Symbol.dispose](): void {}
}

class DeviceSwitchWithLongPressAndMultiPressClusterSpec extends DeviceSwitchWithLongPressAndMultiPressCluster {
	public getBaseCluster(): typeof DeviceSwitchWithLongPressAndMultiPressCluster {
		return DeviceSwitchWithLongPressAndMultiPressCluster;
	}

	@DescribeMethod(z.number())
	public getTotalCount!: () => number;
	@DescribeMethod(z.number())
	public getIndex!: () => number;
	@DescribeMethod(z.string())
	public getLabel!: () => string;

	public onPress!: EventEmitter<void>;
	public onLongPress!: EventEmitter<void>;
	public onMultiPress!: EventEmitter<{ pressCount: number }>;
	public onChange!: EventEmitter<void>;
	public [Symbol.dispose](): void {}
}

class DeviceIlluminanceMeasurementClusterSpec extends DeviceIlluminanceMeasurementCluster {
	public getBaseCluster(): typeof DeviceIlluminanceMeasurementCluster {
		return DeviceIlluminanceMeasurementCluster;
	}

	@DescribeProperty(z.number())
	public illuminance!: Data<number>;

	public onChange!: EventEmitter<void>;
	public [Symbol.dispose](): void {}
}

class DeviceColorControlClusterSpec extends DeviceColorControlCluster {
	public getBaseCluster(): typeof DeviceColorControlCluster {
		return DeviceColorControlCluster;
	}

	@DescribeProperty(
		z.union([
			z.undefined(),
			z.object({
				color: z.number(),
				saturation: z.number(),
				value: z.number(),
			}),
		])
	)
	public color!: Data<Color | undefined>;
	@DescribeMethod(z.promise(z.void()), {
		name: 'args',
		type: z.object({
			index: z.number().optional(),
			overDurationMs: z.number().optional(),
			color: z.object({
				r: z.number(),
				g: z.number(),
				b: z.number(),
			}),
		}),
	})
	public setColor!: (args: {
		color: Color;
		index?: number;
		overDurationMs?: number;
	}) => Promise<void>;
	@DescribeMethod(z.number())
	public getSegmentCount!: () => number;

	public onChange!: EventEmitter<void>;
	public [Symbol.dispose](): void {}
}

class DeviceActionsClusterSpec extends DeviceActionsCluster {
	public getBaseCluster(): typeof DeviceActionsCluster {
		return DeviceActionsCluster;
	}

	@DescribeProperty(
		z.array(
			z.object({
				id: z.number(),
				name: z.string(),
				type: z.string(),
				state: z.string(),
			})
		)
	)
	// @ts-expect-error - TODO: DeviceAction[] type not yet described
	public actionList!: Data<unknown[]>;
	@DescribeMethod(z.promise(z.void()), { name: 'args', type: z.object({ actionId: z.number() }) })
	public executeAction!: (args: { actionId: number }) => Promise<void>;

	public onChange!: EventEmitter<void>;
	public [Symbol.dispose](): void {}
}

class DeviceThermostatClusterSpec extends DeviceThermostatCluster {
	public getBaseCluster(): typeof DeviceThermostatCluster {
		return DeviceThermostatCluster;
	}

	@DescribeProperty(z.number().optional())
	public currentTemperature!: Data<number | undefined>;
	@DescribeProperty(z.number().optional())
	public targetTemperature!: Data<number | undefined>;
	// TODO: ThermostatMode type
	@DescribeProperty(z.string().optional())
	// @ts-expect-error - TODO: ThermostatMode type not yet described
	public mode!: Data<string | undefined>;
	@DescribeProperty(z.boolean())
	public isHeating!: Data<boolean>;
	@DescribeMethod(z.promise(z.void()), { name: 'temperature', type: z.number() })
	public setTargetTemperature!: (temperature: number) => Promise<void>;
	// TODO: ThermostatMode type
	@DescribeMethod(z.promise(z.void()), { name: 'mode', type: z.string() })
	public setMode!: (mode: string) => Promise<void>;

	public onChange!: EventEmitter<void>;
	public [Symbol.dispose](): void {}
}

const CLUSTER_SPECS = [
	DeviceOnOffClusterSpec,
	DeviceWindowCoveringClusterSpec,
	DeviceLevelControlClusterSpec,
	DevicePowerSourceClusterSpec,
	DeviceGroupsClusterSpec,
	DeviceOccupancySensingClusterSpec,
	DeviceTemperatureMeasurementClusterSpec,
	DeviceRelativeHumidityMeasurementClusterSpec,
	DeviceBooleanStateClusterSpec,
	DeviceSwitchClusterSpec,
	DeviceSwitchWithLongPressClusterSpec,
	DeviceSwitchWithMultiPressClusterSpec,
	DeviceSwitchWithLongPressAndMultiPressClusterSpec,
	DeviceIlluminanceMeasurementClusterSpec,
	DeviceColorControlClusterSpec,
	DeviceActionsClusterSpec,
	DeviceThermostatClusterSpec,
];
// eslint-disable-next-line @typescript-eslint/no-unused-expressions
CLUSTER_SPECS;

export function getTypesForCluster(
	name: string
): Record<
	string,
	| { variant: 'method'; paramTypes: z.ZodType[]; returnType: z.ZodType }
	| { variant: 'property'; type: z.ZodType }
> {
	return typesForClasses.get(name) ?? {};
}
