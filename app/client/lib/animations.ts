import type { Variants, Transition } from 'framer-motion';
import type { SxProps, Theme } from '@mui/material';

/**
 * Simple fade-in animation (legacy CSS)
 * Duration: 300ms
 */
export const fadeIn: SxProps<Theme> = {
	'@keyframes fadeIn': {
		from: { opacity: 0 },
		to: { opacity: 1 },
	},
	animation: 'fadeIn 300ms ease-in',
	animationFillMode: 'both',
};

/**
 * Fade-in with upward slide animation (legacy CSS)
 * Duration: 300ms
 */
export const fadeInUp: SxProps<Theme> = {
	'@keyframes fadeInUp': {
		from: { opacity: 0, transform: 'translateY(10px)' },
		to: { opacity: 1, transform: 'translateY(0)' },
	},
	animation: 'fadeInUp 300ms ease-out',
	animationFillMode: 'both',
};

/**
 * Staggered fade-in with upward slide animation (legacy CSS)
 * Duration: 150ms with index-based delay (15ms per index)
 * Optimized for faster initial render and better scroll calculation
 *
 * @param index - The index of the element in the list (0-based)
 * @returns SxProps with staggered animation
 */
export const fadeInUpStaggered = (index: number): SxProps<Theme> => ({
	'@keyframes fadeInUp': {
		from: { opacity: 0, transform: 'translateY(10px)' },
		to: { opacity: 1, transform: 'translateY(0)' },
	},
	animation: 'fadeInUp 150ms ease-out',
	animationDelay: `${index * 15}ms`,
	animationFillMode: 'both',
	willChange: 'opacity, transform',
});

// Framer Motion Variants and Transitions

/**
 * Smooth spring physics configuration for elegant animations
 */
export const smoothSpring: Transition = {
	type: 'spring',
	stiffness: 300,
	damping: 30,
};

/**
 * Bouncy spring physics for playful interactions
 */
export const bouncySpring: Transition = {
	type: 'spring',
	stiffness: 400,
	damping: 20,
};

/**
 * Gentle spring for subtle animations
 */
export const gentleSpring: Transition = {
	type: 'spring',
	stiffness: 200,
	damping: 25,
};

/**
 * Page entrance animation variant
 */
export const pageVariants: Variants = {
	initial: {
		opacity: 0,
		y: 20,
	},
	animate: {
		opacity: 1,
		y: 0,
		transition: smoothSpring,
	},
	exit: {
		opacity: 0,
		y: -20,
		transition: { duration: 0.2 },
	},
};

/**
 * Card entrance animation variant
 */
export const cardVariants: Variants = {
	initial: {
		opacity: 0,
		y: 20,
		scale: 0.95,
	},
	animate: {
		opacity: 1,
		y: 0,
		scale: 1,
		transition: smoothSpring,
	},
};

/**
 * Stagger container for child animations
 */
export const staggerContainer: Variants = {
	initial: {},
	animate: {
		transition: {
			staggerChildren: 0.08,
			delayChildren: 0.1,
		},
	},
};

/**
 * Stagger child item variant
 */
export const staggerItem: Variants = {
	initial: {
		opacity: 0,
		y: 10,
	},
	animate: {
		opacity: 1,
		y: 0,
		transition: gentleSpring,
	},
};

/**
 * Scale fade animation for interactive elements
 */
export const scaleFade: Variants = {
	initial: {
		opacity: 0,
		scale: 0.8,
	},
	animate: {
		opacity: 1,
		scale: 1,
		transition: smoothSpring,
	},
	tap: {
		scale: 0.95,
	},
	hover: {
		scale: 1.05,
		transition: bouncySpring,
	},
};

/**
 * Hover lift animation for cards and buttons
 */
export const hoverLift: Variants = {
	rest: {
		y: 0,
		scale: 1,
	},
	hover: {
		y: -4,
		scale: 1.02,
		transition: bouncySpring,
	},
	tap: {
		scale: 0.98,
		transition: { duration: 0.1 },
	},
};

/**
 * Slide in from right animation
 */
export const slideInRight: Variants = {
	initial: {
		x: 100,
		opacity: 0,
	},
	animate: {
		x: 0,
		opacity: 1,
		transition: smoothSpring,
	},
};

/**
 * Slide in from left animation
 */
export const slideInLeft: Variants = {
	initial: {
		x: -100,
		opacity: 0,
	},
	animate: {
		x: 0,
		opacity: 1,
		transition: smoothSpring,
	},
};

/**
 * Pulse animation for attention-grabbing elements
 */
export const pulse: Variants = {
	initial: {
		scale: 1,
		opacity: 1,
	},
	animate: {
		scale: [1, 1.05, 1],
		opacity: [1, 0.8, 1],
		transition: {
			duration: 2,
			repeat: Infinity,
			ease: 'easeInOut',
		},
	},
};

/**
 * Rotate animation for loaders or interactive elements
 */
export const rotate: Variants = {
	initial: {
		rotate: 0,
	},
	animate: {
		rotate: 360,
		transition: {
			duration: 1,
			repeat: Infinity,
			ease: 'linear',
		},
	},
};
