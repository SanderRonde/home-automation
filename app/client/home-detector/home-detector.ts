import { 
	TemplateResult, PropertyCommitter, EventPart, 
	BooleanAttributePart, AttributeCommitter, 
	NodePart, isDirective, noChange 
} from "../../../node_modules/lit-html/lit-html.js";
import { HomeDetectorDisplay } from "./components/home-detector-display/home-detector-display.js";
import { WebComponent } from '../../../node_modules/wc-lib/build/es/wc-lib.js';

function registerElements() {
	WebComponent.initComplexTemplateProvider({
		TemplateResult, PropertyCommitter, EventPart, BooleanAttributePart,
		AttributeCommitter, NodePart, isDirective, noChange
	});

	HomeDetectorDisplay.define();
}

registerElements();