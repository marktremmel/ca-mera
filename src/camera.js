/**
 * camera.js — Camera access and management
 *
 * Handles getUserMedia, front/back camera toggling,
 * and frame capture from the video stream.
 */

export class Camera {
    constructor(videoElement) {
        this.video = videoElement;
        this.stream = null;
        this.facingMode = 'environment'; // rear camera by default
    }

    /**
     * Start the camera stream
     */
    async start() {
        try {
            // Stop any existing stream
            this.stop();

            const constraints = {
                video: {
                    facingMode: this.facingMode,
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                },
                audio: false,
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;
            await this.video.play();
            return true;
        } catch (err) {
            console.error('Camera access denied or unavailable:', err);
            return false;
        }
    }

    /**
     * Stop the camera stream
     */
    stop() {
        if (this.stream) {
            this.stream.getTracks().forEach((t) => t.stop());
            this.stream = null;
        }
    }

    /**
     * Toggle between front and rear cameras
     */
    async flip() {
        this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
        return this.start();
    }

    /**
     * Capture the current video frame as ImageData
     * Crops to a square-ish region (128:112 aspect ratio)
     */
    captureFrame() {
        const vw = this.video.videoWidth;
        const vh = this.video.videoHeight;
        if (!vw || !vh) return null;

        // Calculate crop region to match 128:112 (8:7) aspect ratio
        const targetAspect = 128 / 112;
        let cropW, cropH, cropX, cropY;

        if (vw / vh > targetAspect) {
            // Video is wider — crop sides
            cropH = vh;
            cropW = Math.round(vh * targetAspect);
            cropX = Math.round((vw - cropW) / 2);
            cropY = 0;
        } else {
            // Video is taller — crop top/bottom
            cropW = vw;
            cropH = Math.round(vw / targetAspect);
            cropX = 0;
            cropY = Math.round((vh - cropH) / 2);
        }

        const canvas = new OffscreenCanvas(cropW, cropH);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(this.video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        return ctx.getImageData(0, 0, cropW, cropH);
    }
}
