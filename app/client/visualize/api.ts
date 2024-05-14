import { VisualizeDataType } from '../../server/modules/visualize';

export interface API {
	graphs: {
		name: string;
		labels: string[];
		datasets: {
			label: string;
			data: VisualizeDataType[];
			backgroundColor?: string;
			borderColor?: string;
			borderWidth?: number;
		}[];
	}[];
}
