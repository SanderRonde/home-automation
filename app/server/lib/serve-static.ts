import * as path from 'path';
import { glob } from 'glob';

export async function serveStatic(
	dir: string,
	prefix?: string
): Promise<Record<string, Response>> {
	const files = await glob(`${dir}/**/*`, {
		nodir: true,
	});
	const routes: Record<string, Response> = {};
	for (const file of files) {
		let relativePath = path.relative(dir, file);
		if (prefix) {
			relativePath = path.join(prefix, relativePath);
		}
		routes[`/${relativePath}`] = new Response(Bun.file(file));
	}
	return routes;
}
