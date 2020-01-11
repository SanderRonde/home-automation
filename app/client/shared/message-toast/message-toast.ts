import {
	CHANGE_TYPE,
	bindToClass,
	TemplateFn,
	config,
	ConfigurableWebComponent,
	Props,
	PROP_TYPE,
	wait
} from '../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { render } from '../../../../node_modules/lit-html/lit-html.js';
import { clampWidthSelector } from '../css-util/css-util.js';

interface CreateConfig {
	message: string;
	button?: string;
	duration?: number;
	onClick?: (e: MouseEvent) => void;
}

@config({
	is: 'message-toast',
	html: new TemplateFn<MessageToast>(
		function(html, props) {
			return html`
				<div id="toast">
					<div id="text">${props.message}</div>
					<div @click="${this.onClick}" id="button">
						${props.button}
					</div>
				</div>
			`;
		},
		CHANGE_TYPE.PROP,
		render
	),
	css: new TemplateFn<MessageToast>(
		html => {
			return html`
				<style>
					:host {
						position: fixed;
						bottom: 0;
						transform: translateY(100%);
						left: 20px;
						transition: transform 300ms ease-in;
						-webkit-box-shadow: 11px 9px 18px 0px rgba(0,0,0,0.75);
						-moz-box-shadow: 11px 9px 18px 0px rgba(0,0,0,0.75);
						box-shadow: 11px 9px 18px 0px rgba(0,0,0,0.75);
					}

					:host(.visible) {
						transform: translateY(-20px);
					}

					#toast {
						background-color: rgb(39, 39, 39);
						color: rgb(225, 225, 225);
						display: flex;
						flex-direction: row;
						justify-content: flex-start;
						font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif
					}

					${clampWidthSelector('#toast')(
						['padding', '3.6vw'],
						['font-size', '6vw']
					)}

					#button {
						color: yellow;
						margin-left: 4vw;
						cursor: pointer;
						margin-right: 2vw;
					}

					${clampWidthSelector('#button')(
						['margin-left', '4vw'],
						['margin-right', '2vw']
					)}
				</style>
			`;
		},
		CHANGE_TYPE.NEVER,
		render
	)
})
export class MessageToast extends ConfigurableWebComponent<{
	selectors: {
		IDS: {};
		CLASSES: {};
	};
	events: {
		click: {
			args: [MouseEvent];
		};
		hide: {
			args: [];
		};
	};
}> {
	props = Props.define(this, {
		reflect: {
			message: PROP_TYPE.STRING,
			button: {
				type: PROP_TYPE.STRING,
				value: 'hide'
			},
			duration: {
				type: PROP_TYPE.NUMBER,
				value: 10000
			}
		}
	});

	async hide() {
		this.classList.remove('visible');
		await wait(500);
		this.remove();
		this.fire('hide');
	}

	@bindToClass
	onClick(e: MouseEvent) {
		this.fire('click', e);
		this.hide();
	}

	async mounted() {
		if (this.props.duration !== Infinity) {
			window.setTimeout(() => {
				this.hide();
			}, this.props.duration);
		}

		await wait(0);
		this.classList.add('visible');
	}

	private static _activeToast: MessageToast | null = null;

	private static _create({
		message,
		onClick,
		button = 'hide',
		duration = 10000
	}: CreateConfig): MessageToast {
		const toast = document.createElement('message-toast') as MessageToast;
		toast.props.message = message;
		toast.props.button = button;
		toast.props.duration = duration;
		if (onClick) {
			toast.listen('click', onClick);
		}

		this._activeToast = toast;
		toast.listen('hide', () => {
			this._activeToast = null;
		});

		document.body.appendChild(toast);
		return toast;
	}

	static create(config: CreateConfig): MessageToast {
		if (this._activeToast) {
			this._activeToast.hide();
		}
		return this._create(config);
	}
}
