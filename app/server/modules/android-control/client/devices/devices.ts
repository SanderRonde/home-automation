import { CreateHomeFanClient } from './create-home-fan';
import { AndroidControlProfileClient } from './base';
import { AndroidControlProfile } from '../../types';
import type { Device } from '@devicefarmer/adbkit';
import { AppConfig } from '../../../../app';

export { AndroidControlProfileClient } from './base';

export function getProfileClient(
	profile: AndroidControlProfile,
	deviceId: string,
	device: Device | null,
	appConfig: AppConfig
): AndroidControlProfileClient {
	switch (profile) {
		case AndroidControlProfile.CREATE_HOME_FAN:
			return new CreateHomeFanClient(deviceId, device, appConfig);
	}
}
