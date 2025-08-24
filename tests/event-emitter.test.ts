import {
	EventEmitter,
	LazyAsyncEventEmitter,
	GetterAsyncEventEmitter,
	CombinedAsyncEventEmitter,
	MappedAsyncEventEmitter,
} from '../app/server/lib/event-emitter';
import { test, expect, beforeAll } from 'bun:test';

beforeAll(() => {
	// Use this to debug
	// logReady();
});

// Basic EventEmitter Tests
test('EventEmitter - can listen to events', () => {
	const emitter = new EventEmitter<string>();
	let receivedValue = null as string | null;

	emitter.listen((value) => {
		receivedValue = value;
	});

	emitter.emit('test-value');
	expect(receivedValue).toBe('test-value');
});

test('EventEmitter - can remove listener', () => {
	const emitter = new EventEmitter<string>();
	let callCount = 0;

	const removeListener = emitter.listen(() => {
		callCount++;
	});

	emitter.emit('test1');
	expect(callCount).toBe(1);

	removeListener();
	emitter.emit('test2');
	expect(callCount).toBe(1); // Should not increase
});

test('EventEmitter - multiple listeners work', () => {
	const emitter = new EventEmitter<string>();
	let count1 = 0;
	let count2 = 0;

	emitter.listen(() => count1++);
	emitter.listen(() => count2++);

	emitter.emit('test');
	expect(count1).toBe(1);
	expect(count2).toBe(1);
});

test('EventEmitter - ignores null/undefined values', () => {
	const emitter = new EventEmitter<string | null>();
	let callCount = 0;

	emitter.listen(() => {
		callCount++;
	});

	emitter.emit(null);
	emitter.emit(undefined);
	expect(callCount).toBe(0);

	emitter.emit('valid');
	expect(callCount).toBe(1);
});

test('EventEmitter - dispose clears all listeners', () => {
	const emitter = new EventEmitter<string>();
	let callCount = 0;

	emitter.listen(() => callCount++);
	emitter.listen(() => callCount++);

	emitter.emit('test1');
	expect(callCount).toBe(2);

	emitter[Symbol.dispose]();
	emitter.emit('test2');
	expect(callCount).toBe(2); // Should not increase after dispose
});

test('EventEmitter - removeListener with specific handler', () => {
	const emitter = new EventEmitter<string>();
	let count1 = 0;
	let count2 = 0;

	const handler1 = () => count1++;
	const handler2 = () => count2++;

	emitter.listen(handler1);
	emitter.listen(handler2);

	emitter.emit('test1');
	expect(count1).toBe(1);
	expect(count2).toBe(1);

	emitter.removeListener(handler1);
	emitter.emit('test2');
	expect(count1).toBe(1); // Should not increase
	expect(count2).toBe(2); // Should increase
});

// LazyAsyncEventEmitter Tests
test('LazyAsyncEventEmitter - lazy initialization', async () => {
	let initializationCount = 0;
	const emitter = new LazyAsyncEventEmitter(async () => {
		initializationCount++;
		return 'initialized';
	});

	expect(initializationCount).toBe(0); // Not initialized yet

	const value = await emitter.value;
	expect(value).toBe('initialized');
	expect(initializationCount).toBe(1);

	// Getting value again should not re-initialize
	const value2 = await emitter.value;
	expect(value2).toBe('initialized');
	expect(initializationCount).toBe(1);
});

test('LazyAsyncEventEmitter - listen with initial option', async () => {
	const emitter = new LazyAsyncEventEmitter(async () => 'initial');
	let receivedValue = null as string | null;

	// Wait for initialization
	await emitter.value;

	const removeListener = emitter.listen(
		(value) => {
			receivedValue = value;
		},
		{ initial: true }
	);

	expect(receivedValue).toBe('initial');
	removeListener();
});

test('LazyAsyncEventEmitter - listen with once option', async () => {
	const emitter = new LazyAsyncEventEmitter(async () => 'initial');
	let callCount = 0;

	await emitter.value; // Initialize

	emitter.listen(
		() => {
			callCount++;
		},
		{ once: true }
	);

	emitter.emit('test1');
	expect(callCount).toBe(1);

	emitter.emit('test2');
	expect(callCount).toBe(1); // Should not increase due to once: true
});

test('LazyAsyncEventEmitter - listen with initial and once', async () => {
	const emitter = new LazyAsyncEventEmitter(async () => 'initial');
	let receivedValue = null as string | null;
	let callCount = 0;

	await emitter.value; // Initialize

	const removeListener = emitter.listen(
		(value) => {
			receivedValue = value;
			callCount++;
		},
		{ initial: true, once: true }
	);

	expect(receivedValue).toBe('initial');
	expect(callCount).toBe(1);

	// Should not receive further events
	emitter.emit('test');
	expect(callCount).toBe(1);

	// removeListener should be a no-op function
	expect(typeof removeListener).toBe('function');
});

test('LazyAsyncEventEmitter - handles undefined initialization', async () => {
	const emitter = new LazyAsyncEventEmitter<string>(async () => undefined);
	let receivedValue = 'not-set' as string | undefined;

	emitter.listen((value) => {
		receivedValue = value;
	});

	emitter.emit('manual-emit');
	expect(receivedValue).toBe('manual-emit');
});

// GetterAsyncEventEmitter Tests
test('GetterAsyncEventEmitter - gets value on demand', async () => {
	let getCount = 0;
	const emitter = new GetterAsyncEventEmitter(async () => {
		getCount++;
		return `value-${getCount}`;
	});

	const value1 = await emitter.value;
	expect(value1).toBe('value-1');
	expect(getCount).toBe(1);

	const value2 = await emitter.value;
	expect(value2).toBe('value-2');
	expect(getCount).toBe(2);
});

test('GetterAsyncEventEmitter - multiple simultaneous calls', async () => {
	let getCount = 0;
	const emitter = new GetterAsyncEventEmitter(async () => {
		getCount++;
		await new Promise((resolve) => setTimeout(resolve, 0)); // Small delay
		return `value-${getCount}`;
	});

	// Start two value calls simultaneously
	const [value1, value2] = await Promise.all([emitter.value, emitter.value]);

	// Both calls should trigger the getter
	expect(getCount).toBe(2);
	// Both contain the latest value
	expect([value1, value2]).toEqual(
		expect.arrayContaining(['value-2', 'value-2'])
	);
});

test('GetterAsyncEventEmitter - listener receives emitted values', async () => {
	const emitter = new GetterAsyncEventEmitter(async () => 'getter-value');
	let receivedValue = null as string | null;

	emitter.listen((value) => {
		receivedValue = value;
	});

	await emitter.value;
	expect(receivedValue).toBe('getter-value');
});

// CombinedAsyncEventEmitter Tests
test('CombinedAsyncEventEmitter - combines multiple emitters', async () => {
	const emitter1 = new LazyAsyncEventEmitter(async () => 'value1');
	const emitter2 = new LazyAsyncEventEmitter(async () => 'value2');
	const emitter3 = new LazyAsyncEventEmitter(async () => 'value3');

	const combined = new CombinedAsyncEventEmitter([
		emitter1,
		emitter2,
		emitter3,
	]);

	const value = await combined.value;
	expect(value).toEqual(['value1', 'value2', 'value3']);
});

test('CombinedAsyncEventEmitter - updates when individual emitters change', async () => {
	const emitter1 = new LazyAsyncEventEmitter(async () => 'initial1');
	const emitter2 = new LazyAsyncEventEmitter(async () => 'initial2');

	const combined = new CombinedAsyncEventEmitter([emitter1, emitter2]);

	// Wait for initial values
	await combined.value;

	// Wait a bit for the update to propagate
	await new Promise((resolve) => setTimeout(resolve, 0));

	const receivedValues: string[][] = [];
	combined.listen((values) => {
		receivedValues.push([...values]);
	});

	// Update first emitter
	emitter1.emit('updated1');

	// Wait a bit for the update to propagate
	await new Promise((resolve) => setTimeout(resolve, 0));

	expect(receivedValues).toHaveLength(1);
	expect(receivedValues[0]).toEqual(['updated1', 'initial2']);
});

test('CombinedAsyncEventEmitter - empty array of emitters', async () => {
	const combined = new CombinedAsyncEventEmitter([]);
	const value = await combined.value;
	expect(value).toEqual([]);
});

// MappedAsyncEventEmitter Tests
test('MappedAsyncEventEmitter - maps values correctly', async () => {
	const sourceEmitter = new LazyAsyncEventEmitter(async () => 5);
	const mapped = new MappedAsyncEventEmitter(
		sourceEmitter,
		async (value: number) => value * 2
	);

	const value = await mapped.value;
	expect(value).toBe(10);
});

test('MappedAsyncEventEmitter - async mapper function', async () => {
	const sourceEmitter = new LazyAsyncEventEmitter(async () => 'hello');
	const mapped = new MappedAsyncEventEmitter(
		sourceEmitter,
		async (value: string) => {
			await new Promise((resolve) => setTimeout(resolve, 0));
			return value.toUpperCase();
		}
	);

	const value = await mapped.value;
	expect(value).toBe('HELLO');
});

test('MappedAsyncEventEmitter - propagates source changes', async () => {
	const sourceEmitter = new LazyAsyncEventEmitter(async () => 1);
	const mapped = new MappedAsyncEventEmitter(
		sourceEmitter,
		async (value: number) => value * 10
	);

	let receivedValue = null as number | null;
	mapped.listen((value) => {
		receivedValue = value;
	});

	// Wait for initial value
	await mapped.value;

	// Wait for initial value
	await new Promise((resolve) => setTimeout(resolve, 0));

	// Update source
	sourceEmitter.emit(5);

	// Wait for propagation
	await new Promise((resolve) => setTimeout(resolve, 0));

	expect(receivedValue).toBe(50);
});

test('MappedAsyncEventEmitter - ignores null/undefined source values', async () => {
	const sourceEmitter = new LazyAsyncEventEmitter(async () => 'initial');
	const mapped = new MappedAsyncEventEmitter(
		sourceEmitter,
		async (value: string) => value + '-mapped'
	);

	let callCount = 0;
	let lastValue = null as string | null;

	// Wait for initial value first
	await mapped.value;

	// Now listen for changes only
	mapped.listen((value) => {
		callCount++;
		lastValue = value;
	});

	// These should be ignored
	sourceEmitter.emit(null);
	sourceEmitter.emit(undefined);

	await new Promise((resolve) => setTimeout(resolve, 0));

	expect(callCount).toBe(0); // Should not have called the listener for null/undefined
	expect(lastValue).toBe(null); // No values should have been received
});

test('MappedAsyncEventEmitter - emit delegates to source', () => {
	const sourceEmitter = new LazyAsyncEventEmitter(async () => 'initial');
	const mapped = new MappedAsyncEventEmitter(
		sourceEmitter,
		async (value: string) => value + '-mapped'
	);

	let sourceReceived = null as string | null;
	sourceEmitter.listen((value) => {
		sourceReceived = value;
	});

	mapped.emit('test-value');
	expect(sourceReceived).toBe('test-value');
});

// Type compatibility and edge case tests
test('EventEmitter - type compatibility with different V and M types', () => {
	const emitter = new EventEmitter<string, number>();
	let receivedValue = null as number | null;

	emitter.listen((value) => {
		receivedValue = value;
	});

	// This should work since we're casting string to number via unknown
	emitter.emit('test');
	expect(receivedValue).toBe('test' as unknown as number);
});

test('AsyncEventEmitter subclasses - deduplication of same values', async () => {
	const emitter = new LazyAsyncEventEmitter(async () => 'same');
	let callCount = 0;

	// Wait for initialization first
	await emitter.value;

	// Now listen for changes - should not get initial value again
	emitter.listen(() => {
		callCount++;
	});

	// Emitting the same value should not trigger listeners again
	emitter.emit('same');
	emitter.emit('same');

	expect(callCount).toBe(0); // No additional calls for duplicate values
});

// Error handling and edge cases
test('LazyAsyncEventEmitter - handles initialization errors gracefully', async () => {
	const emitter = new LazyAsyncEventEmitter(async () => {
		throw new Error('Initialization failed');
	});

	expect(emitter.value).rejects.toThrow('Initialization failed');
});

test('GetterAsyncEventEmitter - handles getter errors gracefully', async () => {
	const emitter = new GetterAsyncEventEmitter(async () => {
		throw new Error('Getter failed');
	});

	expect(emitter.value).rejects.toThrow('Getter failed');
});

test('MappedAsyncEventEmitter - handles mapper errors gracefully', async () => {
	const sourceEmitter = new LazyAsyncEventEmitter(async () => 'test');
	const mapped = new MappedAsyncEventEmitter(sourceEmitter, async () => {
		throw new Error('Mapper failed');
	});

	await new Promise((resolve) => setTimeout(resolve, 0));

	expect(mapped.value).rejects.toThrow('Mapper failed');
});
