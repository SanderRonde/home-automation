import { addListener, removeListener, update } from './get-set-listener';
import { LogObj, attachMessage, logTag } from '../../lib/logger';
import { createRouter } from '../../lib/api';
import { WSSimInstance } from '../../lib/ws';
import { WebPageHandler } from './web-page';
import { APIHandler } from './api';
import { ModuleConfig } from '..';
import { KeyVal } from '.';
import chalk from 'chalk';

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
				(keyString) => {
					const keys = keyString.split(' ');
					const lastValues: string[] = keys.map((k) =>
						db.get(k, '0')
					);
					const onChange = (
						index: number,
						logObj: LogObj,
						force: boolean = false
					) => {
						const key = keys[index];
						const val = db.get(key, '0');
						if (val !== lastValues[index] || force) {
							lastValues[index] = val;
							attachMessage(
								logObj,
								`Sending "${val}" to`,
								chalk.bold(instance.ip)
							);
							instance.send('valChange', lastValues.join(' '));
						}
					};
					const listeners: number[] = [];
					for (let i = 0; i < keys.length; i++) {
						const key = keys[i];
						listeners.push(
							addListener(key, (_key, _value, logObj) =>
								onChange(i, logObj)
							)
						);
						onChange(i, {}, true);
					}

					instance.onClose = () => {
						listeners.forEach((l) => removeListener(l));
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
