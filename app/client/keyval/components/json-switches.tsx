import type {
	KeyvalOutputShape,
	KeyvalLeafNode,
} from '../../../server/modules/keyval/api';
import React, { useEffect, useState } from 'react';
import { isValSame } from '../lib/util';
import { Switch } from 'antd';

interface JSONSwitchesProps {
	initialJson?: KeyvalOutputShape;
}

const DELIMITER = ' > ';

export const JSONSwitches: React.FC<JSONSwitchesProps> = (props) => {
	const [json, setJson] = useState<KeyvalOutputShape>(
		props.initialJson ?? {}
	);
	const [loadingKeys, setLoadingKeys] = useState<string[]>([]);

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

	const changeValue = async (key: string, toValue: string) => {
		setLoadingKeys((prev) => [...prev, key]);
		try {
			await sendValChange(key, toValue);
			await refreshJSON();
		} finally {
			setLoadingKeys((prev) => prev.filter((k) => k !== key));
		}
	};

	useEffect(() => {
		void refreshJSON();

		// Set up refresh interval
		const interval = setInterval(() => {
			void refreshJSON();
		}, 1000 * 60);

		return () => clearInterval(interval);
	}, []);

	const renderSwitch = (key: string, value: string) => {
		const isLoading = loadingKeys.includes(key);
		return (
			<Switch
				checked={value === '1'}
				loading={isLoading}
				onChange={(checked) => {
					void changeValue(key, checked ? '1' : '0');
				}}
			/>
		);
	};

	const getGroups = (
		obj: KeyvalOutputShape
	): Record<string, Record<string, KeyvalLeafNode>> => {
		const groups: Record<string, Record<string, KeyvalLeafNode>> = {};

		const processObject = (obj: KeyvalOutputShape, path: string[] = []) => {
			const orderedEntries = Object.entries(obj).sort((a, b) => {
				const aOrder = a[1].type === 'group' ? a[1].order ?? 0 : 0;
				const bOrder = b[1].type === 'group' ? b[1].order ?? 0 : 0;
				if (aOrder === bOrder) {
					return 0;
				}
				return aOrder < bOrder ? -1 : 1;
			});
			for (const [key, value] of orderedEntries) {
				if (key === '___last_updated') {
					continue;
				}

				const currentPath = [...path, key];
				const fullPath = currentPath.join(DELIMITER);

				if (value && value.type === 'group') {
					const hasOnlyPrimitives = Object.values(value.values).every(
						(v) => v.type === 'leaf'
					);

					if (hasOnlyPrimitives) {
						groups[fullPath] = {};
						Object.entries(value.values).forEach(
							([subKey, subValue]) => {
								if (subValue.type === 'leaf') {
									groups[fullPath][subKey] = subValue;
								}
							}
						);
					} else {
						processObject(value.values, currentPath);
					}
				} else if (path.length > 0 && value.type === 'leaf') {
					// Handle top-level values
					const parentGroup = path.join(DELIMITER);
					if (!groups[parentGroup]) {
						groups[parentGroup] = {};
					}
					groups[parentGroup][key] = value;
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

	const renderGroup = (obj: KeyvalOutputShape): JSX.Element => {
		const groups = getGroups(obj);
		console.log(obj, groups)

		return (
			<div
				style={{
					display: 'flex',
					flexWrap: 'wrap',
					gap: '20px',
					padding: '10px',
				}}
			>
				{Object.keys(groups).length ? (
					Object.entries(groups).map(([groupName, values]) => (
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
									borderBottom:
										'2px solid rgba(255,255,255,0.2)',
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
									const isChecked = value.value === '1';
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
													value.fullKey,
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
												{value.emoji} {key}
											</span>
											{renderSwitch(key, value.value)}
										</div>
									);
								})}
							</div>
						</div>
					))
				) : (
					<div>No groups</div>
				)}
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
