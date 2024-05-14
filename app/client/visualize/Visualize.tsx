import * as React from 'react';

import {
	CategoryScale,
	Chart,
	LineElement,
	LinearScale,
	PointElement,
	Colors,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { API } from './api';

Chart.register(CategoryScale, LinearScale, PointElement, LineElement, Colors);

export const Visualize = (): React.ReactNode => {
	const [api, setAPI] = React.useState<API | null>(null);
	React.useEffect(() => {
		void fetch('/visualize/data')
			.then((response) => response.json())
			.then((api) => setAPI(api));
	}, []);

	if (!api) {
		return (
			<div
				style={{
					width: '100%',
					height: '100%',
					fontFamily: 'Roboto, sans-serif',
					color: '#eee',
					paddingLeft: 20,
					paddingRight: 20,
					boxSizing: 'border-box',
				}}
			>
				<h1>Loading...</h1>
			</div>
		);
	}

	return (
		<div
			style={{
				width: '100%',
				height: '100%',
				fontFamily: 'Roboto, sans-serif',
				color: '#eee',
				paddingLeft: 20,
				paddingRight: 20,
				boxSizing: 'border-box',
			}}
		>
			<h1>Charts...</h1>
			{api.graphs.map((graph, index) => (
				<>
					<h2>{graph.name}</h2>
					<Line data={graph} key={index} />
				</>
			))}
		</div>
	);
};
