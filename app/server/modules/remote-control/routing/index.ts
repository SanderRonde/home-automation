import { RemoteControl } from '..';
import { ModuleConfig } from '../..';
import { createRouter } from '../../../lib/api';
import { attachMessage } from '../../../lib/logger';
import { Auth } from '../../auth';
import { APIHandler } from '../api';
import { listenAny, removeListener } from '../get-set-listener';
import { WebPageHandler } from '../web-page';
import { sendMessage } from './telnet';

export function initRouting({ app, randomNum, websocket }: ModuleConfig): void {
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
		addListener((message) => {
			if (authenticated) {
				return;
			}

			// TODO: replace with external
			if (Auth.Secret.authenticate(message)) {
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

	app.all('/remote-control', (req, res) => {
		webpageHandler.index(res, req);
	});
}