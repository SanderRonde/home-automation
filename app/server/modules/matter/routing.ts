import { createServeOptions } from '../../lib/routes';
import type { ServeOptions } from '../../lib/routes';
import type { ModuleConfig } from '..';

export type MatterRoutes = {
	'/nodes': {
		GET: (
			req: unknown,
			server: unknown,
			ctx: {
				json: (v: {
					nodes: { nodeId: string; name: string; clusters: string[] }[];
				}) => unknown;
				error: (msg: string, code: number) => unknown;
			}
		) => Promise<unknown>;
	};
	'/nodes/:nodeId': {
		DELETE: (
			req: { params: { nodeId: string } },
			server: unknown,
			ctx: {
				json: (v: { success: boolean }) => unknown;
				error: (msg: string, code: number) => unknown;
			}
		) => Promise<unknown>;
	};
};

function _initRouting(config: ModuleConfig): ServeOptions<MatterRoutes> {
	return createServeOptions(
		{
			'/nodes': {
				GET: async (_req, _server, { json, error }) => {
					try {
						const matterServer = await config.modules.matter.server.value;
						const nodes = await matterServer.getCommissionedNodesInfo();
						return json({ nodes });
					} catch (err) {
						const message = err instanceof Error ? err.message : String(err);
						return error(message, 500);
					}
				},
			},
			'/nodes/:nodeId': {
				DELETE: async (req, _server, { json, error }) => {
					const { nodeId } = req.params;
					try {
						const matterServer = await config.modules.matter.server.value;
						await matterServer.removeNode(nodeId);
						return json({ success: true });
					} catch (err) {
						const message = err instanceof Error ? err.message : String(err);
						if (message === 'Node not found') {
							return error(message, 404);
						}
						return error(message, 500);
					}
				},
			},
		},
		true
	);
}

export const initRouting = _initRouting;
