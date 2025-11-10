import {
	Box,
	Card,
	CardContent,
	Typography,
	TextField,
	IconButton,
	Paper,
	CircularProgress,
	Alert,
} from '@mui/material';
import React, { useState, useRef, useEffect } from 'react';
import SendIcon from '@mui/icons-material/Send';
import MicIcon from '@mui/icons-material/Mic';
import 'highlight.js/styles/github-dark.css';

// Type for markdown plugins
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PluggableList = any[];

interface Message {
	role: 'user' | 'assistant';
	content: string;
}

interface ChatProps {
	hasApiKey: boolean;
}

export const Chat = (props: ChatProps): JSX.Element => {
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState<string>('');
	const [isStreaming, setIsStreaming] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);
	const [ReactMarkdown, setReactMarkdown] = useState<React.ComponentType<{
		children: string;
		remarkPlugins?: PluggableList;
		rehypePlugins?: PluggableList;
	}> | null>(null);
	const [remarkPlugins, setRemarkPlugins] = useState<PluggableList>([]);
	const [rehypePlugins, setRehypePlugins] = useState<PluggableList>([]);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const [chatId, setChatId] = useState<string | undefined>(undefined);

	// Load markdown dependencies dynamically
	useEffect(() => {
		const loadMarkdown = async () => {
			const [
				{ default: ReactMarkdownComponent },
				{ default: remarkGfm },
				{ default: rehypeHighlight },
			] = await Promise.all([
				import('react-markdown'),
				import('remark-gfm'),
				import('rehype-highlight'),
			]);
			setReactMarkdown(() => ReactMarkdownComponent);
			setRemarkPlugins([remarkGfm]);
			setRehypePlugins([rehypeHighlight]);
		};
		void loadMarkdown();
	}, []);

	// Auto-scroll to bottom when messages change
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [messages]);

	// Keep input focused after streaming completes
	useEffect(() => {
		if (!isStreaming) {
			// Use setTimeout to ensure the focus happens after any other DOM updates
			setTimeout(() => {
				inputRef.current?.focus();
			}, 0);
		}
	}, [isStreaming]);

	const sendMessage = async () => {
		if (!input.trim() || isStreaming) {
			return;
		}

		const userMessage: Message = {
			role: 'user',
			content: input.trim(),
		};

		setMessages((prev) => [...prev, userMessage]);
		setInput('');
		setIsStreaming(true);
		setError(null);

		try {
			// Call the /ai/chat endpoint with SSE
			// eslint-disable-next-line no-restricted-globals
			const response = await fetch('/ai/chat', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					message: userMessage.content,
					chatId: chatId,
				}),
			});

			if (!response.ok) {
				throw new Error('Failed to send message');
			}

			if (!response.body) {
				throw new Error('No response body');
			}

			// Read the stream
			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let assistantMessage = '';

			// Add empty assistant message that we'll update
			setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

			// eslint-disable-next-line no-constant-condition
			while (true) {
				const { done, value } = await reader.read();

				if (done) {
					break;
				}

				const chunk = decoder.decode(value);
				const lines = chunk.split('\n');

				for (const line of lines) {
					if (line.startsWith('data: ')) {
						const data = line.slice(6);

						if (data === '[DONE]') {
							break;
						}

						try {
							const parsed = JSON.parse(data) as
								| {
										error: string;
								  }
								| {
										content: string;
								  }
								| {
										chatId: string;
								  };

							if ('error' in parsed && parsed.error) {
								setError(parsed.error);
								break;
							}

							if ('content' in parsed && parsed.content) {
								assistantMessage += parsed.content;
								// Update the last message (assistant's message)
								setMessages((prev) => {
									const newMessages = [...prev];
									if (newMessages.length > 0) {
										newMessages[newMessages.length - 1] = {
											role: 'assistant',
											content: assistantMessage,
										};
									}
									return newMessages;
								});
							}

							if ('chatId' in parsed && parsed.chatId) {
								setChatId(parsed.chatId);
							}
						} catch (e) {
							console.error('Failed to parse SSE data:', e);
						}
					}
				}
			}
		} catch (err) {
			console.error('Chat error:', err);
			setError('Failed to send message. Please try again.');
			// Remove the empty assistant message if there was an error
			setMessages((prev) => {
				if (
					prev.length > 0 &&
					prev[prev.length - 1].role === 'assistant' &&
					!prev[prev.length - 1].content
				) {
					return prev.slice(0, -1);
				}
				return prev;
			});
		} finally {
			setIsStreaming(false);
		}
	};

	const handleKeyPress = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			void sendMessage();
		}
	};

	if (!props.hasApiKey) {
		return (
			<Card>
				<CardContent>
					<Alert severity="warning">
						Please configure your OpenAI API key above to use the chat interface.
					</Alert>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardContent>
				<Typography variant="h6" gutterBottom>
					AI Chat
				</Typography>

				{error && (
					<Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
						{error}
					</Alert>
				)}

				{/* Messages container */}
				<Box
					sx={{
						height: '500px',
						overflowY: 'auto',
						mb: 2,
						p: 2,
						backgroundColor: 'background.default',
						borderRadius: 1,
					}}
				>
					{messages.length === 0 && (
						<Box
							sx={{
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								height: '100%',
								color: 'text.secondary',
							}}
						>
							<Typography variant="body2">
								Start a conversation with your AI assistant...
							</Typography>
						</Box>
					)}

					{messages.map((message, index) => (
						<Paper
							key={index}
							elevation={1}
							sx={{
								p: 2,
								mb: 2,
								backgroundColor:
									message.role === 'user' ? 'primary.light' : 'background.paper',
								marginLeft: message.role === 'user' ? 'auto' : 0,
								marginRight: message.role === 'assistant' ? 'auto' : 0,
								maxWidth: '80%',
							}}
						>
							<Typography
								variant="subtitle2"
								sx={{ fontWeight: 'bold', mb: 0.5, color: 'text.secondary' }}
							>
								{message.role === 'user' ? 'You' : 'AI Assistant'}
							</Typography>
							{message.role === 'assistant' && ReactMarkdown ? (
								<Box
									sx={{
										'& p': { mt: 0, mb: 1 },
										'& p:last-child': { mb: 0 },
										'& pre': {
											backgroundColor: '#1e1e1e',
											padding: '12px',
											borderRadius: '4px',
											overflow: 'auto',
										},
										'& code': {
											fontFamily: 'monospace',
											fontSize: '0.9em',
										},
										'& pre code': {
											backgroundColor: 'transparent',
											padding: 0,
										},
										'& ul, & ol': { mt: 0, mb: 1, pl: 3 },
										'& li': { mb: 0.5 },
										'& h1, & h2, & h3, & h4, & h5, & h6': {
											mt: 2,
											mb: 1,
										},
										'& h1:first-of-type, & h2:first-of-type, & h3:first-of-type':
											{
												mt: 0,
											},
										'& blockquote': {
											borderLeft: '4px solid',
											borderColor: 'divider',
											pl: 2,
											ml: 0,
											fontStyle: 'italic',
										},
									}}
								>
									<ReactMarkdown
										remarkPlugins={remarkPlugins}
										rehypePlugins={rehypePlugins}
									>
										{message.content}
									</ReactMarkdown>
								</Box>
							) : (
								<Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
									{message.content}
								</Typography>
							)}
						</Paper>
					))}

					{isStreaming &&
						messages.length > 0 &&
						messages[messages.length - 1].role === 'assistant' &&
						!messages[messages.length - 1].content && (
							<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 2 }}>
								<CircularProgress size={16} />
								<Typography variant="body2" color="text.secondary">
									AI is thinking...
								</Typography>
							</Box>
						)}

					<div ref={messagesEndRef} />
				</Box>

				{/* Input area */}
				<Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
					<TextField
						fullWidth
						multiline
						maxRows={4}
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyPress={handleKeyPress}
						placeholder="Type your message... (Shift+Enter for new line)"
						disabled={isStreaming}
						variant="outlined"
						autoFocus
						inputRef={inputRef}
					/>
					<IconButton
						color="primary"
						onClick={() => void sendMessage()}
						disabled={!input.trim() || isStreaming}
						sx={{ mb: 0.5 }}
					>
						<SendIcon />
					</IconButton>
					{/* Placeholder for future voice mode */}
					<IconButton
						color="secondary"
						disabled
						sx={{ mb: 0.5 }}
						title="Voice mode (coming soon)"
					>
						<MicIcon />
					</IconButton>
				</Box>

				<Typography
					variant="caption"
					color="text.secondary"
					sx={{ mt: 1, display: 'block' }}
				>
					The AI can control your smart devices. Try asking about your devices or
					requesting actions.
				</Typography>
			</CardContent>
		</Card>
	);
};
