/**
 * gallery.js — Photo storage and gallery management
 *
 * Stores captured photos in localStorage as data URLs.
 * Provides gallery display, download, and share functionality.
 */

const STORAGE_KEY = 'ca_mera_photos';

/**
 * Get all saved photos from localStorage
 * @returns {{ id: string, dataUrl: string, palette: string, timestamp: number }[]}
 */
export function getPhotos() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

/**
 * Save a photo to localStorage
 * @param {HTMLCanvasElement|OffscreenCanvas} canvas - The processed canvas to save
 * @param {string} palette - Palette key used
 * @returns {string} Photo ID
 */
export function savePhoto(canvas, palette) {
    const photos = getPhotos();

    // Convert to data URL
    let dataUrl;
    if (canvas instanceof OffscreenCanvas) {
        // OffscreenCanvas doesn't have toDataURL, need to use a regular canvas
        const c = document.createElement('canvas');
        c.width = canvas.width;
        c.height = canvas.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(canvas, 0, 0);
        dataUrl = c.toDataURL('image/png');
    } else {
        dataUrl = canvas.toDataURL('image/png');
    }

    const photo = {
        id: `photo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        dataUrl,
        palette,
        timestamp: Date.now(),
    };

    photos.unshift(photo); // newest first

    // Keep max 30 photos (like the original Game Boy Camera!)
    if (photos.length > 30) photos.pop();

    localStorage.setItem(STORAGE_KEY, JSON.stringify(photos));
    return photo.id;
}

/**
 * Delete a photo by ID
 */
export function deletePhoto(id) {
    const photos = getPhotos().filter((p) => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(photos));
}

/**
 * Download a photo
 */
export function downloadPhoto(dataUrl, filename = 'ca_mera_photo.png') {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
}

/**
 * Share a photo using the Web Share API (mobile)
 */
export async function sharePhoto(dataUrl) {
    try {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], 'ca_mera_photo.png', { type: 'image/png' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: 'ca_mera',
                text: 'Shot on ca_mera 📸',
            });
            return true;
        }
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error('Share failed:', err);
        }
    }
    return false;
}
