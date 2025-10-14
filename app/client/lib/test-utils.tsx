import { render, type RenderOptions } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import * as React from 'react';

// Setup happy-dom for Bun test environment
// @ts-expect-error - happy-dom is an ES module, but works fine in Bun test environment
import { Window } from 'happy-dom';

let window: Window | null = null;

/**
 * Initialize the DOM environment for testing
 * Call this at the beginning of your test file
 */
export function setupDOM(): void {
	window = new Window();
	// @ts-expect-error - Setting up global for testing
	globalThis.window = window;
	// @ts-expect-error - Setting up global for testing
	globalThis.document = window.document;
	// @ts-expect-error - Setting up global for testing
	globalThis.navigator = window.navigator;
	// @ts-expect-error - Setting up global for testing
	globalThis.HTMLElement = window.HTMLElement;
	// @ts-expect-error - Setting up global for testing
	globalThis.MouseEvent = window.MouseEvent;

	// Polyfill PointerEvent for happy-dom
	if (!globalThis.PointerEvent) {
		// @ts-expect-error - Polyfilling PointerEvent
		globalThis.PointerEvent = class PointerEvent extends window.MouseEvent {
			public pointerId: number = 1;
			public width: number = 1;
			public height: number = 1;
			public pressure: number = 0;
			public tangentialPressure: number = 0;
			public tiltX: number = 0;
			public tiltY: number = 0;
			public twist: number = 0;
			public pointerType: string = 'mouse';
			public isPrimary: boolean = true;

			constructor(type: string, init?: PointerEventInit) {
				super(type, init as unknown as never);
				if (init) {
					this.pointerId = init.pointerId ?? 1;
					this.width = init.width ?? 1;
					this.height = init.height ?? 1;
					this.pressure = init.pressure ?? 0;
					this.tangentialPressure = init.tangentialPressure ?? 0;
					this.tiltX = init.tiltX ?? 0;
					this.tiltY = init.tiltY ?? 0;
					this.twist = init.twist ?? 0;
					this.pointerType = init.pointerType ?? 'mouse';
					this.isPrimary = init.isPrimary ?? true;
				}
			}
		};
	}
}

/**
 * Clean up the DOM environment after testing
 * Call this at the end of your test file or in afterAll
 */
export function teardownDOM(): void {
	if (window) {
		window.close();
		window = null;
	}
}

/**
 * Custom render function that includes common providers
 */
export function renderWithProviders(
	ui: React.ReactElement,
	options?: Omit<RenderOptions, 'wrapper'>
): ReturnType<typeof render> {
	// For now, we don't have any global providers, but this is where
	// you would wrap with ThemeProvider, Router, etc.
	const Wrapper = ({ children }: { children: React.ReactNode }): JSX.Element => {
		return <>{children}</>;
	};

	return render(ui, { wrapper: Wrapper, ...options });
}

/**
 * Mock fetch for API calls
 */
export interface MockFetchResponse {
	ok: boolean;
	status: number;
	json: () => Promise<unknown>;
	text: () => Promise<string>;
}

export class MockFetchManager {
	private responses = new Map<string, MockFetchResponse>();
	private calls: Array<{ url: string; init?: RequestInit }> = [];

	public mockResponse(url: string, response: MockFetchResponse): void {
		this.responses.set(url, response);
	}

	public mockJsonResponse(url: string, data: unknown, status = 200): void {
		this.responses.set(url, {
			ok: status >= 200 && status < 300,
			status,
			json: async () => data,
			text: async () => JSON.stringify(data),
		});
	}

	public mockErrorResponse(url: string, status = 500, message = 'Internal Server Error'): void {
		this.responses.set(url, {
			ok: false,
			status,
			json: async () => ({ error: message }),
			text: async () => message,
		});
	}

	public fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
		const url =
			typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
		this.calls.push({ url, init });

		const mockResponse = this.responses.get(url);
		if (mockResponse) {
			return mockResponse as unknown as Response;
		}

		// Default 404 response
		return {
			ok: false,
			status: 404,
			json: async () => ({ error: 'Not Found' }),
			text: async () => 'Not Found',
		} as unknown as Response;
	};

	public getCalls(): Array<{ url: string; init?: RequestInit }> {
		return this.calls;
	}

	public getCallCount(url?: string): number {
		if (url) {
			return this.calls.filter((call) => call.url === url).length;
		}
		return this.calls.length;
	}

	public reset(): void {
		this.responses.clear();
		this.calls = [];
	}
}

/**
 * Create a mock fetch manager and install it
 */
export function createMockFetch(): MockFetchManager {
	const manager = new MockFetchManager();
	globalThis.fetch = manager.fetch as typeof globalThis.fetch;
	return manager;
}

/**
 * Mock WebSocket for testing real-time updates
 */
export class MockWebSocket {
	public url: string;
	public readyState: number = WebSocket.CONNECTING;
	public onopen: ((event: Event) => void) | null = null;
	public onmessage: ((event: MessageEvent) => void) | null = null;
	public onerror: ((event: Event) => void) | null = null;
	public onclose: ((event: CloseEvent) => void) | null = null;

	private messageQueue: unknown[] = [];

	public constructor(url: string) {
		this.url = url;
		// Simulate connection opening after a tick
		setTimeout(() => {
			this.readyState = WebSocket.OPEN;
			if (this.onopen) {
				this.onopen(new Event('open'));
			}
			// Send queued messages
			for (const message of this.messageQueue) {
				this.simulateMessage(message);
			}
			this.messageQueue = [];
		}, 0);
	}

	public send(_data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
		// Mock send - could track sent messages if needed
	}

	public close(code?: number, reason?: string): void {
		this.readyState = WebSocket.CLOSED;
		if (this.onclose) {
			this.onclose(
				new CloseEvent('close', {
					code: code || 1000,
					reason: reason || '',
				})
			);
		}
	}

	/**
	 * Simulate receiving a message from the server
	 */
	public simulateMessage(data: unknown): void {
		if (this.readyState !== WebSocket.OPEN) {
			this.messageQueue.push(data);
			return;
		}

		if (this.onmessage) {
			this.onmessage(
				new MessageEvent('message', {
					data: typeof data === 'string' ? data : JSON.stringify(data),
				})
			);
		}
	}

	/**
	 * Simulate a connection error
	 */
	public simulateError(): void {
		if (this.onerror) {
			this.onerror(new Event('error'));
		}
	}

	/**
	 * Simulate server closing the connection
	 */
	public simulateClose(code = 1000, reason = ''): void {
		this.close(code, reason);
	}
}

/**
 * Install mock WebSocket
 */
export function installMockWebSocket(): typeof MockWebSocket {
	(globalThis as unknown as { WebSocket: typeof MockWebSocket }).WebSocket = MockWebSocket;
	return MockWebSocket;
}

/**
 * Wait for an element to appear or condition to be true
 */
export async function waitFor(
	callback: () => void | Promise<void>,
	options: { timeout?: number; interval?: number } = {}
): Promise<void> {
	const { timeout = 1000, interval = 50 } = options;
	const start = Date.now();

	// eslint-disable-next-line no-constant-condition
	while (true) {
		try {
			await callback();
			return;
		} catch (error) {
			if (Date.now() - start > timeout) {
				throw error;
			}
			await new Promise((resolve) => setTimeout(resolve, interval));
		}
	}
}

/**
 * Create user event instance for testing user interactions
 */
export function createUser(): ReturnType<typeof userEvent.setup> {
	return userEvent.setup();
}

/**
 * Helper to fire custom events
 */
export function fireEvent(element: Element, eventType: string, eventInit?: EventInit): void {
	const event = new Event(eventType, eventInit);
	element.dispatchEvent(event);
}

// Re-export common testing library utilities
export * from '@testing-library/react';
export { userEvent };
