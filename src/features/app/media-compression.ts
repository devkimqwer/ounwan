export type MediaCompressionReason =
  | "already-small"
  | "image-compressed"
  | "video-compressed"
  | "not-smaller"
  | "not-supported"
  | "failed";

export type MediaCompressionResult = {
  file: File;
  originalFile: File;
  compressed: boolean;
  reason: MediaCompressionReason;
  originalSize: number;
  compressedSize: number;
};

const IMAGE_MAX_LONG_SIDE = 1920;
const IMAGE_QUALITY = 0.8;
const IMAGE_SMALL_SIZE_BYTES = 1024 * 1024;
const VIDEO_TARGET_SIZE_RATIO = 0.5;
const VIDEO_MIN_BITRATE = 350_000;
const VIDEO_MAX_BITRATE = 4_000_000;
const VIDEO_MIME_TYPES = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];

export async function compressMediaFilesForUpload(files: File[]) {
  const results: MediaCompressionResult[] = [];

  for (const file of files) {
    results.push(await compressMediaFileForUpload(file));
  }

  return results;
}

async function compressMediaFileForUpload(file: File): Promise<MediaCompressionResult> {
  try {
    if (isCompressibleImage(file)) {
      return await compressImageFile(file);
    }

    if (isCompressibleVideo(file)) {
      return await compressVideoFile(file);
    }

    return createResult(file, file, false, "not-supported");
  } catch {
    return createResult(file, file, false, "failed");
  }
}

async function compressImageFile(file: File): Promise<MediaCompressionResult> {
  const decodedImage = await decodeImage(file);
  const longSide = Math.max(decodedImage.width, decodedImage.height);

  try {
    if (file.size <= IMAGE_SMALL_SIZE_BYTES && longSide <= IMAGE_MAX_LONG_SIDE) {
      return createResult(file, file, false, "already-small");
    }

    const scale = Math.min(1, IMAGE_MAX_LONG_SIDE / longSide);
    const targetWidth = Math.max(1, Math.round(decodedImage.width * scale));
    const targetHeight = Math.max(1, Math.round(decodedImage.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      return createResult(file, file, false, "failed");
    }

    context.drawImage(decodedImage.source, 0, 0, targetWidth, targetHeight);

    const blob = (await canvasToBlob(canvas, "image/webp", IMAGE_QUALITY)) ?? (await canvasToBlob(canvas, "image/jpeg", IMAGE_QUALITY));
    if (!blob) {
      return createResult(file, file, false, "failed");
    }

    if (blob.size >= file.size) {
      return createResult(file, file, false, "not-smaller");
    }

    const compressedFile = new File([blob], replaceFileExtension(file.name, blob.type === "image/webp" ? "webp" : "jpg"), {
      type: blob.type || "image/jpeg",
      lastModified: Date.now(),
    });

    return createResult(file, compressedFile, true, "image-compressed");
  } finally {
    decodedImage.cleanup();
  }
}

async function compressVideoFile(file: File): Promise<MediaCompressionResult> {
  if (!("MediaRecorder" in window)) {
    return createResult(file, file, false, "not-supported");
  }

  const mimeType = VIDEO_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
  if (!mimeType) {
    return createResult(file, file, false, "not-supported");
  }

  const video = document.createElement("video");
  const objectUrl = URL.createObjectURL(file);
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";
  video.src = objectUrl;

  try {
    await loadVideoMetadata(video);

    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      return createResult(file, file, false, "not-supported");
    }

    const captureStream = getVideoCaptureStream(video);
    if (!captureStream) {
      return createResult(file, file, false, "not-supported");
    }

    const targetBitrate = Math.min(
      VIDEO_MAX_BITRATE,
      Math.max(VIDEO_MIN_BITRATE, Math.floor((file.size * 8 * VIDEO_TARGET_SIZE_RATIO) / video.duration)),
    );
    const recordedBlob = await recordVideoStream(video, captureStream, mimeType, targetBitrate);

    if (!recordedBlob || recordedBlob.size >= file.size) {
      return createResult(file, file, false, "not-smaller");
    }

    const compressedFile = new File([recordedBlob], replaceFileExtension(file.name, "webm"), {
      type: recordedBlob.type || mimeType,
      lastModified: Date.now(),
    });

    return createResult(file, compressedFile, true, "video-compressed");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function createResult(originalFile: File, file: File, compressed: boolean, reason: MediaCompressionReason): MediaCompressionResult {
  return {
    file,
    originalFile,
    compressed,
    reason,
    originalSize: originalFile.size,
    compressedSize: file.size,
  };
}

function isCompressibleImage(file: File) {
  return file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name);
}

function isCompressibleVideo(file: File) {
  return file.type.startsWith("video/") || /\.(mov|m4v|mp4)$/i.test(file.name);
}

async function decodeImage(file: File) {
  if ("createImageBitmap" in window) {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close(),
      };
    } catch {
      // Fall through to HTMLImageElement decoding for browsers with partial createImageBitmap support.
    }
  }

  const objectUrl = URL.createObjectURL(file);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new window.Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("Image decode failed."));
    element.src = objectUrl;
  });

  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    cleanup: () => URL.revokeObjectURL(objectUrl),
  };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

function loadVideoMetadata(video: HTMLVideoElement) {
  return new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Video metadata load failed."));
  });
}

function getVideoCaptureStream(video: HTMLVideoElement) {
  const captureStream = (video as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream;
  return typeof captureStream === "function" ? captureStream.call(video) : null;
}

function recordVideoStream(video: HTMLVideoElement, stream: MediaStream, mimeType: string, videoBitsPerSecond: number) {
  return new Promise<Blob | null>((resolve, reject) => {
    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond });
    const timeoutId = window.setTimeout(
      () => {
        if (recorder.state !== "inactive") {
          recorder.stop();
        }
      },
      Math.min(Math.max(video.duration * 1000 + 5000, 10_000), 180_000),
    );

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };
    recorder.onerror = () => {
      window.clearTimeout(timeoutId);
      reject(new Error("Video recording failed."));
    };
    recorder.onstop = () => {
      window.clearTimeout(timeoutId);
      stream.getTracks().forEach((track) => track.stop());
      resolve(chunks.length > 0 ? new Blob(chunks, { type: mimeType }) : null);
    };
    video.onended = () => {
      if (recorder.state !== "inactive") {
        recorder.stop();
      }
    };

    recorder.start(1000);
    video.play().catch((error: unknown) => {
      if (recorder.state !== "inactive") {
        recorder.stop();
      }
      reject(error instanceof Error ? error : new Error("Video playback failed."));
    });
  });
}

function replaceFileExtension(fileName: string, extension: string) {
  const extensionWithDot = `.${extension}`;
  return /\.[^.]+$/.test(fileName) ? fileName.replace(/\.[^.]+$/, extensionWithDot) : `${fileName}${extensionWithDot}`;
}
