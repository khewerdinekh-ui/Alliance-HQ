// Grabs evenly-spaced, downscaled frames from a video file as JPEG data URLs
// (client-side, via <video> + <canvas>) so a screen recording can go through
// the same vision extraction as screenshots.
export function extractVideoFrames(file: File, frameCount = 16, maxDimension = 1000): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.src = URL.createObjectURL(file);

    const frames: string[] = [];
    let index = 0;

    video.onerror = () => reject(new Error("Couldn't read that video file."));

    video.onloadedmetadata = () => {
      let width = video.videoWidth;
      let height = video.videoHeight;
      if (width > maxDimension || height > maxDimension) {
        const scale = maxDimension / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not supported."));
        return;
      }

      const seekNext = () => {
        if (index >= frameCount) {
          URL.revokeObjectURL(video.src);
          resolve(frames);
          return;
        }
        video.currentTime = (video.duration * (index + 1)) / (frameCount + 1);
      };

      video.onseeked = () => {
        ctx.drawImage(video, 0, 0, width, height);
        frames.push(canvas.toDataURL("image/jpeg", 0.8));
        index += 1;
        seekNext();
      };

      seekNext();
    };
  });
}
