import {
	ConfigurableWebComponent,
	Props,
	PROP_TYPE,
	config,
	EventListenerObj
} from '../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { MessageToast } from '../message-toast/message-toast.js';

@config({
	is: 'server-comm',
	html: null,
	css: null,
	dependencies: [MessageToast]
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
		IDS: {};
		CLASSES: {};
	},
	E extends EventListenerObj = {}
> extends ConfigurableWebComponent<{
	selectors: ELS;
	events: E;
}> {
	props = Props.define(this, {
		reflect: {
			key: {
				type: PROP_TYPE.STRING
			}
		}
	});

	protected async assertOnline() {
		if (navigator.onLine) return;
		return new Promise(resolve => {
			const toast = MessageToast.create({
				message: 'Waiting for internet...',
				duration: 100000000
			});

			const interval = window.setInterval(() => {
				if (navigator.onLine) {
					window.clearInterval(interval);
					toast.hide();
					resolve();
				}
			}, 1000);
		});
	}

	protected async request(
		url: string,
		postBody: {
			[key: string]: any;
		} = {},
		errName: string = 'Failed request'
	) {
		await this.assertOnline();

		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ ...postBody }),
				credentials: 'include'
			});
			if (!response.ok) {
				MessageToast.create({
					message: `${errName} ${response.status}`,
					duration: 5000
				});
				return false;
			}
			return response;
		} catch (e) {
			MessageToast.create({
				message: `${errName} (network error)`,
				duration: 5000
			});
			return false;
		}
	}
}
