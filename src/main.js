/**
 * main.js — ca_mera application entry point
 *
 * Wires together the camera, processor, gallery, and UI.
 */

import { Camera } from './camera.js';
import { processFrame, upscaleNearest, GBC_WIDTH, GBC_HEIGHT } from './gbcProcessor.js';
import { PALETTES } from './palettes.js';
import { getPhotos, savePhoto, deletePhoto, downloadPhoto, sharePhoto } from './gallery.js';

// ── State ─────────────────────────────────────────────────
let currentPalette = 'classic';
let contrast = 1.2;
let edgeStrength = 0.3;
let previewRunning = false;
let currentDetailPhoto = null;

// ── DOM Elements ──────────────────────────────────────────
const videoEl = document.getElementById('camera-video');
const viewfinder = document.getElementById('viewfinder');
const viewfinderCtx = viewfinder.getContext('2d');

const btnShutter = document.getElementById('btn-shutter');
const btnFlip = document.getElementById('btn-flip');
const btnSettings = document.getElementById('btn-settings');
const btnGallery = document.getElementById('btn-gallery');
const btnGalleryBack = document.getElementById('btn-gallery-back');
const btnImport = document.getElementById('btn-import');
const importInput = document.getElementById('import-input');
const photoCountBadge = document.getElementById('photo-count');

const galleryPanel = document.getElementById('gallery-panel');
const galleryGrid = document.getElementById('gallery-grid');
const galleryCount = document.getElementById('gallery-count');

const detailPanel = document.getElementById('detail-panel');
const detailCanvas = document.getElementById('detail-canvas');
const btnDetailBack = document.getElementById('btn-detail-back');
const btnDownload = document.getElementById('btn-download');
const btnShare = document.getElementById('btn-share');
const btnDelete = document.getElementById('btn-delete');

const contrastSlider = document.getElementById('contrast-slider');
const edgeSlider = document.getElementById('edge-slider');
const adjustments = document.getElementById('adjustments');
const flashOverlay = document.getElementById('flash-overlay');

// ── Camera ────────────────────────────────────────────────
const camera = new Camera(videoEl);

// ── Initialization ────────────────────────────────────────
async function init() {
    // Set canvas native resolution
    viewfinder.width = GBC_WIDTH;
    viewfinder.height = GBC_HEIGHT;

    // Disable smoothing for pixelated rendering
    viewfinderCtx.imageSmoothingEnabled = false;

    // Start camera
    const started = await camera.start();
    if (!started) {
        showCameraError();
        return;
    }

    // Start preview loop
    startPreview();

    // Update gallery badge
    updatePhotoCount();
}

// ── Live Preview Loop ─────────────────────────────────────
function startPreview() {
    if (previewRunning) return;
    previewRunning = true;
    requestAnimationFrame(previewLoop);
}

function stopPreview() {
    previewRunning = false;
}

function previewLoop() {
    if (!previewRunning) return;

    const frame = camera.captureFrame();
    if (frame) {
        const processed = processFrame(frame, currentPalette, {
            contrast,
            edgeStrength,
        });

        // Draw the 128×112 processed image directly onto the viewfinder canvas
        viewfinderCtx.putImageData(processed, 0, 0);
    }

    requestAnimationFrame(previewLoop);
}

// ── Capture ───────────────────────────────────────────────
function capturePhoto() {
    const frame = camera.captureFrame();
    if (!frame) return;

    const processed = processFrame(frame, currentPalette, {
        contrast,
        edgeStrength,
    });

    // Upscale 4x for a nice saved image (512×448)
    const upscaled = upscaleNearest(processed, 4);

    // Create a canvas for saving
    const saveCanvas = new OffscreenCanvas(upscaled.width, upscaled.height);
    saveCanvas.getContext('2d').putImageData(upscaled, 0, 0);

    savePhoto(saveCanvas, currentPalette);

    // Flash effect
    triggerFlash();

    // Update count
    updatePhotoCount();
}

function triggerFlash() {
    flashOverlay.classList.add('flash');
    // Force reflow, then remove after animation
    requestAnimationFrame(() => {
        setTimeout(() => {
            flashOverlay.classList.remove('flash');
        }, 250);
    });
}

// ── Import Photo ──────────────────────────────────────────
function importPhoto(file) {
    const img = new Image();
    img.onload = () => {
        // Draw the imported image to a canvas to get ImageData
        const canvas = new OffscreenCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);

        // Process through the GB Camera pipeline
        const processed = processFrame(imageData, currentPalette, {
            contrast,
            edgeStrength,
        });

        // Show in viewfinder
        viewfinderCtx.putImageData(processed, 0, 0);

        // Upscale 4x and save
        const upscaled = upscaleNearest(processed, 4);
        const saveCanvas = new OffscreenCanvas(upscaled.width, upscaled.height);
        saveCanvas.getContext('2d').putImageData(upscaled, 0, 0);
        savePhoto(saveCanvas, currentPalette);

        triggerFlash();
        updatePhotoCount();

        URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
}

// ── Palette Selection ─────────────────────────────────────
function setupPaletteChips() {
    const chips = document.querySelectorAll('.palette-chip');
    chips.forEach((chip) => {
        chip.addEventListener('click', () => {
            chips.forEach((c) => c.classList.remove('active'));
            chip.classList.add('active');
            currentPalette = chip.dataset.palette;
        });
    });
}

// ── Adjustments ───────────────────────────────────────────
function setupAdjustments() {
    contrastSlider.addEventListener('input', (e) => {
        contrast = parseFloat(e.target.value);
    });

    edgeSlider.addEventListener('input', (e) => {
        edgeStrength = parseFloat(e.target.value);
    });

    btnSettings.addEventListener('click', () => {
        adjustments.classList.toggle('open');
    });
}

// ── Gallery ───────────────────────────────────────────────
function updatePhotoCount() {
    const count = getPhotos().length;
    photoCountBadge.textContent = count;
    galleryCount.textContent = `${count} / 30`;
}

function openGallery() {
    renderGallery();
    galleryPanel.classList.remove('hidden');
}

function closeGallery() {
    galleryPanel.classList.add('hidden');
}

function renderGallery() {
    const photos = getPhotos();
    galleryGrid.innerHTML = '';
    updatePhotoCount();

    if (photos.length === 0) {
        galleryGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📷</div>
        <div class="empty-state-text">NO PHOTOS YET<br/>TAP THE SHUTTER<br/>TO CAPTURE</div>
      </div>
    `;
        return;
    }

    photos.forEach((photo) => {
        const thumb = document.createElement('div');
        thumb.className = 'gallery-thumb';
        thumb.innerHTML = `<img src="${photo.dataUrl}" alt="Photo" loading="lazy" />`;
        thumb.addEventListener('click', () => openDetail(photo));
        galleryGrid.appendChild(thumb);
    });
}

// ── Photo Detail ──────────────────────────────────────────
function openDetail(photo) {
    currentDetailPhoto = photo;

    // Load image onto detail canvas
    const img = new Image();
    img.onload = () => {
        detailCanvas.width = img.width;
        detailCanvas.height = img.height;
        const ctx = detailCanvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0);
    };
    img.src = photo.dataUrl;

    detailPanel.classList.remove('hidden');
}

function closeDetail() {
    detailPanel.classList.add('hidden');
    currentDetailPhoto = null;
}

// ── Camera Error State ────────────────────────────────────
function showCameraError() {
    viewfinderCtx.fillStyle = '#14141f';
    viewfinderCtx.fillRect(0, 0, GBC_WIDTH, GBC_HEIGHT);
    viewfinderCtx.fillStyle = '#8888a0';
    viewfinderCtx.font = '8px "Press Start 2P"';
    viewfinderCtx.textAlign = 'center';
    viewfinderCtx.fillText('CAMERA', GBC_WIDTH / 2, GBC_HEIGHT / 2 - 8);
    viewfinderCtx.fillText('ACCESS', GBC_WIDTH / 2, GBC_HEIGHT / 2 + 4);
    viewfinderCtx.fillText('NEEDED', GBC_WIDTH / 2, GBC_HEIGHT / 2 + 16);
}

// ── Event Listeners ───────────────────────────────────────
function setupEvents() {
    // Shutter
    btnShutter.addEventListener('click', capturePhoto);

    // Flip camera
    btnFlip.addEventListener('click', () => camera.flip());

    // Import
    btnImport.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) importPhoto(file);
        importInput.value = ''; // Reset so same file can be re-imported
    });

    // Gallery
    btnGallery.addEventListener('click', openGallery);
    btnGalleryBack.addEventListener('click', closeGallery);

    // Detail
    btnDetailBack.addEventListener('click', closeDetail);

    btnDownload.addEventListener('click', () => {
        if (currentDetailPhoto) {
            downloadPhoto(currentDetailPhoto.dataUrl, `ca_mera_${currentDetailPhoto.id}.png`);
        }
    });

    btnShare.addEventListener('click', async () => {
        if (currentDetailPhoto) {
            const shared = await sharePhoto(currentDetailPhoto.dataUrl);
            if (!shared) {
                // Fallback to download
                downloadPhoto(currentDetailPhoto.dataUrl, `ca_mera_${currentDetailPhoto.id}.png`);
            }
        }
    });

    btnDelete.addEventListener('click', () => {
        if (currentDetailPhoto) {
            deletePhoto(currentDetailPhoto.id);
            closeDetail();
            renderGallery();
            updatePhotoCount();
        }
    });

    // Palette chips
    setupPaletteChips();

    // Adjustments
    setupAdjustments();

    // Keyboard shortcut for capture (spacebar)
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !galleryPanel.classList.contains('hidden') === false) {
            e.preventDefault();
            capturePhoto();
        }
    });
}

// ── Go! ───────────────────────────────────────────────────
setupEvents();
init();
