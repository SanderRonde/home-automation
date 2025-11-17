import {
	createDeduplicatedWSPublish,
	createDeduplicatedTypedWSPublish,
} from './deduplicated-ws-publish';
import { describe, it, expect } from 'bun:test';

describe('createDeduplicatedWSPublish', () => {
	it('should send the first message', async () => {
		let callCount = 0;
		const mockPublish = () => {
			callCount++;
			return Promise.resolve(callCount);
		};

		const deduplicatedPublish = createDeduplicatedWSPublish(mockPublish);

		const result = await deduplicatedPublish('test message');

		expect(result).toBe(1);
		expect(callCount).toBe(1);
	});

	it('should not send duplicate messages', async () => {
		let callCount = 0;
		const mockPublish = () => {
			callCount++;
			return Promise.resolve(callCount);
		};

		const deduplicatedPublish = createDeduplicatedWSPublish(mockPublish);

		await deduplicatedPublish('test message');
		const result = await deduplicatedPublish('test message');

		expect(result).toBe(0);
		expect(callCount).toBe(1);
	});

	it('should send when message changes', async () => {
		let callCount = 0;
		const mockPublish = () => {
			callCount++;
			return Promise.resolve(callCount);
		};

		const deduplicatedPublish = createDeduplicatedWSPublish(mockPublish);

		await deduplicatedPublish('message 1');
		await deduplicatedPublish('message 1');
		const result = await deduplicatedPublish('message 2');

		expect(result).toBe(2);
		expect(callCount).toBe(2);
	});
});

describe('createDeduplicatedTypedWSPublish', () => {
	interface TestMessage {
		type: string;
		data: number;
	}

	it('should send the first typed message', async () => {
		let callCount = 0;
		const mockPublish = () => {
			callCount++;
			return Promise.resolve(callCount);
		};

		const deduplicatedPublish = createDeduplicatedTypedWSPublish<TestMessage>(mockPublish);

		const result = await deduplicatedPublish({ type: 'test', data: 123 });

		expect(result).toBe(1);
		expect(callCount).toBe(1);
	});

	it('should not send duplicate typed messages', async () => {
		let callCount = 0;
		const mockPublish = () => {
			callCount++;
			return Promise.resolve(callCount);
		};

		const deduplicatedPublish = createDeduplicatedTypedWSPublish<TestMessage>(mockPublish);

		await deduplicatedPublish({ type: 'test', data: 123 });
		const result = await deduplicatedPublish({ type: 'test', data: 123 });

		expect(result).toBe(0);
		expect(callCount).toBe(1);
	});

	it('should send when typed message changes', async () => {
		let callCount = 0;
		const mockPublish = () => {
			callCount++;
			return Promise.resolve(callCount);
		};

		const deduplicatedPublish = createDeduplicatedTypedWSPublish<TestMessage>(mockPublish);

		await deduplicatedPublish({ type: 'test', data: 123 });
		await deduplicatedPublish({ type: 'test', data: 123 });
		const result = await deduplicatedPublish({ type: 'test', data: 456 });

		expect(result).toBe(2);
		expect(callCount).toBe(2);
	});

	it('should handle complex nested objects', async () => {
		interface ComplexMessage {
			type: string;
			nested: {
				array: number[];
				obj: { key: string };
			};
		}

		let callCount = 0;
		const mockPublish = () => {
			callCount++;
			return Promise.resolve(callCount);
		};

		const deduplicatedPublish = createDeduplicatedTypedWSPublish<ComplexMessage>(mockPublish);

		const message = {
			type: 'complex',
			nested: {
				array: [1, 2, 3],
				obj: { key: 'value' },
			},
		};

		await deduplicatedPublish(message);
		await deduplicatedPublish(message);

		expect(callCount).toBe(1);

		// Change nested property
		const changed = {
			type: 'complex',
			nested: {
				array: [1, 2, 3],
				obj: { key: 'different' },
			},
		};

		await deduplicatedPublish(changed);
		expect(callCount).toBe(2);
	});
});
