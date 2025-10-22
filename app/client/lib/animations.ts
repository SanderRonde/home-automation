import type { SxProps, Theme } from '@mui/material';

/**
 * Simple fade-in animation
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
 * Fade-in with upward slide animation
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
 * Staggered fade-in with upward slide animation
 * Duration: 300ms with index-based delay (50ms per index)
 *
 * @param index - The index of the element in the list (0-based)
 * @returns SxProps with staggered animation
 */
export const fadeInUpStaggered = (index: number): SxProps<Theme> => ({
	'@keyframes fadeInUp': {
		from: { opacity: 0, transform: 'translateY(10px)' },
		to: { opacity: 1, transform: 'translateY(0)' },
	},
	animation: 'fadeInUp 300ms ease-out',
	animationDelay: `${index * 50}ms`,
	animationFillMode: 'both',
});
