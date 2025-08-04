import { LogObj } from '../../lib/logging/lob-obj';
import { logTag } from '../../lib/logging/logger';
import type { WSSimInstance } from '../../lib/ws';
import { createRouter } from '../../lib/api';
import { WebPageHandler } from './web-page';
import type { APIHandler } from './api';
import type { ModuleConfig } from '..';
import { KeyVal } from '.';
import chalk from 'chalk';

type WSMessages = {
	send: 'authid' | 'authfail' | 'authsuccess' | 'valChange';
	receive: 'auth' | 'listen' | 'button';
};

export function initRouting(
	keyval: typeof KeyVal,
	{
		app,
		db,
		randomNum,
		apiHandler,
		websocketSim,
	}: ModuleConfig<typeof KeyVal> & { apiHandler: APIHandler }
): void {
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
							logObj.attachMessage(
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
							keyval.addListener(
								LogObj.fromEvent('KEYVAL.WS.LISTEN'),
								key,
								(_key, _value, logObj) => onChange(i, logObj)
							)
						);
						onChange(i, LogObj.fromEvent('KEYVAL.WS.LISTEN'), true);
					}

					instance.onClose = () => {
						listeners.forEach((l) => keyval.removeListener(l));
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
					await keyval.update(
						key,
						value.trim(),
						LogObj.fromEvent('KEYVAL.WS.BUTTON'),
						db
					);
				},
				instance.ip
			);
		}
	);
}
