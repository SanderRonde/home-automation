import {
	Box,
	Paper,
	Tab,
	Tabs,
	Typography,
	Button,
	Snackbar,
	Alert,
} from '@mui/material';
import type { SwitchConfig } from '../../../server/modules/switch/routing';
import type * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { DevicePicker } from './DevicePicker';
import type { editor } from 'monaco-editor';
import Editor from '@monaco-editor/react';
import React from 'react';

type Monaco = typeof monaco;

const JSON_SCHEMA = {
	type: 'object',
	properties: {
		groups: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					name: {
						type: 'string',
						description: 'Display name for the group',
					},
					icon: {
						type: 'string',
						description: 'Optional emoji icon for the group',
					},
					items: {
						type: 'array',
						items: {
							type: 'object',
							properties: {
								name: {
									type: 'string',
									description: 'Display name for the item',
								},
								icon: {
									type: 'string',
									description:
										'Optional emoji icon for the item',
								},
								deviceIds: {
									type: 'array',
									description: 'Array of device identifiers',
									items: {
										type: 'string',
									},
									minItems: 1,
								},
							},
							required: ['name', 'deviceIds'],
							additionalProperties: false,
						},
					},
				},
				required: ['name', 'items'],
				additionalProperties: false,
			},
		},
	},
	required: ['groups'],
	additionalProperties: false,
};

interface TabPanelProps {
	children?: React.ReactNode;
	index: number;
	value: number;
}

function TabPanel(props: TabPanelProps) {
	return (
		<div
			role="tabpanel"
			hidden={props.value !== props.index}
			id={`tabpanel-${props.index}`}
			style={{ height: '100%' }}
		>
			{props.value === props.index && (
				<Box sx={{ height: '100%' }}>{props.children}</Box>
			)}
		</div>
	);
}

export const SwitchEditor = (): JSX.Element => {
	const [value, setValue] = React.useState(0);
	const [editorContent, setEditorContent] = React.useState('');
	const [originalContent, setOriginalContent] = React.useState('');
	const [isModified, setIsModified] = React.useState(false);
	const [snackbar, setSnackbar] = React.useState<{
		open: boolean;
		message: string;
		severity: 'success' | 'error';
	}>({ open: false, message: '', severity: 'success' });
	const [devicePicker, setDevicePicker] = React.useState<{
		open: boolean;
		currentSelection: string[];
		position: { line: number; column: number } | null;
	}>({ open: false, currentSelection: [], position: null });
	const [editorInstance, setEditorInstance] =
		React.useState<editor.IStandaloneCodeEditor | null>(null);

	const loadConfig = async () => {
		try {
			const response = await fetch('/switch/config/raw', {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
				},
			});

			if (response.ok) {
				const config = await response.json();
				const configJson = JSON.stringify(config, null, 2);
				setEditorContent(configJson);
				setOriginalContent(configJson);
				setIsModified(false);
			} else {
				console.error('Error loading configuration: No config found');
			}
		} catch (error) {
			console.error('Error loading configuration:', error);
		}
	};

	const validateJSON = (
		jsonString: string
	): { valid: boolean; error?: string } => {
		try {
			const parsed = JSON.parse(jsonString) as SwitchConfig;

			// Basic structure validation
			if (!parsed.groups || !Array.isArray(parsed.groups)) {
				return {
					valid: false,
					error: 'Configuration must have a "groups" array',
				};
			}

			for (const group of parsed.groups) {
				if (!group.name || typeof group.name !== 'string') {
					return {
						valid: false,
						error: 'Each group must have a "name" string',
					};
				}

				if (!group.items || !Array.isArray(group.items)) {
					return {
						valid: false,
						error: 'Each group must have an "items" array',
					};
				}

				for (const item of group.items) {
					if (!item.name || typeof item.name !== 'string') {
						return {
							valid: false,
							error: 'Each item must have a "name" string',
						};
					}

					if (
						!item.deviceIds ||
						!Array.isArray(item.deviceIds) ||
						item.deviceIds.length === 0
					) {
						return {
							valid: false,
							error: 'Each item must have a non-empty "deviceIds" array',
						};
					}
				}
			}

			return { valid: true };
		} catch (error) {
			return { valid: false, error: 'Invalid JSON syntax' };
		}
	};

	const handleSave = async () => {
		// Validate JSON before saving
		const validation = validateJSON(editorContent);
		if (!validation.valid) {
			setSnackbar({
				open: true,
				message: `Invalid configuration: ${validation.error}`,
				severity: 'error',
			});
			return;
		}

		try {
			const config = JSON.parse(editorContent);
			const response = await fetch('/switch/config', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(config),
			});

			if (response.ok) {
				setOriginalContent(editorContent);
				setIsModified(false);
				setSnackbar({
					open: true,
					message: 'Configuration saved successfully',
					severity: 'success',
				});
			} else {
				const errorData = await response
					.json()
					.catch(() => ({ error: 'Unknown error' }));
				setSnackbar({
					open: true,
					message: `Failed to save: ${errorData.error || 'Server error'}`,
					severity: 'error',
				});
			}
		} catch (error) {
			setSnackbar({
				open: true,
				message: `Error saving configuration: ${error}`,
				severity: 'error',
			});
		}
	};

	const handleEditorChange = (newValue: string | undefined) => {
		const content = newValue || '';
		setEditorContent(content);
		setIsModified(content !== originalContent);
	};

	const findDeviceIdsAtPosition = (
		content: string,
		line: number
	): {
		deviceIds: string[];
		range: {
			startLineNumber: number;
			startColumn: number;
			endLineNumber: number;
			endColumn: number;
		};
	} | null => {
		const lines = content.split('\n');
		const currentLine = lines[line - 1];

		if (!currentLine) {
			return null;
		}

		// Look for deviceIds array in the current line or nearby lines
		const deviceIdsRegex = /"deviceIds"\s*:\s*\[(.*?)\]/s;

		// Check current line and a few lines around it
		const contextLines = lines
			.slice(Math.max(0, line - 3), Math.min(lines.length, line + 3))
			.join('\n');
		const match = deviceIdsRegex.exec(contextLines);

		if (match) {
			try {
				// Extract the array content and parse it
				const arrayContent = match[1];
				const deviceIds = JSON.parse(`[${arrayContent}]`);

				// Find the exact range of the deviceIds array
				const fullText = lines.join('\n');
				const matchIndex = fullText.indexOf(match[0]);
				const startPos = fullText.substring(0, matchIndex).split('\n');
				const endPos = fullText
					.substring(0, matchIndex + match[0].length)
					.split('\n');

				return {
					deviceIds,
					range: {
						startLineNumber: startPos.length,
						startColumn: startPos[startPos.length - 1].length + 1,
						endLineNumber: endPos.length,
						endColumn: endPos[endPos.length - 1].length + 1,
					},
				};
			} catch (error) {
				console.error('Error parsing deviceIds:', error);
			}
		}

		return null;
	};

	const handleDevicePickerConfirm = (selectedDevices: string[]) => {
		if (!editorInstance || !devicePicker.position) {
			return;
		}

		const content = editorInstance.getValue();
		const deviceIdsInfo = findDeviceIdsAtPosition(
			content,
			devicePicker.position.line
		);

		if (deviceIdsInfo) {
			const newDeviceIdsArray = JSON.stringify(selectedDevices, null, 2);
			const indentMatch = /(\s+)"deviceIds"/.exec(content);
			const indent = indentMatch ? indentMatch[1] : '\t\t\t\t';
			const formattedArray = newDeviceIdsArray
				.split('\n')
				.map((line, index) => (index === 0 ? line : indent + line))
				.join('\n');

			editorInstance.executeEdits('device-picker', [
				{
					range: deviceIdsInfo.range,
					text: `"deviceIds": ${formattedArray}`,
				},
			]);

			// Update the content state
			const newContent = editorInstance.getValue();
			handleEditorChange(newContent);
		}
	};

	const handleEditorDidMount = (
		editor: editor.IStandaloneCodeEditor,
		monaco: Monaco
	) => {
		setEditorInstance(editor);

		// Configure JSON schema for validation and autocomplete
		monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
			validate: true,
			schemas: [
				{
					uri: 'http://switch-config-schema.json',
					fileMatch: ['*'],
					schema: JSON_SCHEMA,
				},
			],
		});

		// Add custom CSS for clickable deviceIds
		const style = document.createElement('style');
		style.textContent = `
			.deviceIds-clickable {
				background-color: rgba(255, 23, 68, 0.1) !important;
				border: 1px solid rgba(255, 23, 68, 0.3) !important;
				border-radius: 3px !important;
				cursor: pointer !important;
				transition: all 0.2s ease !important;
			}
			.deviceIds-clickable:hover {
				background-color: rgba(255, 23, 68, 0.2) !important;
				border-color: rgba(255, 23, 68, 0.5) !important;
				box-shadow: 0 0 8px rgba(255, 23, 68, 0.3) !important;
			}
		`;
		document.head.appendChild(style);

		// Function to highlight deviceIds arrays
		const highlightDeviceIds = () => {
			const model = editor.getModel();
			if (!model) {
				return;
			}

			const content = model.getValue();
			const lines = content.split('\n');
			const decorations: editor.IModelDeltaDecoration[] = [];

			lines.forEach((line, lineIndex) => {
				const deviceIdsMatch = /"deviceIds"\s*:\s*\[/.exec(line);
				if (deviceIdsMatch) {
					// Find the complete array range
					const arrayStart = lineIndex + 1;
					let arrayEnd = lineIndex + 1;
					let bracketCount = 1;
					let currentLine = lineIndex;

					// Find the end of the array
					while (bracketCount > 0 && currentLine < lines.length - 1) {
						currentLine++;
						const nextLine = lines[currentLine];
						for (const char of nextLine) {
							if (char === '[') {
								bracketCount++;
							}
							if (char === ']') {
								bracketCount--;
							}
							if (bracketCount === 0) {
								arrayEnd = currentLine + 1;
								break;
							}
						}
					}

					// Add decoration for the entire deviceIds array
					decorations.push({
						range: new monaco.Range(
							arrayStart,
							1,
							arrayEnd,
							lines[arrayEnd - 1]?.length + 1 || 1
						),
						options: {
							className: 'deviceIds-clickable',
							hoverMessage: {
								value: '🖱️ Click to open Device Picker',
							},
							glyphMarginClassName: 'deviceIds-glyph',
						},
					});
				}
			});

			editor.deltaDecorations([], decorations);
		};

		// Initial highlight
		setTimeout(highlightDeviceIds, 100);

		// Re-highlight on content change
		editor.onDidChangeModelContent(() => {
			setTimeout(highlightDeviceIds, 50);
		});

		// Add click handler for device picker
		editor.onMouseDown((e: editor.IEditorMouseEvent) => {
			const position = e.target.position;
			if (!position) {
				return;
			}

			const content = editor.getValue();
			const deviceIdsInfo = findDeviceIdsAtPosition(
				content,
				position.lineNumber
			);

			if (deviceIdsInfo) {
				// Check if click is within deviceIds array
				const clickLine = position.lineNumber;
				const clickColumn = position.column;
				const range = deviceIdsInfo.range;

				if (
					clickLine >= range.startLineNumber &&
					clickLine <= range.endLineNumber &&
					(clickLine !== range.startLineNumber ||
						clickColumn >= range.startColumn) &&
					(clickLine !== range.endLineNumber ||
						clickColumn <= range.endColumn)
				) {
					setDevicePicker({
						open: true,
						currentSelection: deviceIdsInfo.deviceIds,
						position: { line: clickLine, column: clickColumn },
					});
				}
			}
		});

		// Add context menu for device picker
		editor.addAction({
			id: 'open-device-picker',
			label: 'Open Device Picker',
			contextMenuGroupId: 'modification',
			contextMenuOrder: 1.5,
			run: (ed: editor.IStandaloneCodeEditor) => {
				const position = ed.getPosition();
				if (!position) {
					return;
				}

				const content = ed.getValue();
				const deviceIdsInfo = findDeviceIdsAtPosition(
					content,
					position.lineNumber
				);

				if (deviceIdsInfo) {
					setDevicePicker({
						open: true,
						currentSelection: deviceIdsInfo.deviceIds,
						position: {
							line: position.lineNumber,
							column: position.column,
						},
					});
				}
			},
		});
	};

	// Load config on component mount
	React.useEffect(() => {
		void loadConfig();
	}, []);

	return (
		<Box sx={{ height: 'calc(100vh - 180px)' }}>
			<Box
				sx={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					mb: 3,
				}}
			>
				<Typography
					variant="h4"
					sx={{
						color: 'primary.main',
						fontWeight: 300,
						letterSpacing: '0.2rem',
					}}
				>
					Switch Editor
				</Typography>
				<Button
					variant="contained"
					onClick={handleSave}
					sx={{
						bgcolor: 'primary.main',
						'&:hover': {
							bgcolor: 'primary.dark',
						},
					}}
				>
					Save Configuration
				</Button>
			</Box>
			<Paper
				sx={{
					width: '100%',
					height: '100%',
					bgcolor: 'background.paper',
					borderRadius: 2,
					overflow: 'hidden',
					border: '1px solid rgba(255, 255, 255, 0.05)',
				}}
			>
				<Tabs
					value={value}
					onChange={(_, newValue) => setValue(newValue)}
					sx={{
						borderBottom: 1,
						borderColor: 'divider',
						'& .MuiTab-root': {
							color: 'text.secondary',
							'&.Mui-selected': {
								color: 'primary.light',
							},
						},
						'& .MuiTabs-indicator': {
							backgroundColor: 'primary.light',
						},
					}}
				>
					<Tab label={`Configuration${isModified ? ' *' : ''}`} />
				</Tabs>
				<TabPanel value={value} index={0}>
					<Editor
						height="100%"
						defaultLanguage="json"
						value={editorContent}
						onChange={handleEditorChange}
						theme="vs-dark"
						onMount={handleEditorDidMount}
						options={{
							minimap: { enabled: false },
							fontSize: 14,
							wordWrap: 'on',
							formatOnPaste: true,
							formatOnType: true,
							padding: { top: 16, bottom: 16 },
							suggest: {
								insertMode: 'replace',
							},
						}}
					/>
				</TabPanel>
			</Paper>
			<Snackbar
				open={snackbar.open}
				autoHideDuration={6000}
				onClose={() => setSnackbar({ ...snackbar, open: false })}
				anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
			>
				<Alert
					onClose={() => setSnackbar({ ...snackbar, open: false })}
					severity={snackbar.severity}
					sx={{ width: '100%' }}
				>
					{snackbar.message}
				</Alert>
			</Snackbar>
			<DevicePicker
				open={devicePicker.open}
				onClose={() =>
					setDevicePicker({ ...devicePicker, open: false })
				}
				onConfirm={handleDevicePickerConfirm}
				currentSelection={devicePicker.currentSelection}
				title="Select Device IDs"
			/>
		</Box>
	);
};
