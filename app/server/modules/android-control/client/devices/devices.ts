import { CreateHomeFanClient } from './create-home-fan';
import { AndroidControlProfileClient } from './base';
import { AndroidControlProfile } from '../../types';
import { AppConfig } from '../../../../app';

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
