import { TemplateFn, CHANGE_TYPE } from '../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { render } from '../../../../node_modules/lit-html/lit-html.js';
import { AnnotatorInstance } from './annotator-instance.js';

function secsToTime(secs: number): string {
	const mins = Math.floor(secs / 60);
	const remSecs = Math.round(secs % 60);

	const hours = Math.floor(mins / 60);
	const remMins = Math.round(mins % 60);

	if (hours) {
		return `${hours}:${remMins}:${remSecs}`;
	}
	return `${remMins}:${remSecs}`;
}

export const AnnotatorInstanceHTML = new TemplateFn<AnnotatorInstance>(function (html) {
	return html`
		<div id="container" class="flexCol">
			<div id="genre">
				<h3>Genre</h3>
				<div class="flexCol">
					<div id="topLabel">0&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Hard&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;1</div>
					<div class="flexRow">
						<canvas @click=${this.defineGenre} id="genreSelect"></canvas>
						<div id="rightLabel">
							<span> 0</span>
							<br>
							<br>
							<br>
							<span> Uptempo</span>
							<br>
							<br>
							<br>
							<span> 1</span>
						</div>
					</div>
				</div>
			</div>
			<div class="flexCol" id="vidAnnotator">
				<div id="vidContainer">
					<div id="vidDiv">
						${this.props.filename == null || this.props.filename == 'null' ? '' : html`
							<audio id="vid" controls src="${location.origin}/${this.props.filename}"></audio>
						`}
					</div>
				</div>
				<div id="timelineContainer" class="flexRow">
					<div id="timelinePaddingLeft"></div>
					<div id="timeline" class="flexCol">
						<div class="timelineFill"></div>
						<canvas width="1000" id="beats"></canvas>
						<canvas width="1000" id="melodies"></canvas>
						<canvas width="1000" id="times"></canvas>
						<div id="timeLabels" class="flexRow">${this.props.length && new Array(11).fill(0).map((_, index) => {
							const seconds = (this.props.length! / 10) * index;
							return html`
								<div class="timeLabel">
									<div class="labelEl"></div>
									<div class="labelText">${secsToTime(seconds)}</div>
								</div>
							`;
						}) || ''}</div>
						<div class="timelineFill"></div>
					</div>
					<div id="timelinePaddingRight"></div>
				</div>
			</div>
			<div id="buttons" class="flexRow">
				<button @click=${this.seekLeft} class="button">(left) <<</button>
				<button @click=${this.markBeat} class="button">Beat (Space)</button>
				<button @mousedown=${this.melodyStart} @mouseup=${this.melodyEnd} class="button">Melody (M)</button>
				<button @click=${this.seekRight} class="button">>> (right)</button>
				<button @click=${this.prepDownload} class="button">Prep Download (d)</button>
				<button @click=${this.clearLast} class="button">Clear last (c)</button>
				<a id="download" class="button">Download</a>
			</div>
		</div>
	`
}, CHANGE_TYPE.PROP, render);
