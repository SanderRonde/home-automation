import { TemplateFn, CHANGE_TYPE } from '../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { AnnotatorInstance } from './annotator-instance.js';
import { render } from '../../../../node_modules/lit-html/lit-html.js';

export const AnnotatorInstanceCSS = new TemplateFn<AnnotatorInstance>(function (html) {
	return html`<style>
		.flexCol {
			display: flex;
			flex-direction: column;
		}

		.flexRow {
			display: flex;
			flex-direction: row;
		}

		#genreSelect {
			width: 150px;
			height: 150px;
			border: 2px solid black;
			cursor: pointer;
		}

		#vidDiv {
			height: 54px;
			width: 100vw;
			display: flex;
			flex-direction: row;
			justify-content: center;
		}

		#genre {
			margin-left: 10px;
		}

		#vid {
			width: 100vw;
		}

		#container {
			height: calc(100vh - 23px);
    		justify-content: space-between;
		}

		#buttons {
			justify-content: center;
			background-color: #4d4d4d;
    		padding-top: 6px;
		}

		.button {
			font-size: 150%;
			-webkit-appearance: none;
			padding: 8px 15px;
			outline: none;
			background-color: #2196F3;
			color: white;
			border: none;
			cursor: pointer;
			margin-bottom: 5px;
			border-radius: 20px;
			margin-left: 1px;
			margin-right: 1px;
		}

		.button:active, .button.active {
			background-color: #F44336;
		}

		#timeline {
			background-color: #686868;
			width: 100%;
		}

		#timelinePaddingLeft {
			width: 153px;
		}

		#timelinePaddingRight {
			width: 110px;
		}

		#beats, #melodies {
			height: 50px;
		}

		#times {
			height: 10px;
		}

		#timeLabels {
			justify-content: space-between
		}

		.timeLabel {
			color: white;
		}

		.timelineFill {
			height: 5px;
		}

	</style>`
}, CHANGE_TYPE.THEME, render);
