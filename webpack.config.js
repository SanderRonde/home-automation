const webpack = require('webpack');
const path = require('path');

const ENTRYPOINTS = [
	'home-detector',
	'keyval',
	'rgb'
];

module.exports = ENTRYPOINTS.map((entrypoint) => {
	return {
		entry: path.join(
			__dirname, 'app/client',
			entrypoint, `${entrypoint}.js`),
		output: {
			path: path.join(__dirname, 
				'app/client/', entrypoint),
			filename: `${entrypoint}.bundle.js`
		},
		mode: 'production'
	}
});