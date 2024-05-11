import { CAST_DEVICE_NAMES } from '@server/config/casts';
import * as castv2 from 'castv2-player';
import { DummyCastLog } from '@server/modules/cast/types';

const scannerPromise = castv2.ScannerPromise(new DummyCastLog());

export async function scan(): Promise<castv2.Device[]> {
	return (devices = (
		await Promise.all(CAST_DEVICE_NAMES.map((name) => scannerPromise(name)))
	).filter((device) => !!device));
}

export let devices: castv2.Device[] = [];
