import { describe, expect, test, mock } from 'bun:test';
import { CombinedData, Data, MappedData } from './data';

describe('Data', () => {
	describe('equality checks', () => {
		test('should not notify if primitive value is the same', () => {
			const data = new Data(5);
			const callback = mock(() => {});

			data.subscribe(callback);
			callback.mockClear();

			data.set(5);

			expect(callback).toHaveBeenCalledTimes(0);
		});

		test('should not notify if string value is the same', () => {
			const data = new Data('hello');
			const callback = mock(() => {});

			data.subscribe(callback);
			callback.mockClear();

			data.set('hello');

			expect(callback).toHaveBeenCalledTimes(0);
		});

		test('should not notify if object with same properties is set', () => {
			const data = new Data({ a: 1, b: 2 });
			const callback = mock(() => {});

			data.subscribe(callback);
			callback.mockClear();

			data.set({ a: 1, b: 2 });

			expect(callback).toHaveBeenCalledTimes(0);
		});

		test('should notify if object has different values', () => {
			const data = new Data({ a: 1, b: 2 });
			const callback = mock(() => {});

			data.subscribe(callback);
			callback.mockClear();

			data.set({ a: 1, b: 3 });

			expect(callback).toHaveBeenCalledTimes(1);
		});

		test('should notify if object has different keys', () => {
			const data = new Data({ a: 1, b: 2 });
			const callback = mock(() => {});

			data.subscribe(callback);
			callback.mockClear();

			data.set({ a: 1, b: 2, c: 3 });

			expect(callback).toHaveBeenCalledTimes(1);
		});

		test('should not notify if array with same elements is set', () => {
			const data = new Data([1, 2, 3]);
			const callback = mock(() => {});

			data.subscribe(callback);
			callback.mockClear();

			data.set([1, 2, 3]);

			expect(callback).toHaveBeenCalledTimes(0);
		});

		test('should notify if array has different elements', () => {
			const data = new Data([1, 2, 3]);
			const callback = mock(() => {});

			data.subscribe(callback);
			callback.mockClear();

			data.set([1, 2, 4]);

			expect(callback).toHaveBeenCalledTimes(1);
		});

		test('should notify if array has different length', () => {
			const data = new Data([1, 2, 3]);
			const callback = mock(() => {});

			data.subscribe(callback);
			callback.mockClear();

			data.set([1, 2, 3, 4]);

			expect(callback).toHaveBeenCalledTimes(1);
		});

		test('should not notify if nested object is the same', () => {
			const data = new Data({ outer: { inner: { value: 42 } }, list: [1, 2] });
			const callback = mock(() => {});

			data.subscribe(callback);
			callback.mockClear();

			data.set({ outer: { inner: { value: 42 } }, list: [1, 2] });

			expect(callback).toHaveBeenCalledTimes(0);
		});

		test('should notify if nested object has changed', () => {
			const data = new Data({ outer: { inner: { value: 42 } }, list: [1, 2] });
			const callback = mock(() => {});

			data.subscribe(callback);
			callback.mockClear();

			data.set({ outer: { inner: { value: 43 } }, list: [1, 2] });

			expect(callback).toHaveBeenCalledTimes(1);
		});

		test('should handle null values correctly', () => {
			const data = new Data<{ a: number } | null>(null);
			const callback = mock(() => {});

			data.subscribe(callback);
			callback.mockClear();

			data.set(null);

			expect(callback).toHaveBeenCalledTimes(0);
		});

		test('should handle undefined values correctly', () => {
			const data = new Data<{ a: number } | undefined>(undefined);
			const callback = mock(() => {});

			data.subscribe(callback);
			callback.mockClear();

			data.set(undefined);

			expect(callback).toHaveBeenCalledTimes(0);
		});
	});

	test('should store and retrieve current value', () => {
		const data = new Data(42);
		expect(data.current()).toBe(42);
	});

	test('should notify subscribers on set', () => {
		const data = new Data(0);
		const callback = mock(() => {});

		data.subscribe(callback);

		expect(callback).toHaveBeenCalledTimes(1);
		expect(callback).toHaveBeenNthCalledWith(1, 0, true);

		data.set(10);

		expect(callback).toHaveBeenCalledTimes(2);
		expect(callback).toHaveBeenNthCalledWith(2, 10, false);
	});

	test('should call create when first subscriber is added', () => {
		class TestData extends Data<number> {
			public createCalled = false;
			public destroyCalled = false;

			protected override create(): void {
				this.createCalled = true;
			}

			protected override destroy(): void {
				this.destroyCalled = true;
			}
		}

		const data = new TestData(0);
		expect(data.createCalled).toBe(false);

		const unsub = data.subscribe(() => {});
		expect(data.createCalled).toBe(true);

		unsub();
		expect(data.destroyCalled).toBe(true);
	});

	test('should unsubscribe correctly', () => {
		const data = new Data(0);
		const callback = mock(() => {});

		const unsubscribe = data.subscribe(callback);
		callback.mockClear();

		data.set(1);
		expect(callback).toHaveBeenCalledTimes(1);

		unsubscribe();
		callback.mockClear();

		data.set(2);
		expect(callback).toHaveBeenCalledTimes(0);
	});

	test('should handle multiple subscribers', () => {
		const data = new Data(0);
		const callback1 = mock(() => {});
		const callback2 = mock(() => {});

		data.subscribe(callback1);
		data.subscribe(callback2);

		callback1.mockClear();
		callback2.mockClear();

		data.set(5);

		expect(callback1).toHaveBeenCalledWith(5, false);
		expect(callback2).toHaveBeenCalledWith(5, false);
	});

	test('should handle update method', () => {
		const data = new Data(10);
		data.update((old) => old + 5);
		expect(data.current()).toBe(15);
	});

	test('get() should resolve when value is not undefined', async () => {
		const data = new Data<number | undefined>(undefined);

		const promise = data.get();

		// Set value after a delay
		setTimeout(() => data.set(42), 10);

		const result = await promise;
		expect(result).toBe(42);
	});

	test('get() should resolve immediately if value is already set', async () => {
		const data = new Data(123);
		const result = await data.get();
		expect(result).toBe(123);
	});
});

describe('MappedData', () => {
	test('should map upstream values', () => {
		const upstream = new Data(5);
		const mapped = new MappedData(upstream, (value) => value * 2);

		expect(mapped.current()).toBe(10);
	});

	test('should update when upstream changes', () => {
		const upstream = new Data(5);
		const mapped = new MappedData(upstream, (value) => value * 2);
		const callback = mock(() => {});

		mapped.subscribe(callback);
		callback.mockClear();

		upstream.set(10);

		expect(callback).toHaveBeenCalledWith(20, false);
		expect(mapped.current()).toBe(20);
	});

	test('should support mapper with previous value', () => {
		const upstream = new Data(1);
		const mapped = new MappedData<number, number>(
			upstream,
			(value: number, prev: number | undefined) => (prev ?? 0) + value
		);

		const callback = mock(() => {});
		mapped.subscribe(callback);

		expect(mapped.current()).toBe(1);

		upstream.set(2);
		expect(mapped.current()).toBe(3); // 1 + 2

		upstream.set(3);
		expect(mapped.current()).toBe(6); // 3 + 3
	});

	test('should only subscribe to upstream when it has subscribers', () => {
		class TestData extends Data<number> {
			public subscriberCount = 0;

			protected override create(): void {
				this.subscriberCount++;
			}

			protected override destroy(): void {
				this.subscriberCount--;
			}
		}

		const upstream = new TestData(5);
		const mapped = new MappedData(upstream, (value) => value * 2);

		expect(upstream.subscriberCount).toBe(0);

		const unsub = mapped.subscribe(() => {});
		expect(upstream.subscriberCount).toBe(1);

		unsub();
		expect(upstream.subscriberCount).toBe(0);
	});

	test('should compute current value even without subscribers', () => {
		const upstream = new Data(7);
		const mapped = new MappedData(upstream, (value) => value * 3);

		// No subscribers
		expect(mapped.current()).toBe(21);

		// Change upstream
		upstream.set(10);
		expect(mapped.current()).toBe(30);
	});

	test('alwaysTrack option should keep upstream subscribed', () => {
		class TestData extends Data<number> {
			public subscriberCount = 0;

			protected override create(): void {
				this.subscriberCount++;
			}

			protected override destroy(): void {
				this.subscriberCount--;
			}
		}

		const upstream = new TestData(5);
		// Create mapped data with alwaysTrack=true
		new MappedData(upstream, (value) => value * 2, true);

		// Should be subscribed immediately due to alwaysTrack
		expect(upstream.subscriberCount).toBe(1);
	});

	test('get() on mapped data should trigger get() on upstream', async () => {
		class TestData extends Data<number> {
			public getCallCount = 0;

			// eslint-disable-next-line @typescript-eslint/require-await
			public override async get(): Promise<number> {
				this.getCallCount++;
				// Simulate fetching fresh data
				return 999;
			}
		}

		const upstream = new TestData(5);
		const mapped = new MappedData(upstream, (value) => value * 2);

		expect(upstream.getCallCount).toBe(0);

		const result = await mapped.get();

		// get() should have been called on upstream
		expect(upstream.getCallCount).toBe(1);
		expect(result).toBe(1998); // 999 * 2
	});
});

describe('CombinedData', () => {
	test('should combine two data sources', () => {
		const data1 = new Data(10);
		const data2 = new Data('hello');
		const combined = new CombinedData([data1, data2]);

		expect(combined.current()).toEqual([10, 'hello']);
	});

	test('should update when first upstream changes', () => {
		const data1 = new Data(10);
		const data2 = new Data('hello');
		const combined = new CombinedData([data1, data2]);
		const callback = mock(() => {});

		combined.subscribe(callback);
		callback.mockClear();

		data1.set(20);

		expect(callback).toHaveBeenCalledWith([20, 'hello'], false);
		expect(combined.current()).toEqual([20, 'hello']);
	});

	test('should update when second upstream changes', () => {
		const data1 = new Data(10);
		const data2 = new Data('hello');
		const combined = new CombinedData([data1, data2]);
		const callback = mock(() => {});

		combined.subscribe(callback);
		callback.mockClear();

		data2.set('world');

		expect(callback).toHaveBeenCalledWith([10, 'world'], false);
		expect(combined.current()).toEqual([10, 'world']);
	});

	test('should only subscribe to upstreams when it has subscribers', () => {
		class TestData extends Data<number> {
			public subscriberCount = 0;

			protected override create(): void {
				this.subscriberCount++;
			}

			protected override destroy(): void {
				this.subscriberCount--;
			}
		}

		const data1 = new TestData(10);
		const data2 = new TestData(20);
		const combined = new CombinedData([data1, data2]);

		expect(data1.subscriberCount).toBe(0);
		expect(data2.subscriberCount).toBe(0);

		const unsub = combined.subscribe(() => {});

		expect(data1.subscriberCount).toBe(1);
		expect(data2.subscriberCount).toBe(1);

		unsub();

		expect(data1.subscriberCount).toBe(0);
		expect(data2.subscriberCount).toBe(0);
	});

	test('get() on combined data should work with upstream get()', async () => {
		class TestData extends Data<number> {
			public constructor(
				value: number,
				private readonly freshValue: number
			) {
				super(value);
			}

			// eslint-disable-next-line @typescript-eslint/require-await
			public override async get(): Promise<number> {
				// Simulate fetching fresh data
				return this.freshValue;
			}
		}

		const data1 = new TestData(10, 100);
		const data2 = new TestData(20, 200);
		const combined = new CombinedData([data1, data2]);

		const result = await combined.get();

		// Should wait for both upstreams to resolve with fresh data
		expect(result).toEqual([100, 200]);
	});

	test('combining with mapped data should work', () => {
		const upstream1 = new Data(5);
		const upstream2 = new Data(10);

		const mapped = new MappedData(upstream1, (value) => value * 2);
		const combined = new CombinedData([mapped, upstream2]);

		// Subscribe to activate tracking
		const unsub = combined.subscribe(() => {});

		expect(combined.current()).toEqual([10, 10]);

		upstream1.set(7);
		expect(combined.current()).toEqual([14, 10]);

		upstream2.set(20);
		expect(combined.current()).toEqual([14, 20]);

		unsub();
	});

	test('mapping combined data should work', () => {
		const data1 = new Data(5);
		const data2 = new Data(10);
		const combined = new CombinedData([data1, data2]);
		const mapped = new MappedData(combined, ([a, b]) => a + b);

		// Subscribe to activate tracking
		const unsub = mapped.subscribe(() => {});

		expect(mapped.current()).toBe(15);

		data1.set(7);
		expect(mapped.current()).toBe(17);

		data2.set(3);
		expect(mapped.current()).toBe(10);

		unsub();
	});

	test('get() on mapped combined data should trigger upstream get()', async () => {
		class TestData extends Data<number> {
			public constructor(
				value: number,
				private readonly freshValue: number
			) {
				super(value);
			}

			// eslint-disable-next-line @typescript-eslint/require-await
			public override async get(): Promise<number> {
				return this.freshValue;
			}
		}

		const data1 = new TestData(5, 50);
		const data2 = new TestData(10, 100);
		const combined = new CombinedData([data1, data2]);
		const mapped = new MappedData(combined, ([a, b]) => a + b);

		const result = await mapped.get();

		// Should get fresh data from both upstreams: 50 + 100
		expect(result).toBe(150);
	});
});

describe('Complex scenarios', () => {
	test('chained mapping should work', () => {
		const upstream = new Data(5);
		const mapped1 = new MappedData(upstream, (value) => value * 2);
		const mapped2 = new MappedData(mapped1, (value) => value + 10);

		// Subscribe to activate tracking
		const unsub = mapped2.subscribe(() => {});

		expect(mapped2.current()).toBe(20); // (5 * 2) + 10

		upstream.set(10);
		expect(mapped2.current()).toBe(30); // (10 * 2) + 10

		unsub();
	});

	test('get() through multiple mapping layers should fetch fresh data', async () => {
		class TestData extends Data<number> {
			public constructor(
				value: number,
				private readonly freshValue: number
			) {
				super(value);
			}

			// eslint-disable-next-line @typescript-eslint/require-await
			public override async get(): Promise<number> {
				return this.freshValue;
			}
		}

		const upstream = new TestData(5, 100);
		const mapped1 = new MappedData(upstream, (value) => value * 2);
		const mapped2 = new MappedData(mapped1, (value) => value + 10);

		const result = await mapped2.get();

		// Should fetch 100 from upstream, then map: (100 * 2) + 10
		expect(result).toBe(210);
	});

	test('should handle rapid updates correctly', () => {
		const data = new Data(0);
		const callback = mock(() => {});

		data.subscribe(callback);
		callback.mockClear();

		// Rapid updates
		for (let i = 1; i <= 10; i++) {
			data.set(i);
		}

		expect(callback).toHaveBeenCalledTimes(10);
		expect(data.current()).toBe(10);
	});

	test('should handle unsubscribe during callback execution', () => {
		const data = new Data(0);
		const state = { unsub: undefined as (() => void) | undefined };

		const callback = mock((value: number) => {
			if (value === 5 && state.unsub) {
				state.unsub();
			}
		});

		state.unsub = data.subscribe(callback);
		callback.mockClear();

		data.set(5);
		expect(callback).toHaveBeenCalledTimes(1);

		callback.mockClear();
		data.set(10);
		// Should not be called since we unsubscribed
		expect(callback).toHaveBeenCalledTimes(0);
	});
});
