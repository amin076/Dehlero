export function createRecordingControls(root: HTMLElement, canvas: HTMLCanvasElement) {
  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];

  const panel = document.createElement("div");
  panel.className = "recording-panel";

  const startButton = document.createElement("button");
  startButton.textContent = "Start Recording";

  const stopButton = document.createElement("button");
  stopButton.textContent = "Stop Recording";

  stopButton.disabled = true;

  startButton.onclick = () => {
    chunks = [];

    const stream = canvas.captureStream(60);

    recorder = new MediaRecorder(stream, {
      mimeType: "video/webm; codecs=vp9",
    });

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "dehlero-recording.webm";
      a.click();

      URL.revokeObjectURL(url);
    };

    recorder.start();

    startButton.disabled = true;
    stopButton.disabled = false;
  };

  stopButton.onclick = () => {
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }

    startButton.disabled = false;
    stopButton.disabled = true;
  };

  panel.appendChild(startButton);
  panel.appendChild(stopButton);
  root.appendChild(panel);

  return panel;
}
