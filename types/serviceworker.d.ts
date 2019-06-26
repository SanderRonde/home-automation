interface ServiceWorkerEvent {
	waitUntil(prom: Promise<any>): void;
}

export type Remove<T, K> = {
	[P in Exclude<keyof T, K>]: T[P];
}

export interface ServiceworkerSelf extends Window {
	addEventListener(type: 'install', listener: (this: Window, ev: Event & ServiceWorkerEvent) => void): void;
	addEventListener(type: 'activate', listener: (this: Window, ev: Event & ServiceWorkerEvent) => void): void;
	addEventListener<T = any>(type: 'message', listener: (this: Window, ev: Remove<MessageEvent, 'data'> & ServiceWorkerEvent & {
		data: T;
	}) => void): void;
	addEventListener(type: 'fetch', listener: (this: Window, ev: Event & ServiceWorkerEvent & {
		respondWith(res: Response|Promise<Response>): void;
		request: Request;
	}) => void): void;
	skipWaiting(): void;
	clients: {
		claim(): Promise<any>;
		matchAll(): Promise<{
			postMessage(data: any): void;
		}[]>;
	}
}