import reactCompiler from 'babel-plugin-react-compiler';
import { transformSync } from '@babel/core';
import type { BunPlugin } from 'bun';

/**
 * Bun plugin wrapper for React Compiler (babel-plugin-react-compiler)
 * This plugin applies React Compiler optimizations to React components during build.
 */
export const reactCompilerPlugin: BunPlugin = {
	name: 'react-compiler',
	setup(build) {
		build.onLoad({ filter: /\.(tsx|jsx)$/ }, async (args) => {
			const file = Bun.file(args.path);
			const contents = await file.text();

			// Only process files that contain React code
			// Check for React imports or JSX usage
			const hasReactImport =
				contents.includes('from "react"') ||
				contents.includes("from 'react'") ||
				contents.includes('from "react-dom"') ||
				contents.includes("from 'react-dom'");
			const hasJSX =
				/<[A-Z]/.test(contents) || contents.includes('jsx(') || contents.includes('jsxs(');

			if (!hasReactImport && !hasJSX) {
				// Let Bun handle non-React files normally
				return;
			}

			try {
				const result = transformSync(contents, {
					filename: args.path,
					plugins: [reactCompiler],
					presets: [
						['@babel/preset-typescript', { isTSX: true, allExtensions: true }],
						['@babel/preset-react', { runtime: 'automatic' }],
					],
					sourceMaps: false, // Bun handles source maps
				});

				if (!result?.code) {
					// Fall back to Bun's default processing
					return;
				}

				// Return transformed JavaScript code with React Compiler optimizations
				return {
					contents: result.code,
					loader: 'js',
				};
			} catch (error) {
				console.error(`React Compiler error in ${args.path}:`, error);
				// Return undefined to let Bun handle it normally if compilation fails
				return;
			}
		});
	},
};
