import adb, { Device } from '@devicefarmer/adbkit';

import { exit, log, wait, adb$ } from './android-util';

const APK_NAME = 'com.ikohs.home';

async function getValidDevice() {
	const adbClient = adb.createClient();
	const devices = await (adbClient.listDevices() as Promise<Device[]>);

	if (devices.length === 0) {
		exit('🔍', 'No devices found');
	}

	if (devices.length > 1) {
		exit('🔍', 'Multiple devices found, please connect just one');
	}

	return {
		deviceName: devices[0].id,
		adbClient,
	};
}

async function main(email: string, password: string) {
	log('📱', 'Finding device');
	const { deviceName } = await getValidDevice();
	log('📱', `Using device "${deviceName}"`);

	const runWithTimeout = async (cmd: string, timeout: number = 400) => {
		await adb$(deviceName, cmd);
		await wait(timeout);
	};

	log('🏠', 'Going to home screen');
	await runWithTimeout('shell input keyevent KEYCODE_HOME', 500);

	log('🧹', 'Clearing data');
	await runWithTimeout(`shell pm clear ${APK_NAME}`);

	log('🧹', 'Resetting state');
	await runWithTimeout(
		`shell am start -a android.settings.APPLICATION_DETAILS_SETTINGS -d package:${APK_NAME}`,
		500
	);
	await runWithTimeout('shell input keyevent KEYCODE_BACK');
	await runWithTimeout('shell input keyevent KEYCODE_BACK');
	await runWithTimeout('shell input keyevent KEYCODE_BACK');

	log('🔔', 'Giving notification permission');
	await runWithTimeout(
		`shell am start -a android.settings.APPLICATION_DETAILS_SETTINGS -d package:${APK_NAME}`,
		500
	);
	await runWithTimeout('shell input tap 540 1396');
	await runWithTimeout('shell input tap 540 2100');
	await runWithTimeout('shell input tap 700 920');
	await runWithTimeout('shell input keyevent KEYCODE_BACK');

	log('🌍', 'Giving location permission');
	await runWithTimeout('shell input tap 540 1596');
	await runWithTimeout('shell input tap 540 1300');
	await runWithTimeout('shell input keyevent KEYCODE_BACK');

	log('🏠', 'Going back to the home screen');
	await runWithTimeout('shell input keyevent KEYCODE_HOME', 500);

	log('🚀', 'Starting app');
	await runWithTimeout(`shell monkey -p ${APK_NAME} -c android.intent.category.LAUNCHER 1`, 2500);

	log('🔑', 'Logging in...');
	await runWithTimeout('shell input tap 700 2100', 1000);
	await runWithTimeout(`shell input text ${email}`);
	await runWithTimeout('shell input keyevent KEYCODE_TAB');
	await runWithTimeout(`shell input text ${password}`);
	await runWithTimeout('shell input keyevent KEYCODE_TAB');
	await runWithTimeout('shell input keyevent KEYCODE_TAB');
	await runWithTimeout('shell input keyevent KEYCODE_SPACE');
	await runWithTimeout(`shell input text Netherlands`);
	await runWithTimeout('shell input tap 700 400', 1000);
	await runWithTimeout('shell input keyevent KEYCODE_TAB');
	await runWithTimeout('shell input keyevent KEYCODE_TAB');
	await runWithTimeout('shell input keyevent KEYCODE_TAB');
	await runWithTimeout('shell input keyevent KEYCODE_TAB');
	await runWithTimeout('shell input keyevent KEYCODE_TAB');
	await runWithTimeout('shell input keyevent KEYCODE_TAB');
	await runWithTimeout('shell input keyevent KEYCODE_ENTER', 5000);
	await runWithTimeout('shell input keyevent KEYCODE_TAB');
	await runWithTimeout('shell input keyevent KEYCODE_ENTER', 2000);
	await runWithTimeout('shell input keyevent KEYCODE_TAB');
	await runWithTimeout('shell input keyevent KEYCODE_ENTER', 2000);
	await runWithTimeout('shell input tap 700 1700');
	await runWithTimeout('shell input tap 150 2300');
	await runWithTimeout('shell input tap 250 700', 5000);
}

if (require.main === module) {
	const email = process.argv[2];
	const password = process.argv[3];
	if (!email || !password) {
		exit('🔍', 'Email and password are required. Run with `bun script.ts <email> <password>`');
	}
	main(email, password);
}
