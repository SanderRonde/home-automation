import { createServeOptions, staticResponse, withRequestBody } from '../../lib/routes';
import type { ServeOptions } from '../../lib/routes';
import type { Database } from '../../lib/db';
import { ChatGPTService } from './chatgpt';
import type { ModuleConfig } from '..';
import type { AIDB } from './index';
import * as z from 'zod';

let chatGPTService: ChatGPTService | null = null;

function _initRouting(config: ModuleConfig) {
	// Initialize ChatGPT service
	chatGPTService = new ChatGPTService(config.modules);

	return createServeOptions(
		{
			'/api-key': {
				GET: (_req, _server, { json }) => {
					const db = config.db as Database<AIDB>;
					const hasKey = !!db.current().chatgptApiKey;
					return json({ hasKey });
				},
				DELETE: (_req, _server, { json }) => {
					const db = config.db as Database<AIDB>;
					db.update((old) => ({
						...old,
						chatgptApiKey: undefined,
					}));

					return json({ success: true });
				},
			},
			'/api-key/set': withRequestBody(
				z.object({ apiKey: z.string().min(1) }),
				(body, _req, _server, { json }) => {
					const db = config.db as Database<AIDB>;
					db.update((old) => ({
						...old,
						chatgptApiKey: body.apiKey,
					}));

					return json({ success: true });
				}
			),
			'/chat': withRequestBody(
				z.object({
					chatId: z.string().optional(),
					message: z.string(),
				}),
				(body, _req, _server, { error }) => {
					const db = config.db as Database<AIDB>;
					const apiKey = db.current().chatgptApiKey;

					if (!apiKey) {
						return error('OpenAI API key not configured', 400);
					}

					if (!chatGPTService) {
						return error('ChatGPT service not initialized', 500);
					}

					const chatId = body.chatId ?? Date.now().toString();

					// Create a ReadableStream for Server-Sent Events
					const stream = new ReadableStream({
						async start(controller) {
							const encoder = new TextEncoder();

							controller.enqueue(
								encoder.encode(`data: ${JSON.stringify({ chatId: chatId })}\n\n`)
							);

							try {
								for await (const chunk of chatGPTService!.streamChat(
									chatId,
									body.message,
									apiKey
								)) {
									// Send as Server-Sent Event
									controller.enqueue(
										encoder.encode(
											`data: ${JSON.stringify({ content: chunk })}\n\n`
										)
									);
								}

								// Send done event
								controller.enqueue(encoder.encode('data: [DONE]\n\n'));
							} catch (streamError) {
								console.error('Streaming error:', streamError);
								controller.enqueue(
									encoder.encode(
										`data: ${JSON.stringify({ error: 'Streaming failed' })}\n\n`
									)
								);
							} finally {
								controller.close();
							}
						},
					});

					return staticResponse(
						new Response(stream, {
							headers: {
								'Content-Type': 'text/event-stream',
								'Cache-Control': 'no-cache',
								Connection: 'keep-alive',
							},
						})
					);
				}
			),
		},
		{
			'/mcp': false,
			'/api-key': true,
			'/api-key/set': false,
			'/chat': false,
		}
	);
}

export const initRouting = _initRouting as (config: unknown) => ServeOptions<unknown>;

export type AIRoutes = ReturnType<typeof _initRouting> extends ServeOptions<infer R> ? R : never;
