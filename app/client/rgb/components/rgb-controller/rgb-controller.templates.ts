import { CHANGE_TYPE, TemplateFn } from '../../../../../node_modules/wclib/build/es/wclib.js';
import { render } from '../../../../../node_modules/lit-html/lit-html.js';
import { RGBController } from "./rgb-controller";

export const RGBControllerHTML = new TemplateFn<RGBController>(function (html, props) {
	return html`
		<div id="background">
			<color-display id="display"></color-display>
			<color-controls id="controls"></color-controls>
			<div id="buttons">
				<color-button #parent="${this}" class="button"></color-button>
				${props.patterns.map((pattern) => {
					return html`<pattern-button #parent="${this}" class="pattern button" 
						#pattern="${pattern}"></pattern-button>`;
				})}
			</div>
		</div>
	`;
}, CHANGE_TYPE.PROP, render);

export const RGBControllerCSS = new TemplateFn<RGBController>((html) => {
	return html`
		<style>
			#background {
				width: 100vw;
				max-width: 1000px;
				height: 100vh;
				background-color: rgb(70, 70, 70);
				margin-left: auto;
				margin-right: auto;

				display: flex;
				flex-direction: column;
			}

			#buttons {
				display: grid;
				grid-template-columns: auto auto auto;
				flex-grow: 100;
			}

			.button {
				display: flex;
				flex-direction: column;
			}
		</style>
	`;
}, CHANGE_TYPE.NEVER, render);
