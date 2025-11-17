/**
 * Creates a WebSocket publisher that only sends messages when the data has changed
 * from the last sent message. This prevents unnecessary network traffic.
 */
export function createDeduplicatedWSPublish(
	wsPublish: (data: string) => Promise<number>
): (data: string) => Promise<number> {
	let lastMessage: string | null = null;

	return async (data: string): Promise<number> => {
		// Only publish if the data is different from the last message
		if (data === lastMessage) {
			return 0; // Return 0 to indicate no subscribers were notified
		}

		lastMessage = data;
		return await wsPublish(data);
	};
}

/**
 * Creates a typed WebSocket publisher that automatically stringifies objects
 * and only sends messages when the serialized data has changed.
 */
export function createDeduplicatedTypedWSPublish<T>(
	wsPublish: (data: string) => Promise<number>
): (data: T) => Promise<number> {
	const deduplicatedPublish = createDeduplicatedWSPublish(wsPublish);

	return async (data: T): Promise<number> => {
		return await deduplicatedPublish(JSON.stringify(data));
	};
}
