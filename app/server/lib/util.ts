export function wait(time: number) {
	return new Promise(resolve => {
		setTimeout(resolve, time);
	});
}

export function objToArr<V>(obj: { [key: string]: V }): [string, V][] {
	return Object.keys(obj).map(k => [k, obj[k]]);
}

export function arrToObj<V>(
	arr: [string, V][]
): {
	[key: string]: V;
} {
	const obj: {
		[key: string]: V;
	} = {};
	for (const [key, val] of arr) {
		obj[key] = val;
	}
	return obj;
}

export async function awaitCondition(
	condition: () => boolean,
	interval: number,
	maxTime: number = Infinity
) {
	let tests: number = 0;
	let maxTests = maxTime / interval;

	while (!condition() && tests < maxTests) {
		await wait(interval);
		tests++;
	}
}

export namespace Time {
	export function toTime(timeStr: string): Time {
		const [hours, minutes] = timeStr.split(':');
		return {
			hours: parseInt(hours, 10),
			minutes: parseInt(minutes, 10)
		};
	}

	export interface Time {
		hours: number;
		minutes: number;
	}

	export function dateToTime(date: Date): Time {
		const hours = date.getHours();
		const mins = date.getMinutes();
		return {
			hours,
			minutes: mins
		};
	}

	function timeToMinutes({ hours, minutes }: Time): number {
		return hours * 60 + minutes;
	}

	export function isInRange(time: Time, from: Time, to: Time): boolean {
		const timeMins = timeToMinutes(time);
		const fromMins = timeToMinutes(from);
		const toMins = timeToMinutes(to);

		if (fromMins > toMins) {
			if (timeMins > fromMins) return true;
			if (timeMins < toMins) return true;
			return false;
		} else {
			if (timeMins < fromMins || timeMins > toMins) return false;
			return true;
		}
	}
}
