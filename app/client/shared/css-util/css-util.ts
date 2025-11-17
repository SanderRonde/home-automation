function getCalculatedValue(value: string, width: number) {
	if (value.endsWith('px')) {
		return parseFloat(value.slice(0, value.length - 2));
	} else if (value.endsWith('vw') || value.endsWith('vh')) {
		return (parseFloat(value.slice(0, value.length - 2)) * width) / 100;
	} else {
		return parseFloat(value);
	}
}

export function clampWidthSelector(selector: string, width = 1000) {
	return (...configs: [string, string][]): string => {
		return `${selector} {\n${configs
			.map(([property, value]) => {
				return `\t${property}: ${value};`;
			})
			.join(
				'\n'
			)}\n}\n\n@media screen and (min-width: ${width}px) {\n\t${selector} {\n${configs
			.map(([property, value]) => {
				return `\t\t${property}: ${getCalculatedValue(value, width)}; `;
			})
			.join('\n')}\n\t}\n}`;
	};
}
