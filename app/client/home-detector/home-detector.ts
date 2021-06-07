import {
	TemplateResult,
	PropertyCommitter,
	EventPart,
	BooleanAttributePart,
	AttributeCommitter,
	NodePart,
	isDirective,
	noChange,
	directive,
} from '../../../node_modules/lit-html/lit-html.js';
import { HomeDetectorDisplay } from './components/home-detector-display/home-detector-display.js';
import { WebComponent } from '../../../node_modules/wc-lib/build/es/wc-lib.js';

function registerElements() {
	WebComponent.initComplexTemplateProvider({
		TemplateResult,
		PropertyCommitter,
		EventPart,
		BooleanAttributePart,
		AttributeCommitter,
		NodePart,
		isDirective,
		noChange,
		directive,
	});

	HomeDetectorDisplay.define();
}

async function registerServiceworker() {
	if ('serviceWorker' in navigator) {
		await navigator.serviceWorker.register(
			'/home-detector/serviceworker.js',
			{
				scope: '/home-detector/',
				updateViaCache: 'none',
			}
		);
	}
}

registerElements();
void registerServiceworker();
