import type { Cluster } from './cluster';

/**
 * Largely borrows from Matter in shape/choices
 * but not (yet?) in implementation.
 */

// Roughly translates to a Matter endpoint
export interface Device {
	getUniqueId(): string;
	readonly clusters: Cluster[];
}

export type DeviceAttribute<T> = {
	value: Promise<T | null>;
	listen(handler: (value: T) => void): () => void;
};
