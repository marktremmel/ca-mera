/**
 * palettes.js — Game Boy Camera color palettes
 *
 * Each palette is an array of 4 CSS hex colors, ordered darkest → lightest.
 * These map to the 4 quantized shades from the dithering pass.
 */

export const PALETTES = {
    classic: {
        name: 'Classic GB',
        colors: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'],
    },
    sunset: {
        name: 'Sunset',
        colors: ['#1a1034', '#8b3a62', '#e05a46', '#f2d09e'],
    },
    amber: {
        name: 'Amber',
        colors: ['#1b1000', '#6b4e00', '#c8a800', '#ffffff'],
    },
    teal: {
        name: 'Teal',
        colors: ['#0d1b0e', '#1a5c2a', '#3cb460', '#9fffb0'],
    },
    noir: {
        name: 'Noir',
        colors: ['#000000', '#555555', '#aaaaaa', '#ffffff'],
    },
    vaporwave: {
        name: 'Vapor',
        colors: ['#2b0040', '#8000a0', '#ff6090', '#ffcc80'],
    },
};

/**
 * Parse a hex color string into [r, g, b]
 */
export function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Get the RGB arrays for a palette (pre-computed for speed)
 */
export function getPaletteRgb(paletteKey) {
    const palette = PALETTES[paletteKey];
    if (!palette) throw new Error(`Unknown palette: ${paletteKey}`);
    return palette.colors.map(hexToRgb);
}
