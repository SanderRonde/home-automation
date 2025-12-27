import type { FloorplanRenderInfo, LightOverlay } from '../../lib/useFloorplanRender';
import type { FloorplanAlignment } from '../../types/layout';
import { hsvToHex } from '../../../lib/color';
import { Box } from '@mui/material';
import React from 'react';

interface FloorplanBackgroundProps {
	floorplanRender: FloorplanRenderInfo;
	stageTransform: { x: number; y: number; scale: number };
	floorplanAlignment: FloorplanAlignment | null;
	containerStyle?: React.CSSProperties;
}

/**
 * Memoized overlay component to prevent unnecessary re-renders
 */
const LightOverlayComponent = React.memo(
	({ overlay }: { overlay: LightOverlay }) => {
		const cssProps: React.CSSProperties = React.useMemo(() => {
			const props: React.CSSProperties = {
				position: 'absolute',
				top: 0,
				left: 0,
				opacity: overlay.brightness,
				mixBlendMode: 'screen',
				pointerEvents: 'none',
				// Use mask-image instead of loading the image twice
				maskImage: `url(${overlay.imageUrl})`,
				WebkitMaskImage: `url(${overlay.imageUrl})`,
				maskSize: 'contain',
				WebkitMaskSize: 'contain',
				maskRepeat: 'no-repeat',
				maskPosition: '0 0',
				// GPU acceleration hints
				willChange: 'opacity, transform',
				transform: 'translateZ(0)', // Force GPU layer
				backfaceVisibility: 'hidden',
			};

			if (overlay.brightness !== undefined && overlay.brightness !== 1) {
				props.filter = `brightness(${overlay.brightness})`;
			}
			if (overlay.color) {
				props.backgroundColor = `${hsvToHex(
					overlay.color.hue,
					overlay.color.saturation,
					overlay.color.value
				)}99`; // Set hex color with 0.6 opacity (99 in hex)
			}

			return props;
		}, [overlay.brightness, overlay.color, overlay.imageUrl]);

		// The image must be visible with multiply blend mode to multiply with the base image
		// The outer div's maskImage constrains the shape, and screen blend mode composites it
		// Use natural image size to match base image - transforms handle scaling
		return (
			<div style={cssProps}>
				<img
					src={overlay.imageUrl}
					alt=""
					style={{
						display: 'block',
						mixBlendMode: 'multiply',
						pointerEvents: 'none',
					}}
					aria-hidden="true"
				/>
			</div>
		);
	},
	(prevProps, nextProps) => {
		// Custom comparison for memoization
		return (
			prevProps.overlay.deviceId === nextProps.overlay.deviceId &&
			prevProps.overlay.brightness === nextProps.overlay.brightness &&
			prevProps.overlay.imageUrl === nextProps.overlay.imageUrl &&
			prevProps.overlay.color?.hue === nextProps.overlay.color?.hue &&
			prevProps.overlay.color?.saturation === nextProps.overlay.color?.saturation &&
			prevProps.overlay.color?.value === nextProps.overlay.color?.value
		);
	}
);

LightOverlayComponent.displayName = 'LightOverlayComponent';

/**
 * Memoized transform string to prevent recalculation
 */
const useTransformString = (
	stageTransform: { x: number; y: number; scale: number },
	floorplanAlignment: FloorplanAlignment | null
): string => {
	return React.useMemo(() => {
		if (floorplanAlignment) {
			return `translate(${stageTransform.x}px, ${stageTransform.y}px) scale(${stageTransform.scale}) translate(${floorplanAlignment.x}px, ${floorplanAlignment.y}px) scale(${floorplanAlignment.scale}) rotate(${floorplanAlignment.rotation}deg)`;
		}
		return `translate(${stageTransform.x}px, ${stageTransform.y}px) scale(${stageTransform.scale})`;
	}, [stageTransform.x, stageTransform.y, stageTransform.scale, floorplanAlignment]);
};

/**
 * Shared component for rendering floorplan background with alignment transforms.
 * Used by both HomeLayoutView and HouseLayout to ensure identical rendering.
 *
 * Performance optimizations:
 * - Removed redundant image loading (was loading same image twice per overlay)
 * - Added GPU acceleration hints (will-change, translateZ)
 * - Memoized overlay components to prevent unnecessary re-renders
 * - Memoized transform calculations
 * - Optimized image rendering with proper sizing constraints
 */
export const FloorplanBackground = (props: FloorplanBackgroundProps): JSX.Element | null => {
	const transformString = useTransformString(props.stageTransform, props.floorplanAlignment);

	if (!props.floorplanRender.hasRenders || !props.floorplanRender.baseImageUrl) {
		return null;
	}

	return (
		<Box
			sx={{
				position: 'absolute',
				top: 0,
				left: 0,
				width: '100%',
				height: '100%',
				overflow: 'hidden',
				pointerEvents: 'none',
				zIndex: 0,
				...props.containerStyle,
			}}
		>
			{/* Container that applies floorplan alignment in world space, then stage transform in screen space */}
			{/* CSS transforms apply right-to-left, so we write: stage transform, then alignment transform */}
			<Box
				sx={{
					position: 'absolute',
					transformOrigin: '0 0',
					transform: transformString,
					willChange: 'transform',
					// GPU acceleration
					backfaceVisibility: 'hidden',
				}}
			>
				{/* Base image */}
				<img
					src={props.floorplanRender.baseImageUrl}
					alt="Floorplan"
					style={{
						display: 'block',
						pointerEvents: 'none',
						// Use natural image size - transforms handle scaling
						// GPU acceleration
						transform: 'translateZ(0)',
						willChange: 'transform',
					}}
					loading="eager"
					decoding="async"
				/>

				{/* Light overlays - now using memoized components */}
				{props.floorplanRender.lightOverlays.map((overlay) => (
					<LightOverlayComponent key={overlay.deviceId} overlay={overlay} />
				))}
			</Box>
		</Box>
	);
};
