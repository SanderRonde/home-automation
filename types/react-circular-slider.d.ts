/// <reference types="react" />

declare module '@fseehawer/react-circular-slider' {
	export interface CircularSliderProps {
		/** Current value of the slider */
		value?: number;
		/** Minimum value */
		min?: number;
		/** Maximum value */
		max?: number;
		/** Step size for the slider */
		step?: number;
		/** Label text to display */
		label?: string;
		/** Callback function called when value changes */
		onChange?: (value: number | string) => void;
		/** Callback function called when dragging starts */
		onChangeStart?: (value: number | string) => void;
		/** Callback function called when dragging ends */
		onChangeEnd?: (value: number | string) => void;
		/** Width of the slider */
		width?: number | string;
		/** Height of the slider */
		height?: number | string;
		/** Size of the slider (applies to both width and height) */
		size?: number | string;
		/** Append to value */
		appendToValue?: string;
		/** Color of the track */
		trackColor?: string;
		/** Color of the progress track */
		progressColor?: string;
		/** Color of the knob */
		knobColor?: string;
		/** Size of the knob */
		knobSize?: number;
		/** Position of the knob (0-360 degrees or similar) */
		knobPosition?: 'top' | 'right' | 'bottom' | 'left' | number;
		/** Whether the slider is disabled */
		disabled?: boolean;
		/** Whether to show the label */
		showLabel?: boolean;
		/** Custom label component */
		labelComponent?: React.ReactNode;
		/** Data attribute for testing */
		dataTestid?: string;
		/** Additional CSS classes */
		className?: string;
		/** Additional inline styles */
		style?: React.CSSProperties;
		/** Direction of the slider (clockwise/counterclockwise) */
		direction?: 'clockwise' | 'counterclockwise';
		/** Starting angle in degrees */
		startAngle?: number;
		/** Ending angle in degrees */
		endAngle?: number;
		/** Whether to hide the track */
		hideTrack?: boolean;
		/** Whether to hide the progress */
		hideProgress?: boolean;
		/** Whether to hide the knob */
		hideKnob?: boolean;
		/** Opacity of the track */
		trackOpacity?: number;
		/** Opacity of the progress */
		progressOpacity?: number;
		/** Width of the track line */
		trackWidth?: number;
		/** Width of the progress line */
		progressWidth?: number;
		/** Whether to snap to steps */
		snapToStep?: boolean;
		/** Format function for displaying the value */
		formatValue?: (value: number) => string;
		/** Additional props that might be passed through */
		[key: string]: unknown;
	}

	const CircularSlider: React.FC<CircularSliderProps>;
	export default CircularSlider;
}
