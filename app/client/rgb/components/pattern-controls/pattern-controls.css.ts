import { TemplateFn, CHANGE_TYPE } from '../../../../../node_modules/wclib/build/es/wclib.js';
import { render } from '../../../../../node_modules/lit-html/lit-html.js';
import { PatternControls } from './pattern-controls.js';

export const PatternControlsCSS = new TemplateFn<PatternControls>(function (html) {
	return html`<style>
		#container {
			display: flex;
			flex-direction: row;
			justify-content: center;
			margin-left: auto;
			margin-right: auto;
			width: 100%;
		}

		#sliderContainer {
			flex-grow: 100;
			padding: 0 10px;
			background-color: white;
		}

		input[type=range] {
			height: 33px;
			-webkit-appearance: none;
			margin: 0;
			width: 100%;
		}
		input[type=range]:focus {
			outline: none;
		}
		input[type=range]::-webkit-slider-runnable-track {
			width: 100%;
			height: 10px;
			cursor: pointer;
			box-shadow: 1px 1px 1px #000000;
			border-radius: 20px;
			border: 1px solid #000000;
		}
		input[type=range]::-webkit-slider-thumb {
			box-shadow: 0px 0px 0px #000000;
			border: 2px solid #000000;
			height: 25px;
			width: 25px;
			border-radius: 12px;
			background: #FFFFFF;
			cursor: pointer;
			-webkit-appearance: none;
			margin-top: -9px;
		}
		input[type=range]::-moz-range-track {
			width: 100%;
			height: 10px;
			cursor: pointer;
			box-shadow: 1px 1px 1px #000000;
			background: #3071A9;
			border-radius: 5px;
			border: 1px solid #000000;
		}
		input[type=range]::-moz-range-thumb {
			box-shadow: 0px 0px 0px #000000;
			border: 2px solid #000000;
			height: 25px;
			width: 25px;
			border-radius: 12px;
			background: #FFFFFF;
			cursor: pointer;
		}
		input[type=range]::-ms-track {
			width: 100%;
			height: 10px;
			cursor: pointer;
			background: transparent;
			border-color: transparent;
			color: transparent;
		}
		input[type=range]::-ms-fill-lower {
			background: #3071A9;
			border: 1px solid #000000;
			border-radius: 10px;
			box-shadow: 1px 1px 1px #000000;
		}
		input[type=range]::-ms-fill-upper {
			background: #3071A9;
			border: 1px solid #000000;
			border-radius: 10px;
			box-shadow: 1px 1px 1px #000000;
		}
		input[type=range]::-ms-thumb {
			margin-top: 1px;
			box-shadow: 0px 0px 0px #000000;
			border: 2px solid #000000;
			height: 25px;
			width: 25px;
			border-radius: 12px;
			background: #FFFFFF;
			cursor: pointer;
		}
		input[type=range]:focus::-ms-fill-lower {
			background: #3071A9;
		}
		input[type=range]:focus::-ms-fill-upper {
			background: #3071A9;
		}

		input[type=range]::-webkit-slider-runnable-track {
			height: 8.4px;
			cursor: pointer;
			box-shadow: 1px 1px 1px #000000, 0px 0px 1px #0d0d0d;
			background: rgb(0, 136, 253);
			border-radius: 15px;
			border: 0.2px solid #010101;
		}
	</style>`
}, CHANGE_TYPE.THEME, render);