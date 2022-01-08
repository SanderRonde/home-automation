import {
	ConfigurableWebComponent,
	Props,
	PROP_TYPE,
	config,
	EventListenerObj,
} from '../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { MessageToast } from '../message-toast/message-toast.js';

@config({
	is: 'server-comm',
	html: null,
	css: null,
	dependencies: [MessageToast],
})
export abstract class ServerComm<
	ELS extends {
		IDS: {
			[key: string]: HTMLElement | SVGElement;
		};
		CLASSES: {
			[key: string]: HTMLElement | SVGElement;
		};
	} = {
		IDS: Record<string, never>;
		CLASSES: Record<string, never>;
	},
	E extends EventListenerObj = Record<string, never>
> extends ConfigurableWebComponent<{
	selectors: ELS;
	events: E;
}> {
	public props = Props.define(this, {
		reflect: {
			key: {
				type: PROP_TYPE.STRING,
			},
		},
	});

	protected async assertOnline(): Promise<void> {
		if (navigator.onLine) {
			return;
		}
		return new Promise((resolve) => {
			const toast = MessageToast.create({
				message: 'Waiting for internet...',
				duration: 100000000,
			});

			const interval = window.setInterval(() => {
				void (async () => {
					if (navigator.onLine) {
						window.clearInterval(interval);
						await (await toast).hide();
						resolve();
					}
				})();
			}, 1000);
		});
	}

	protected async request(
		url: string,
		postBody: {
			[key: string]: unknown;
		} = {},
		errName = 'Failed request'
	): Promise<false | Response> {
		await this.assertOnline();

		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ ...postBody }),
				credentials: 'include',
			});
			if (!response.ok) {
				await MessageToast.create({
					message: `${errName} ${response.status}`,
					duration: 5000,
				});
				return false;
			}
			return response;
		} catch (e) {
			await MessageToast.create({
				message: `${errName} (network error)`,
				duration: 5000,
			});
			return false;
		}
	}
}
