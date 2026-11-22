"use client";

import { useEffect, useRef, useState } from "react";
import { DsButton } from "@/components/ui/ds-button";

type Props = {
  /** Called with the captured JPEG; the panel reads it right away. */
  onCapture: (file: File) => void;
  /** Fall back to the phone's own camera picker (input capture). */
  onUseSystemCamera: () => void;
  onClose: () => void;
};

type CameraState =
  | { kind: "asking" }
  | { kind: "live" }
  | { kind: "denied" }
  | { kind: "unavailable"; message: string };

/**
 * In-page camera. Asks for permission when opened (the browser shows its own
 * prompt), shows a live preview, and captures one frame as a JPEG.
 */
export function CameraCapture({ onCapture, onUseSystemCamera, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>({ kind: "asking" });

  useEffect(() => {
    let cancelled = false;
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState({
          kind: "unavailable",
          message: "This browser can't open the camera here.",
        });
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setState({ kind: "live" });
      } catch (err) {
        if (cancelled) return;
        const name = (err as { name?: string })?.name ?? "";
        if (name === "NotAllowedError" || name === "SecurityError") setState({ kind: "denied" });
        else if (name === "NotFoundError" || name === "OverconstrainedError")
          setState({ kind: "unavailable", message: "We couldn't find a camera on this device." });
        else if (name === "NotReadableError")
          setState({ kind: "unavailable", message: "Another app is using the camera. Close it and try again." });
        else setState({ kind: "unavailable", message: "The camera didn't start." });
      }
    }
    void start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
        onCapture(new File([blob], `camera-${stamp}.jpg`, { type: "image/jpeg" }));
        onClose();
      },
      "image/jpeg",
      0.9,
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Take a photo of the assignment"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(20,24,22,0.7)] p-4"
    >
      <div className="w-full max-w-[640px] rounded-[12px] bg-ds-surface p-6 shadow-ds-card">
        <p className="font-display text-[20px] font-semibold leading-[1.2] text-ds-ink">Use camera</p>
        {state.kind === "asking" ? (
          <p className="mt-2 text-[16px] leading-[1.6] text-ds-muted" role="status">
            Allow camera access in the prompt from your browser.
          </p>
        ) : null}
        {state.kind === "live" ? (
          <p className="mt-2 text-[16px] leading-[1.6] text-ds-muted">
            Fit the whole page in view, in good light, then capture.
          </p>
        ) : null}
        {state.kind === "denied" ? (
          <p className="mt-2 text-[16px] leading-[1.6] text-ds-error" role="alert">
            Camera access is blocked. You can allow it in your browser&apos;s site settings, or use your
            phone&apos;s camera app or a photo from your camera roll instead.
          </p>
        ) : null}
        {state.kind === "unavailable" ? (
          <p className="mt-2 text-[16px] leading-[1.6] text-ds-error" role="alert">
            {state.message} Use your phone&apos;s camera app or a photo from your camera roll instead.
          </p>
        ) : null}
        <video
          ref={videoRef}
          playsInline
          muted
          className={
            state.kind === "live"
              ? "mt-4 max-h-[60vh] w-full rounded-[8px] bg-black object-contain"
              : "hidden"
          }
        />
        <div className="mt-6 flex flex-wrap gap-2">
          {state.kind === "live" ? (
            <DsButton type="button" variant="primary" onClick={capture}>
              Capture
            </DsButton>
          ) : null}
          {state.kind === "denied" || state.kind === "unavailable" ? (
            <DsButton
              type="button"
              variant="primary"
              onClick={() => {
                onClose();
                onUseSystemCamera();
              }}
            >
              Open camera app or photos
            </DsButton>
          ) : null}
          <DsButton type="button" variant="ghost" onClick={onClose}>
            Cancel
          </DsButton>
        </div>
      </div>
    </div>
  );
}
