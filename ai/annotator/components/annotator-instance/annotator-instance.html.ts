import {
	TemplateFn,
	CHANGE_TYPE,
} from '../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { render } from '../../../../node_modules/lit-html/lit-html.js';
import { AnnotatorInstance } from './annotator-instance.js';

const MAX_LEN = 600;

export const AnnotatorInstanceHTML = new TemplateFn<AnnotatorInstance>(
	function (html) {
		return html`
			<div id="container" class="flexCol">
				<div id="genre">
					<h3>Genre</h3>
					<div class="flexCol">
						<div id="topLabel">
							0&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Hard&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;1
						</div>
						<div class="flexRow">
							<canvas
								@click=${this.defineGenre}
								id="genreSelect"
							></canvas>
							<div id="rightLabel">
								<span> 0</span>
								<br />
								<br />
								<br />
								<span> Uptempo</span>
								<br />
								<br />
								<br />
								<span> 1</span>
							</div>
						</div>
					</div>
				</div>
				<div class="flexCol" id="vidAnnotator">
					<div id="zoomedTimelineContainer" class="flexRow">
						<div id="zoomedTimeline" class="flexCol">
							<canvas
								style="width: calc((100vw * ${this.props
									.length / 10}) - 20px)"
								width="${100 *
								Math.min(this.props.length, MAX_LEN)}"
								height="60"
								id="zoomedTime"
							></canvas>
							<canvas
								style="width: calc((100vw * ${this.props
									.length / 10}) - 20px)"
								width="${100 *
								Math.min(this.props.length, MAX_LEN)}"
								id="zoomedBeats"
							></canvas>
							<canvas
								style="width: calc((100vw * ${this.props
									.length / 10}) - 20px)"
								width="${100 *
								Math.min(this.props.length, MAX_LEN)}"
								id="zoomedMelodies"
							></canvas>
							<canvas
								style="width: calc((100vw * ${this.props
									.length / 10}) - 20px)"
								width="${100 *
								Math.min(this.props.length, MAX_LEN)}"
								id="zoomedTimes"
							></canvas>
							<canvas
								style="width: calc((100vw * ${this.props
									.length / 10}) - 20px)"
								width="${100 *
								Math.min(this.props.length, MAX_LEN)}"
								height="20"
								id="zoomedText"
							></canvas>
							<div class="timelineFill"></div>
						</div>
					</div>
					<div class="flexRow">
						<div id="timeline" class="flexCol">
							<canvas width="1000" height="60" id="time"></canvas>
							<canvas width="1000" id="beats"></canvas>
							<canvas width="1000" id="melodies"></canvas>
							<canvas width="1000" id="times"></canvas>
							<canvas width="1000" height="20" id="text"></canvas>
							<div class="timelineFill"></div>
						</div>
					</div>
					<div id="vidContainer">
						<div id="vidDiv">
							${this.props.filename == null ||
							this.props.filename == 'null'
								? ''
								: html`
										<audio
											id="vid"
											controls
											src="${location.origin}/${this.props
												.filename}"
										></audio>
									`}
						</div>
					</div>
				</div>
				<div id="buttons" class="flexRow">
					<div class="button">
						<label for="markMode">Melody Mode</label>
						<input type="checkbox" id="markMode" />
					</div>
					<button id="left" @click=${this.seekLeft} class="button">
						(left) <<
					</button>
					<button id="beat" @click=${this.markBeat} class="button">
						Mark (Space)
					</button>
					<button id="right" @click=${this.seekRight} class="button">
						>> (right)
					</button>
					<button
						id="pauseplay"
						@click=${this.pausePlay}
						class="button"
					>
						pause/play (p)
					</button>
					<button
						id="prepDownload"
						@click=${this.prepDownload}
						class="button"
					>
						Prep Download (d)
					</button>
					<button
						id="clearBeat"
						@click=${this.clearLast}
						class="button"
					>
						Clear last 10s (c)
					</button>
					<button id="undo" @click=${this.undo} class="button">
						Undo last (u)
					</button>
					<a id="download" class="button">Download</a>
				</div>
			</div>
		`;
	},
	CHANGE_TYPE.PROP,
	render
);
