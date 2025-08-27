import { LogObj } from '../../lib/logging/lob-obj';
import { createRoutes } from '../../lib/routes';
import type { Routes } from '../../lib/routes';
import { triggerWebhooks } from './webhooks';

export function initRouting(): Routes {
	return createRoutes({
		'/:name': async (req) => {
			const name = req.params.name;
			const params = await req.json();
			await triggerWebhooks(
				name,
				params,
				LogObj.fromReqRes(req).attachMessage(`Webhook ${name}`)
			);
			return new Response('OK', { status: 200 });
		},
	});
}
