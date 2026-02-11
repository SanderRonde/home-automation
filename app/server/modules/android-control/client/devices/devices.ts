import type { AndroidControlProfileClient } from './base';
import { CreateHomeFanClient } from './create-home-fan';
import { AndroidControlProfile } from '../../types';
import type { AppConfig } from '../../../../app';

export { AndroidControlProfileClient } from './base';

export function getProfileClient(
	profile: AndroidControlProfile,
	deviceId: string,
	appConfig: AppConfig
): AndroidControlProfileClient {
	switch (profile) {
		case AndroidControlProfile.CREATE_HOME_FAN:
			return new CreateHomeFanClient(deviceId, appConfig);
	}
}
