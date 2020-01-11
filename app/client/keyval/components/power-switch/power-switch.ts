import {
	config,
	ConfigurableWebComponent,
	Props,
	PROP_TYPE
} from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { PowerSwitchHTML, PowerSwitchCSS } from './power-switch.templates.js';

@config({
	is: 'power-switch',
	html: PowerSwitchHTML,
	css: PowerSwitchCSS
})
export class PowerSwitch extends ConfigurableWebComponent<{
	selectors: {
		IDS: {
			label: HTMLLabelElement;
			switch: HTMLInputElement;
		};
		CLASSES: {};
	};
	events: {
		toggle: {
			args: [boolean, boolean];
		};
	};
}> {
	private _element!: HTMLElement;
	private _inputElement!: HTMLInputElement;
	private _rippleContainerElement!: HTMLSpanElement;
	private static readonly _TINY_TIMEOUT = 0.001;
	private static readonly _CssClasses = {
		INPUT: 'mdl-switch__input',
		TRACK: 'mdl-switch__track',
		THUMB: 'mdl-switch__thumb',
		FOCUS_HELPER: 'mdl-switch__focus-helper',
		RIPPLE_EFFECT: 'mdl-js-ripple-effect',
		RIPPLE_IGNORE_EVENTS: 'mdl-js-ripple-effect--ignore-events',
		RIPPLE_CONTAINER: 'mdl-switch__ripple-container',
		RIPPLE_CENTER: 'mdl-ripple--center',
		RIPPLE: 'mdl-ripple',
		IS_FOCUSED: 'is-focused',
		IS_DISABLED: 'is-disabled',
		IS_CHECKED: 'is-checked'
	};

	constructor() {
		super();

		this._updateScale();

		const original = window.onresize;
		window.onresize = (e: any) => {
			original && original.call(window, e);
			this._updateScale();
		};
	}

	private _updateScale() {
		this.props.scale = (Math.min(1000, window.innerWidth) / 411) * 200;
	}

	props = Props.define(this, {
		reflect: {
			initial: {
				type: PROP_TYPE.BOOL,
				value: false
			},
			scale: {
				type: PROP_TYPE.NUMBER,
				value: 100
			}
		}
	});

	onChange() {
		this.fire('toggle', this.checked, !this.checked);
	}

	get checked() {
		return this.$.switch.checked;
	}

	get enabled() {
		return this.checked;
	}

	postRender() {
		this._element = this.$.label;
		this._inputElement = this.$.switch;
	}

	firstRender() {
		this._element = this.$.label;
		this._inputElement = this.$.switch;
		this._init();
	}

	private _onChange() {
		this._updateClasses();
	}

	private _onFocus() {
		this._element.classList.add(PowerSwitch._CssClasses.IS_FOCUSED);
	}

	private _onBlur() {
		this._element.classList.remove(PowerSwitch._CssClasses.IS_FOCUSED);
	}

	private _onMouseUp() {
		this._blur();
	}

	private _updateClasses() {
		this.checkDisabled();
		this.checkToggleState();
	}

	private _blur() {
		window.setTimeout(() => {
			this._inputElement.blur();
		}, PowerSwitch._TINY_TIMEOUT);
	}

	checkDisabled() {
		if (this._inputElement.disabled) {
			this._element.classList.add(PowerSwitch._CssClasses.IS_DISABLED);
		} else {
			this._element.classList.remove(PowerSwitch._CssClasses.IS_DISABLED);
		}
	}

	checkToggleState() {
		if (this._inputElement.checked) {
			this._element.classList.add(PowerSwitch._CssClasses.IS_CHECKED);
		} else {
			this._element.classList.remove(PowerSwitch._CssClasses.IS_CHECKED);
		}
	}

	disable() {
		this._inputElement.disabled = true;
		this._updateClasses();
	}

	enable() {
		this._inputElement.disabled = false;
		this._updateClasses();
	}

	on() {
		this._inputElement.checked = true;
		this._updateClasses();
	}

	off() {
		this._inputElement.checked = false;
		this._updateClasses();
	}

	private _init() {
		if (this._element) {
			var track = document.createElement('div');
			track.classList.add(PowerSwitch._CssClasses.TRACK);

			var thumb = document.createElement('div');
			thumb.classList.add(PowerSwitch._CssClasses.THUMB);

			var focusHelper = document.createElement('span');
			focusHelper.classList.add(PowerSwitch._CssClasses.FOCUS_HELPER);

			thumb.appendChild(focusHelper);

			this._element.appendChild(track);
			this._element.appendChild(thumb);

			if (
				this._element.classList.contains(
					PowerSwitch._CssClasses.RIPPLE_EFFECT
				)
			) {
				this._element.classList.add(
					PowerSwitch._CssClasses.RIPPLE_IGNORE_EVENTS
				);
				this._rippleContainerElement = document.createElement('span');
				this._rippleContainerElement.classList.add(
					PowerSwitch._CssClasses.RIPPLE_CONTAINER
				);
				this._rippleContainerElement.classList.add(
					PowerSwitch._CssClasses.RIPPLE_EFFECT
				);
				this._rippleContainerElement.classList.add(
					PowerSwitch._CssClasses.RIPPLE_CENTER
				);
				this._rippleContainerElement.addEventListener('mouseup', () => {
					this._onMouseUp();
				});

				var ripple = document.createElement('span');
				ripple.classList.add(PowerSwitch._CssClasses.RIPPLE);

				this._rippleContainerElement.appendChild(ripple);
				this._element.appendChild(this._rippleContainerElement);
			}

			this._inputElement.addEventListener('change', () => {
				this._onChange();
			});
			this._inputElement.addEventListener('focus', () => {
				this._onFocus();
			});
			this._inputElement.addEventListener('blur', () => {
				this._onBlur();
			});
			this._element.addEventListener('mouseup', () => {
				this._onMouseUp();
			});

			this._updateClasses();
			this._element.classList.add('is-upgraded');
		}
	}
}
