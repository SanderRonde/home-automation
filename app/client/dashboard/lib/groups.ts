import type { DeviceListWithValuesResponse } from '../../../server/modules/device/routing';
import { DeviceClusterName } from '../../../server/modules/device/cluster';
import type { IncludedIconNames } from '../components/icon';

const CLUSTER_PRIORITY: DeviceClusterName[] = [
	DeviceClusterName.COLOR_CONTROL,
	DeviceClusterName.WINDOW_COVERING,
	DeviceClusterName.ON_OFF,
	DeviceClusterName.THERMOSTAT,
	DeviceClusterName.OCCUPANCY_SENSING,
	DeviceClusterName.TEMPERATURE_MEASUREMENT,
	DeviceClusterName.BOOLEAN_STATE,
];

const getPriorityIndex = (clusterName: DeviceClusterName): number => {
	const index = CLUSTER_PRIORITY.indexOf(clusterName);
	return index === -1 ? CLUSTER_PRIORITY.length + 1 : index;
};

export type PrimaryClusterInfo = {
	clusterName: DeviceClusterName | null;
	icon: IncludedIconNames | null;
};

export const getPrimaryClusterForDevices = (
	devices: DeviceListWithValuesResponse
): PrimaryClusterInfo => {
	if (devices.length === 0) {
		return { clusterName: null, icon: null };
	}

	const counts = new Map<DeviceClusterName, number>();
	const icons = new Map<DeviceClusterName, IncludedIconNames>();

	for (const device of devices) {
		const seen = new Set<DeviceClusterName>();
		for (const cluster of device.mergedAllClusters) {
			if (cluster.name === DeviceClusterName.COLOR_CONTROL && !('color' in cluster)) {
				continue;
			}
			if (seen.has(cluster.name)) {
				continue;
			}
			seen.add(cluster.name);
			counts.set(cluster.name, (counts.get(cluster.name) ?? 0) + 1);
			if (cluster.icon && !icons.has(cluster.name)) {
				icons.set(cluster.name, cluster.icon);
			}
		}
	}

	if (counts.size === 0) {
		return { clusterName: null, icon: null };
	}

	const entries = Array.from(counts.entries()).map(([clusterName, count]) => ({
		clusterName,
		count,
	}));
	const total = devices.length;
	const common = entries.filter((entry) => entry.count === total);

	const pickByPriority = (list: typeof entries): DeviceClusterName => {
		const candidates = new Set(list.map((entry) => entry.clusterName));
		for (const name of CLUSTER_PRIORITY) {
			if (candidates.has(name)) {
				return name;
			}
		}
		return list
			.slice()
			.sort((a, b) => a.clusterName.localeCompare(b.clusterName))[0]!.clusterName;
	};

	const selectedName =
		common.length > 0
			? pickByPriority(common)
			: entries
					.slice()
					.sort((a, b) => {
						if (b.count !== a.count) {
							return b.count - a.count;
						}
						return getPriorityIndex(a.clusterName) - getPriorityIndex(b.clusterName);
					})[0]!.clusterName;

	return {
		clusterName: selectedName,
		icon: icons.get(selectedName) ?? null,
	};
};
