import {
	CHANGE_TYPE,
	TemplateFn
} from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { render } from '../../../../../node_modules/lit-html/lit-html.js';
import { PowerSwitch } from './power-switch.js';

export const PowerSwitchHTML = new TemplateFn<PowerSwitch>(
	function(html, { props }) {
		return html`
			<label
				id="label"
				class="${[
					'mdl-switch',
					'mdl-js-switch',
					'is-upgraded',
					{
						'is-checked': props.initial
					}
				]}"
				for="switch"
			>
				<input
					@change="${this.onChange}"
					type="checkbox"
					id="switch"
					class="mdl-switch__input"
					?checked="${props.initial}"
				/>
				<span class="mdl-switch__label"></span>
			</label>
		`;
	},
	CHANGE_TYPE.PROP,
	render
);

export const PowerSwitchCSS = new TemplateFn<PowerSwitch>(
	(html, { props }) => {
		const scale = (props.scale || 100) / 100;
		return html`
			<style>
				/**
		* Copyright 2015 Google Inc. All Rights Reserved.
		*
		* Licensed under the Apache License, Version 2.0 (the "License");
		* you may not use this file except in compliance with the License.
		* You may obtain a copy of the License at
		*
		*			http://www.apache.org/licenses/LICENSE-2.0
		*
		* Unless required by applicable law or agreed to in writing, software
		* distributed under the License is distributed on an "AS IS" BASIS,
		* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
		* See the License for the specific language governing permissions and
		* limitations under the License.
		*/
				.mdl-switch {
					position: relative;
					z-index: 1;
					vertical-align: middle;
					display: inline-block;
					box-sizing: border-box;
					width: 100%;
					height: ${24 * scale}px;
					margin: 0;
					padding: 0;
					overflow: visible;
					-webkit-touch-callout: none;
					-webkit-user-select: none;
					-moz-user-select: none;
					-ms-user-select: none;
					user-select: none;
				}
				.mdl-switch.is-upgraded {
					padding-left: ${28 * scale}px;
				}

				.mdl-switch__input {
					line-height: ${24 * scale}px;
				}
				.mdl-switch.is-upgraded .mdl-switch__input {
					position: absolute;
					width: 0;
					height: 0;
					margin: 0;
					padding: 0;
					opacity: 0;
					-ms-appearance: none;
					-moz-appearance: none;
					-webkit-appearance: none;
					appearance: none;
					border: none;
				}

				.mdl-switch__track {
					background: rgba(0, 0, 0, 0.26);
					position: absolute;
					left: 0;
					top: ${5 * scale}px;
					height: ${14 * scale}px;
					width: ${36 * scale}px;
					border-radius: ${14 * scale}px;
					cursor: pointer;
				}
				.mdl-switch.is-checked .mdl-switch__track {
					background: rgba(63, 81, 181, 0.5);
				}
				.mdl-switch__track fieldset[disabled] .mdl-switch,
				.mdl-switch.is-disabled .mdl-switch__track {
					background: rgba(0, 0, 0, 0.12);
					cursor: auto;
				}

				.mdl-switch__thumb {
					background: rgb(250, 250, 250);
					position: absolute;
					left: 0;
					top: ${2 * scale}px;
					height: ${20 * scale}px;
					width: ${20 * scale}px;
					border-radius: 50%;
					cursor: pointer;
					box-shadow: 0 2px 2px 0 rgba(0, 0, 0, 0.14),
						0 3px 1px -2px rgba(0, 0, 0, 0.2),
						0 1px 5px 0 rgba(0, 0, 0, 0.12);
					transition-duration: 0.28s;
					transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
					transition-property: left;
				}
				.mdl-switch.is-checked .mdl-switch__thumb {
					background: rgb(63, 81, 181);
					left: ${16 * scale}px;
					box-shadow: 0 3px 4px 0 rgba(0, 0, 0, 0.14),
						0 3px 3px -2px rgba(0, 0, 0, 0.2),
						0 1px 8px 0 rgba(0, 0, 0, 0.12);
				}
				.mdl-switch__thumb fieldset[disabled] .mdl-switch,
				.mdl-switch.is-disabled .mdl-switch__thumb {
					background: rgb(189, 189, 189);
					cursor: auto;
				}

				.mdl-switch__focus-helper {
					position: absolute;
					top: 50%;
					left: 50%;
					transform: translate(-4px, -4px);
					display: inline-block;
					box-sizing: border-box;
					width: 8px;
					height: 8px;
					border-radius: 50%;
					background-color: transparent;
				}
				.mdl-switch.is-focused .mdl-switch__focus-helper {
					box-shadow: 0 0 0px 20px rgba(0, 0, 0, 0.1);
					background-color: rgba(0, 0, 0, 0.1);
				}
				.mdl-switch.is-focused.is-checked .mdl-switch__focus-helper {
					box-shadow: 0 0 0px 20px rgba(63, 81, 181, 0.26);
					background-color: rgba(63, 81, 181, 0.26);
				}

				.mdl-switch__label {
					position: relative;
					cursor: pointer;
					font-size: ${16 * scale}px;
					line-height: ${24 * scale}px;
					margin: 0;
					left: ${24 * scale}px;
				}
				.mdl-switch__label fieldset[disabled] .mdl-switch,
				.mdl-switch.is-disabled .mdl-switch__label {
					color: rgb(189, 189, 189);
					cursor: auto;
				}

				.mdl-switch__ripple-container {
					position: absolute;
					z-index: 2;
					top: -12px;
					left: -14px;
					box-sizing: border-box;
					width: ${48 * scale}px;
					height: ${48 * scale}px;
					border-radius: 50%;
					cursor: pointer;
					overflow: hidden;
					mask-image: radial-gradient(circle, white, black);
					-webkit-mask-image: -webkit-radial-gradient(
						circle,
						white,
						black
					);
					transition-duration: 0.4s;
					transition-timing-function: step-end;
					transition-property: left;
				}
				.mdl-switch__ripple-container .mdl-ripple {
					background: rgb(63, 81, 181);
				}
				.mdl-switch__ripple-container fieldset[disabled] .mdl-switch,
				.mdl-switch.is-disabled .mdl-switch__ripple-container {
					cursor: auto;
				}
				fieldset[disabled]
					.mdl-switch
					.mdl-switch__ripple-container
					.mdl-ripple,
				.mdl-switch.is-disabled
					.mdl-switch__ripple-container
					.mdl-ripple {
					background: transparent;
				}
				.mdl-switch.is-checked .mdl-switch__ripple-container {
					left: 2px;
				}
			</style>
		`;
	},
	CHANGE_TYPE.PROP,
	render
);
