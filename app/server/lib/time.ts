export class Time {
	public hours: number;
	public minutes: number;

	public constructor(timeString: string);
	public constructor(hours: number, minutes: number);
	public constructor(hoursOrStr: number | string, minutes?: number) {
		if (typeof hoursOrStr === 'string') {
			const [hours, minutes] = hoursOrStr.split(':');
			this.hours = parseInt(hours, 10);
			this.minutes = parseInt(minutes, 10);
		} else {
			this.hours = hoursOrStr;
			this.minutes = minutes || 0;
		}
	}

	public static toTime(timeStr: string): Time {
		const [hours, minutes] = timeStr.split(':');
		return new Time(parseInt(hours, 10), parseInt(minutes, 10));
	}

	public static dateToTime(date: Date): Time {
		const hours = date.getHours();
		const mins = date.getMinutes();
		return new Time(hours, mins);
	}

	public toMinutes(): number {
		return this.hours * 60 + this.minutes;
	}

	public isInRange(from: Time, to: Time): boolean {
		const timeMins = this.toMinutes();
		const fromMins = from.toMinutes();
		const toMins = to.toMinutes();

		if (fromMins > toMins) {
			if (timeMins > fromMins) {
				return true;
			}
			if (timeMins < toMins) {
				return true;
			}
			return false;
		} else {
			if (timeMins < fromMins || timeMins > toMins) {
				return false;
			}
			return true;
		}
	}
}
export function wait(time: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, time);
	});
}
export function asyncSetInterval(
	callback: () => void | Promise<void>,
	interval: number
): Timer {
	return setInterval(() => {
		void callback();
	}, interval);
}
