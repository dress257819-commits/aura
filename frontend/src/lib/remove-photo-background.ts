export interface BackgroundRemovalProgress {
  stage: "loading" | "processing";
  percent?: number;
}

export function removePhotoBackground(
  file: File,
  onProgress: (progress: BackgroundRemovalProgress) => void,
): Promise<File> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("./remove-photo-background.worker.ts", import.meta.url),
      { type: "module" },
    );

    worker.onmessage = (event: MessageEvent<
      | { type: "progress"; stage: "loading" | "processing"; percent?: number }
      | { type: "done"; blob: Blob }
      | { type: "error"; message: string }
    >) => {
      if (event.data.type === "progress") {
        onProgress({ stage: event.data.stage, percent: event.data.percent });
      } else if (event.data.type === "done") {
        const name = file.name.replace(/\.[^.]+$/, "") || "profile-photo";
        resolve(new File([event.data.blob], `${name}-cutout.webp`, {
          type: "image/webp",
          lastModified: Date.now(),
        }));
        worker.terminate();
      } else {
        reject(new Error(event.data.message));
        worker.terminate();
      }
    };

    worker.onerror = (event) => {
      reject(new Error(event.message || "Background removal failed"));
      worker.terminate();
    };

    worker.postMessage(file);
    onProgress({ stage: "loading" });
  });
}
