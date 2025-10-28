import type { SceneId } from './scene';

export interface HomeDetectionEvent {
	id: number;
	host_name: string;
	state: 'HOME' | 'AWAY';
	timestamp: number;
	trigger_type?: string; // 'door-sensor', 'manual', etc.
	scenes_triggered?: Array<{
		scene_id: SceneId;
		scene_title: string;
		triggered: boolean;
		failure_reason?: string;
	}>;
}
