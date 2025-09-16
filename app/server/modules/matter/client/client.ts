// Would be really nice to combine but for now Matter is broken in Bun:
// https://github.com/oven-sh/bun/issues/21547

import {
	MatterServerInputMessageType,
	MatterServerOutputMessageType,
	type MatterServerOutputMessage,
} from '../server/server';
import type {
	MatterDeviceInfo,
	MatterServerInputMessage,
	MatterServerInputReturnValues,
} from '../server/server';
import { DB_FOLDER, MATTER_DEBUG, ROOT } from '../../../lib/constants';
import type { ChildProcessWithoutNullStreams } from 'child_process';
import { logTag } from '../../../lib/logging/logger';
import type { EndpointNumber } from '@matter/types';
import { Data } from '../../../lib/data';
import { MatterDevice } from './device';
import { spawn } from 'child_process';
import * as path from 'path';

export class MatterClient implements Disposable {
	
}

if (require.main === module) {
	const matterClient = new MatterClient();
	matterClient.start();
	void matterClient.devices.subscribe((devices) => {
		console.log('devices', devices);
	});
}
