import { createServeOptions } from '../../lib/routes';
import type { ServeOptions } from '../../lib/routes';
import { LogObj } from '../../lib/logging/lob-obj';
import { triggerWebhooks } from './webhooks';

export function initRouting(): ServeOptions {
	return createServeOptions({
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
