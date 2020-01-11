import {
	ComplexType,
	config,
	Props,
	ConfigurableWebComponent,
	PROP_TYPE
} from '../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { AnnotatorInstance } from '../annotator-instance/annotator-instance.js';
import { AnnotatorMainHTML } from './annotator-main.templates.js';

@config({
	is: 'annotator-main',
	html: AnnotatorMainHTML,
	css: null,
	dependencies: [AnnotatorInstance]
})
export class AnnotatorMain extends ConfigurableWebComponent<{
	selectors: {
		IDS: {
			select: HTMLSelectElement;
		};
	};
}> {
	props = Props.define(this, {
		priv: {
			fileNames: {
				type: ComplexType<string[]>(),
				value: []
			}
		},
		reflect: {
			selected: {
				type: PROP_TYPE.NUMBER,
				value: -1
			}
		}
	});

	public prevSong() {
		this.props.selected = Math.max(this.props.selected - 1, 0);
	}

	public nextSong() {
		this.props.selected = Math.min(
			this.props.selected + 1,
			this.props.fileNames.length
		);
	}

	public onSelect() {
		this.props.selected = this.$.select.selectedIndex;
	}

	async firstRender() {
		// Fetch all file names
		this.props.fileNames = (
			await (
				await fetch(`${location.origin}/annotator/files`, {
					method: 'POST'
				})
			).json()
		).files;
	}
}
