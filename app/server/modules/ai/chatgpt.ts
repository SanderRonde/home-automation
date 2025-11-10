import type {
	ChatCompletionMessageParam,
	ChatCompletionTool,
} from 'openai/resources/chat/completions';
import { logTag } from '../../lib/logging/logger';
import { registerTools } from './tools';
import OpenAI from 'openai';

// Configuration
const DEFAULT_MODEL = 'gpt-4o-mini'; // Can be easily changed to gpt-4o-mini or other models

export class ChatGPTService {
	private _client: OpenAI | null = null;
	private _tools: {
		name: string;
		tool: ChatCompletionTool;
		implementation: (...args: unknown[]) => Promise<string>;
	}[] = [];
	private _chats: Record<string, ChatCompletionMessageParam[]> = {};

	public constructor(config: unknown) {
		registerTools(this, config as any);
	}

	private initializeClient(apiKey: string): void {
		if (!this._client) {
			this._client = new OpenAI({
				apiKey,
			});
			logTag('AI', 'cyan', 'ChatGPT client initialized');
		}
	}

	public registerTool(
		name: string,
		tool: ChatCompletionTool,
		implementation: (...args: unknown[]) => Promise<string>
	): void {
		this._tools.push({
			name,
			tool,
			implementation,
		});
	}

	private async executeFunctionCall(
		functionName: string,
		functionArgs: unknown
	): Promise<string> {
		logTag('AI', 'cyan', `Executing function: ${functionName}`);

		for (const tool of this._tools) {
			if (tool.name === functionName) {
				return await tool.implementation(functionArgs);
			}
		}
		return JSON.stringify({ error: `Unknown function: ${functionName}` });
	}

	// TODO:(sander) remember tool calls across messages
	public async *streamChat(
		chatId: string,
		message: string,
		apiKey: string
	): AsyncGenerator<string, void, undefined> {
		this.initializeClient(apiKey);

		if (!this._client) {
			yield JSON.stringify({ error: 'Failed to initialize OpenAI client' });
			return;
		}

		try {
			// Get available tools
			const tools: ChatCompletionTool[] = this._tools.map((tool) => tool.tool);

			// Convert messages to OpenAI format
			const systemMessage: ChatCompletionMessageParam = {
				role: 'system',
				content:
					'You are a helpful AI assistant that can control a home automation system. ' +
					'You have access to functions that can interact with smart devices. ' +
					'When users ask about their devices or want to control them, use the available functions.' +
					"Never ever use a property or method name that you don't know certain exists. If you are not sure " +
					'look up the properties/methods for a given cluster to be sure. If you are told via an error that a property ' +
					'does not exist, then look it up and try again.',
			};
			const openaiMessages: ChatCompletionMessageParam[] = [
				...(this._chats[chatId] ?? []),
				{
					role: 'user',
					content: message,
				},
			];

			let continueLoop = true;
			this._chats[chatId] = [...openaiMessages];

			while (continueLoop) {
				continueLoop = false;

				const stream = await this._client.chat.completions.create({
					model: DEFAULT_MODEL,
					messages: [systemMessage, ...this._chats[chatId]],
					tools,
					stream: true,
				});

				let hadToolCalls = false;
				let toolCalls: Record<
					string,
					{
						functionName: string;
						functionArgs: string;
					}
				> = {};

				let allContent = '';
				for await (const chunk of stream) {
					const delta = chunk.choices[0]?.delta;

					if (delta?.tool_calls) {
						for (const toolCall of delta.tool_calls) {
							hadToolCalls = true;
							toolCalls[toolCall.index] ??= {
								functionName: '',
								functionArgs: '',
							};

							if (toolCall.function?.name) {
								toolCalls[toolCall.index].functionName = toolCall.function.name;
							}
							if (toolCall.function?.arguments) {
								toolCalls[toolCall.index].functionArgs +=
									toolCall.function.arguments;
							}
						}
					} else if (delta?.content) {
						// Stream the content back
						allContent += delta.content;
						yield delta.content;
					}

					// Check if we're done
					if (
						chunk.choices[0]?.finish_reason === 'tool_calls' &&
						Object.values(toolCalls).length
					) {
						await Promise.all(
							Object.keys(toolCalls).map(async (index) => {
								// Execute the function calls in parallel
								logTag(
									'AI',
									'cyan',
									`Function call: ${toolCalls[index].functionName} with args: ${toolCalls[index].functionArgs}`
								);

								const result = await this.executeFunctionCall(
									toolCalls[index].functionName,
									JSON.parse(toolCalls[index].functionArgs || '{}')
								);

								// Add the assistant's function call and the function result to messages
								this._chats[chatId].push({
									role: 'assistant',
									content: null,
									tool_calls: [
										{
											id: `call_${Date.now()}`,
											type: 'function',
											function: {
												name: toolCalls[index].functionName,
												arguments: toolCalls[index].functionArgs,
											},
										},
									],
								});

								this._chats[chatId].push({
									role: 'tool',
									tool_call_id: `call_${Date.now()}`,
									content: result,
								});
							})
						);

						// Continue the loop to get the final response
						continueLoop = true;
						toolCalls = {};
						break;
					}
				}

				if (allContent) {
					this._chats[chatId].push({
						role: 'assistant',
						content: allContent,
					});
				}

				// If no tool calls, we're done
				if (!hadToolCalls) {
					continueLoop = false;
				}
			}
		} catch (error) {
			logTag('AI', 'red', 'Error in streamChat:', error);
			yield JSON.stringify({ error: 'Chat request failed' });
		}
	}
}
