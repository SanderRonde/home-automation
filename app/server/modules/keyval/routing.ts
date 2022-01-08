import chalk from 'chalk';
import { KeyVal } from '.';
import { ModuleConfig } from '..';
import { createRouter } from '../../lib/api';
import { LogObj, attachMessage, logTag } from '../../lib/logger';
import { WSSimInstance } from '../../lib/ws';
import { APIHandler } from './api';
import { addListener, removeListener, update } from './get-set-listener';
import { WebPageHandler } from './web-page';

type WSMessages = {
	send: 'authid' | 'authfail' | 'authsuccess' | 'valChange';
	receive: 'auth' | 'listen' | 'button';
};

export function initRouting({
	app,
	db,
	randomNum,
	apiHandler,
	websocketSim,
}: ModuleConfig & { apiHandler: APIHandler }): void {
	const webpageHandler = new WebPageHandler({ randomNum, db });

	const router = createRouter(KeyVal, apiHandler);
	router.post('/all', 'all');
	router.post('/long/:key', 'getLongPoll');
	router.get('/long/:maxtime/:auth/:key/:expected', 'getLongPoll');
	router.post('/:key', 'get');
	router.post('/toggle/:key', 'toggle');
	router.post('/:key/:value', 'set');
	router.all('/', async (req, res) => {
		await webpageHandler.index(res, req);
	});
	router.use(app);

	websocketSim.all(
		'/keyval/websocket',
		(instance: WSSimInstance<WSMessages>) => {
			instance.listen(
				'listen',
				(key) => {
					let lastVal: string | undefined = undefined;
					const onChange = (
						_value: string,
						_key: string,
						logObj: LogObj
					) => {
						const val = db.get(key, '0');
						if (val !== lastVal) {
							lastVal = val;
							attachMessage(
								logObj,
								`Sending "${val}" to`,
								chalk.bold(instance.ip)
							);
							instance.send('valChange', val);
						}
					};
					const listener = addListener(key, onChange);
					onChange('0', key, {});

					instance.onClose = () => {
						removeListener(listener);
					};
				},
				instance.ip
			);
			instance.listen(
				'button',
				async (data) => {
					logTag('touch-screen', 'cyan', chalk.bold(data));
					const [key, value] = data.split(' ');
					db.setVal(key, value.trim());
					await update(key, value.trim(), {});
				},
				instance.ip
			);
		}
	);
}
