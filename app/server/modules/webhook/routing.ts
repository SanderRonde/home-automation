import { createServeOptions, untypedRequestJson } from '../../lib/routes';
import type { ServeOptions } from '../../lib/routes';
import { LogObj } from '../../lib/logging/lob-obj';
import { triggerWebhooks } from './webhooks';

function _initRouting() {
	return createServeOptions(
		{
			'/:name': async (req, _server, { text }) => {
				const name = req.params.name;
				const params = (await untypedRequestJson(req)) as Record<
					string,
					unknown
				>;
				await triggerWebhooks(
					name,
					params,
					LogObj.fromReqRes(req).attachMessage(`Webhook ${name}`)
				);
				return text('OK', 200);
			},
		},
		true
	);
}

export const initRouting = _initRouting as () => ServeOptions<unknown>;

export type WebhookRoutes =
	ReturnType<typeof _initRouting> extends ServeOptions<infer R> ? R : never;
