import { pipeline } from "@huggingface/transformers";

self.onmessage = async (event: MessageEvent<File>) => {
  self.postMessage({ type: "progress", stage: "processing" });

  try {
    const removeBackground = await pipeline(
      "background-removal",
      "Xenova/modnet",
      {
        revision: "fa2fa546052fba4c08921230a26cc69a333fca12",
        dtype: "q8",
        progress_callback: (progress) => {
          if (progress.status === "progress_total") {
            self.postMessage({
              type: "progress",
              stage: "loading",
              percent: Math.round(progress.progress),
            });
          }
        },
      },
    );
    self.postMessage({ type: "progress", stage: "processing" });
    const cutout = await removeBackground(event.data);
    const blob = await cutout.toBlob("image/webp", 0.92);
    if (!(blob instanceof Blob) || !blob.size) {
      throw new Error("The browser couldn't create the transparent image");
    }
    self.postMessage({ type: "done", blob });
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "Background removal failed",
    });
  }
};
