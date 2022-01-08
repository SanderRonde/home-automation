import { attachMessage } from './logger';
import * as express from 'express';

interface Timing {
	label: string;
	time: number;
}

const timedRequests: WeakMap<express.Response, Timing[]> = new WeakMap();

export function attachTimerToReq(res: express.Response): void {
	timedRequests.set(res, [
		{
			label: 'start',
			time: Date.now(),
		},
	]);
}

export function gatherTimings(res: express.Response): void {
	if (!timedRequests.has(res)) {
		return;
	}

	const timings = timedRequests.get(res)!;
	timings.push({
		label: 'end',
		time: Date.now(),
	});

	const timingsLog = attachMessage(res, 'Timings:');
	const startTime = timings[0].time;

	for (const { label, time } of timings) {
		attachMessage(timingsLog, `+${time - startTime}ms - ${label}`);
	}

	timedRequests.delete(res);
}

export function time(res: express.Response, label: string): void {
	if (!timedRequests.has(res)) {
		throw new Error(
			'Attempt to time request that has not been initialized for timing'
		);
	}

	timedRequests.get(res)!.push({
		label,
		time: Date.now(),
	});
}

export function captureTime(): {
	getTime(): number;
} {
	const start = Date.now();
	return {
		getTime() {
			return Date.now() - start;
		},
	};
}
