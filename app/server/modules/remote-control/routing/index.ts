import { listenAny, removeListener } from '@server/modules/remote-control/get-set-listener';
import { attachMessage } from '@server/lib/logger';
import { createRouter } from '@server/lib/api';
import { WebPageHandler } from '@server/modules/remote-control/web-page';
import { sendMessage } from '@server/modules/remote-control/routing/telnet';
import { ModuleConfig } from '@server/modules';
import { APIHandler } from '@server/modules/remote-control/api';
import { RemoteControl } from '..';

export function initRouting({
	app,
	randomNum,
	websocket,
}: ModuleConfig<typeof RemoteControl>): void {
	const webpageHandler = new WebPageHandler(randomNum);

	const router = createRouter(RemoteControl, APIHandler);
	router.post('/play', 'play');
	router.post('/pause', 'pause');
	router.post('/playpause', 'playpause');
	router.post('/close', 'close');
	router.post('/volumeup/:amount?', 'volumeUp');
	router.post('/volumedown/:amount?', 'volumeDown');
	router.post('/setvolume/:amount', 'setVolume');
	router.use(app);

	websocket.all('/remote-control/listen', ({ send, onDead, addListener }) => {
		let authenticated = false;
		addListener(async (message) => {
			if (authenticated) {
				return;
			}

			const external = new (await RemoteControl.modules).auth.External(
				{},
				'REMOTE_CONTROL.WS'
			);
			if (await external.authenticate(message)) {
				authenticated = true;

				const listener = listenAny((command, logObj) => {
					attachMessage(logObj, 'Sending remote control message');
					send(JSON.stringify(command));
				});

				onDead(() => {
					removeListener(listener);
				});
			}
		});
	});

	// Update any VLC telnet instances on change
	listenAny(async (command, logObj) => {
		attachMessage(logObj, 'Sending vlc telnet remote control message');
		await sendMessage(command, logObj);
	});

	app.all('/remote-control', (_req, res) => {
		webpageHandler.index(res);
	});
}
