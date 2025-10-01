import type { BrandedResponse } from './routes';
import { staticResponse } from './routes';
import * as path from 'path';
import { glob } from 'glob';

export async function serveStatic(
	dir: string,
	prefix?: string
): Promise<Record<string, BrandedResponse<unknown, false>>> {
	const files = await glob(
		`${dir}/**/*.{html,js,css,ico,png,jpg,jpeg,gif,svg,webp,woff,woff2,ttf,eot,otf,ico,webmanifest}`,
		{
			nodir: true,
		}
	);
	const routes: Record<string, BrandedResponse<unknown, false>> = {};
	for (const file of files) {
		let relativePath = path.relative(dir, file);
		if (prefix) {
			relativePath = path.join(prefix, relativePath);
		}
		routes[`/${relativePath}`] = staticResponse(new Response(Bun.file(file)));
	}
	return routes;
}
