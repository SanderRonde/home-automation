import * as castv2 from 'castv2-player';
import { CAST_DEVICE_NAMES } from '../../config/casts';
import { DummyCastLog } from './types';

const scannerPromise = castv2.ScannerPromise(new DummyCastLog());

export async function scan(): Promise<castv2.Device[]> {
	return (devices = (
		await Promise.all(CAST_DEVICE_NAMES.map((name) => scannerPromise(name)))
	).filter((device) => !!device));
}

export let devices: castv2.Device[] = [];
