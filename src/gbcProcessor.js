/**
 * gbcProcessor.js — Game Boy Camera image processing pipeline
 *
 * Emulates the M64282FP sensor's image processing:
 *   1. Downscale to 128×112
 *   2. Convert to grayscale
 *   3. Edge enhancement (optional, emulates the sensor's 2D filter mode)
 *   4. Ordered dithering with 4×4 Bayer matrix
 *   5. Quantize to 4 shades
 *   6. Apply color palette
 *
 * All functions operate on ImageData pixel arrays for zero-dependency processing.
 */

import { getPaletteRgb } from './palettes.js';

// Game Boy Camera native resolution
export const GBC_WIDTH = 128;
export const GBC_HEIGHT = 112;

/**
 * 4×4 Bayer ordered dithering matrix (normalized to 0–1 range)
 * This matches the pattern visible in the example photos.
 */
const BAYER_4x4 = [
    [0 / 16, 8 / 16, 2 / 16, 10 / 16],
    [12 / 16, 4 / 16, 14 / 16, 6 / 16],
    [3 / 16, 11 / 16, 1 / 16, 9 / 16],
    [15 / 16, 7 / 16, 13 / 16, 5 / 16],
];

/**
 * 3×3 edge enhancement kernel (Laplacian-based, similar to M64282FP's 2D filter)
 */
const EDGE_KERNEL = [
    0, -1, 0,
    -1, 5, -1,
    0, -1, 0,
];

/**
 * Process a full frame through the GB Camera pipeline.
 *
 * @param {ImageData} sourceImageData - Raw camera frame
 * @param {string} paletteKey - Key from PALETTES
 * @param {object} options
 * @param {number} options.contrast - Contrast adjustment (0–2, default 1.2)
 * @param {number} options.edgeStrength - Edge enhancement mix (0–1, default 0.3)
 * @returns {ImageData} Processed 128×112 image
 */
export function processFrame(sourceImageData, paletteKey, options = {}) {
    const {
        contrast = 1.2,
        edgeStrength = 0.3,
    } = options;

    const paletteRgb = getPaletteRgb(paletteKey);

    // Step 1: Downscale to 128×112
    const downscaled = downscale(sourceImageData, GBC_WIDTH, GBC_HEIGHT);

    // Step 2: Convert to grayscale
    const gray = toGrayscale(downscaled);

    // Step 3: Apply contrast
    applyContrast(gray, contrast);

    // Step 4: Edge enhancement
    if (edgeStrength > 0) {
        edgeEnhance(gray, edgeStrength);
    }

    // Step 5 & 6: Ordered dithering + palette application (combined for speed)
    ditherAndColorize(gray, paletteRgb);

    return gray;
}

/**
 * Downscale an ImageData to the target dimensions using area averaging.
 */
function downscale(source, targetW, targetH) {
    const canvas = new OffscreenCanvas(targetW, targetH);
    const ctx = canvas.getContext('2d');

    // Create a temporary canvas from the source
    const srcCanvas = new OffscreenCanvas(source.width, source.height);
    const srcCtx = srcCanvas.getContext('2d');
    srcCtx.putImageData(source, 0, 0);

    // Use the browser's downscaling (good quality)
    ctx.drawImage(srcCanvas, 0, 0, targetW, targetH);
    return ctx.getImageData(0, 0, targetW, targetH);
}

/**
 * Convert ImageData to grayscale in-place using luminance weighting.
 */
function toGrayscale(imageData) {
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
        const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        d[i] = d[i + 1] = d[i + 2] = lum;
    }
    return imageData;
}

/**
 * Apply contrast adjustment in-place.
 */
function applyContrast(imageData, factor) {
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
        const v = Math.max(0, Math.min(255, ((d[i] / 255 - 0.5) * factor + 0.5) * 255));
        d[i] = d[i + 1] = d[i + 2] = v;
    }
}

/**
 * Apply edge enhancement in-place using 3×3 convolution.
 */
function edgeEnhance(imageData, strength) {
    const { width, height, data } = imageData;
    const original = new Uint8ClampedArray(data);

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            let sum = 0;
            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    const idx = ((y + ky) * width + (x + kx)) * 4;
                    sum += original[idx] * EDGE_KERNEL[(ky + 1) * 3 + (kx + 1)];
                }
            }
            const idx = (y * width + x) * 4;
            // Mix original and enhanced
            const enhanced = original[idx] * (1 - strength) + sum * strength;
            const v = Math.max(0, Math.min(255, enhanced));
            data[idx] = data[idx + 1] = data[idx + 2] = v;
        }
    }
}

/**
 * Apply 4×4 Bayer ordered dithering and colorize with palette.
 * Combined into one pass for performance.
 *
 * The Bayer matrix adds a threshold offset to each pixel based on its position,
 * then the value is quantized into one of 4 levels and mapped to the palette.
 */
function ditherAndColorize(imageData, paletteRgb) {
    const { width, height, data } = imageData;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const gray = data[idx] / 255;

            // Bayer threshold for this pixel position
            const threshold = BAYER_4x4[y % 4][x % 4] - 0.5;
            // Spread factor controls how aggressive the dithering is
            const spread = 0.33;
            const dithered = gray + threshold * spread;

            // Quantize to 0–3
            let shade;
            if (dithered < 0.25) shade = 0;
            else if (dithered < 0.5) shade = 1;
            else if (dithered < 0.75) shade = 2;
            else shade = 3;

            // Apply palette color
            const [r, g, b] = paletteRgb[shade];
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
            data[idx + 3] = 255;
        }
    }
}

/**
 * Upscale an ImageData using nearest-neighbor interpolation.
 * This produces the characteristic chunky pixel look.
 *
 * @param {ImageData} source - The small source image (e.g. 128×112)
 * @param {number} scale - Integer scale factor
 * @returns {ImageData}
 */
export function upscaleNearest(source, scale) {
    const sw = source.width;
    const sh = source.height;
    const dw = sw * scale;
    const dh = sh * scale;
    const canvas = new OffscreenCanvas(dw, dh);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    const srcCanvas = new OffscreenCanvas(sw, sh);
    srcCanvas.getContext('2d').putImageData(source, 0, 0);

    ctx.drawImage(srcCanvas, 0, 0, dw, dh);
    return ctx.getImageData(0, 0, dw, dh);
}
