import React, { useEffect, useState } from 'react';
import { isValSame } from '../lib/util';
import { Switch } from 'antd';

interface JSONSwitchesProps {
	initialJson: Record<string, unknown>;
	key: string;
}

const DELIMITER = ' > ';

export const JSONSwitches: React.FC<JSONSwitchesProps> = (props) => {
	const [json, setJson] = useState<Record<string, unknown>>(
		props.initialJson
	);

	const sendValChange = async (key: string, value: string) => {
		try {
			const response = await fetch(
				`${location.origin}/keyval/${key}/${value}`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
				}
			);
			if (!response.ok) {
				throw new Error('Failed to update value');
			}
			return true;
		} catch (err) {
			console.error('Failed to update value:', err);
			return false;
		}
	};

	const refreshJSON = async () => {
		try {
			const response = await fetch(`${location.origin}/keyval/all`, {
				headers: {
					'Content-Type': 'application/json',
				},
				method: 'POST',
			});
			if (!response.ok) {
				return false;
			}
			const newJson = await response.json();
			if (!isValSame(newJson, json)) {
				setJson(newJson);
			}
			return true;
		} catch (err) {
			console.error('Failed to refresh:', err);
			return false;
		}
	};

	const changeValue = async (path: string[], toValue: string) => {
		const keys =
			path.length !== 0
				? [path.join('.')]
				: Object.getOwnPropertyNames(json);

		for (const key of keys) {
			if (!(await sendValChange(key, toValue))) {
				return;
			}
		}
		await refreshJSON();
	};

	useEffect(() => {
		if (Object.keys(json).length === 0) {
			void refreshJSON();
		}

		// Set up refresh interval
		const interval = setInterval(() => {
			void refreshJSON();
		}, 1000 * 60);

		return () => clearInterval(interval);
	}, []);

	const renderSwitch = (path: string[], value: string) => {
		return (
			<Switch
				checked={value === '1'}
				onChange={(checked) => {
					void changeValue(path, checked ? '1' : '0');
				}}
			/>
		);
	};

	const getGroups = (
		obj: Record<string, unknown>
	): Record<string, Record<string, unknown>> => {
		const groups: Record<string, Record<string, unknown>> = {};

		const processObject = (
			obj: Record<string, unknown>,
			path: string[] = []
		) => {
			for (const [key, value] of Object.entries(obj)) {
				if (key === '___last_updated') {
					continue;
				}

				const currentPath = [...path, key];
				const fullPath = currentPath.join(DELIMITER);

				if (typeof value === 'object' && value !== null) {
					const objValue = value as Record<string, unknown>;
					const hasOnlyPrimitives = Object.values(objValue).every(
						(v) => typeof v !== 'object'
					);

					if (hasOnlyPrimitives) {
						groups[fullPath] = {};
						Object.entries(objValue).forEach(
							([subKey, subValue]) => {
								if (typeof subValue === 'string') {
									groups[fullPath][subKey] = subValue;
								}
							}
						);
					} else {
						processObject(objValue, currentPath);
					}
				} else if (path.length === 0 && typeof value === 'string') {
					if (!groups['state']) {
						groups['state'] = {};
					}
					groups['state'][key] = value;
				}
			}
		};

		processObject(obj);

		// Remove empty groups
		return Object.fromEntries(
			Object.entries(groups).filter(
				([, values]) => Object.keys(values).length > 0
			)
		);
	};

	const renderGroup = (obj: Record<string, unknown>): JSX.Element => {
		const groups = getGroups(obj);

		return (
			<div
				style={{
					display: 'flex',
					flexWrap: 'wrap',
					gap: '20px',
					padding: '10px',
				}}
			>
				{Object.entries(groups).map(([groupName, values]) => (
					<div
						key={groupName}
						style={{
							flex: '1 1 300px',
							backgroundColor: 'rgba(255,255,255,0.1)',
							borderRadius: '12px',
							padding: '20px',
							boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
						}}
					>
						<h2
							style={{
								margin: '0 0 20px 0',
								borderBottom: '2px solid rgba(255,255,255,0.2)',
								paddingBottom: '12px',
								fontSize: '1.5rem',
								fontWeight: '600',
								letterSpacing: '0.5px',
								textTransform: 'capitalize',
							}}
						>
							{groupName}
						</h2>
						<div
							style={{
								display: 'flex',
								flexDirection: 'column',
								gap: '12px',
							}}
						>
							{Object.entries(values).map(([key, value]) => {
								const isChecked = value === '1';
								return (
									<div
										key={key}
										style={{
											display: 'flex',
											alignItems: 'center',
											backgroundColor:
												'rgba(255,255,255,0.05)',
											padding: '12px 16px',
											borderRadius: '8px',
											transition: 'all 0.2s ease',
											cursor: 'pointer',
										}}
										onClick={() => {
											void changeValue(
												[...groupName.split(DELIMITER), key],
												isChecked ? '0' : '1'
											);
										}}
										onMouseEnter={(e) => {
											e.currentTarget.style.backgroundColor =
												'rgba(255,255,255,0.08)';
											e.currentTarget.style.transform =
												'translateX(4px)';
										}}
										onMouseLeave={(e) => {
											e.currentTarget.style.backgroundColor =
												'rgba(255,255,255,0.05)';
											e.currentTarget.style.transform =
												'translateX(0)';
										}}
									>
										<span
											style={{
												marginRight: '16px',
												flex: 1,
												whiteSpace: 'nowrap',
												fontSize: '1.1rem',
												fontWeight: '500',
												fontFamily:
													'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
											}}
										>
											{key}
										</span>
										{renderSwitch(
											[...groupName.split(DELIMITER), key],
											value as string
										)}
									</div>
								);
							})}
						</div>
					</div>
				))}
			</div>
		);
	};

	return (
		<div
			className="json-switches"
			style={{
				padding: '20px',
				color: 'white',
				maxWidth: '1200px',
				margin: '0 auto',
				fontFamily:
					'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
			}}
		>
			{renderGroup(json)}
		</div>
	);
};
