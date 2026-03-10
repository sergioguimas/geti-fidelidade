"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const RANGE_OPTIONS = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
] as const;

type RangeValue = (typeof RANGE_OPTIONS)[number]["value"];

type RangeSliderDragProps = {
  value: RangeValue;
  onChange: (value: RangeValue) => void;
};

export function RangeSliderDrag({
  value,
  onChange,
}: RangeSliderDragProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragX, setDragX] = useState<number | null>(null);

  const activeIndex = useMemo(
    () => RANGE_OPTIONS.findIndex((item) => item.value === value),
    [value]
  );

  const stepCount = RANGE_OPTIONS.length;
  const thumbSize = 52;
  const padding = 6;

  function getMetrics() {
    const track = trackRef.current;
    if (!track) return null;

    const rect = track.getBoundingClientRect();
    const minLeft = padding;
    const maxLeft = rect.width - padding - thumbSize;
    const stepSize = stepCount > 1 ? (maxLeft - minLeft) / (stepCount - 1) : 0;

    return { rect, minLeft, maxLeft, stepSize };
  }

  function getLeftFromIndex(index: number) {
    const metrics = getMetrics();
    if (!metrics) return padding;
    return metrics.minLeft + index * metrics.stepSize;
  }

  function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
  }

  function getNearestIndex(left: number) {
    const metrics = getMetrics();
    if (!metrics) return activeIndex;

    const raw = (left - metrics.minLeft) / metrics.stepSize;
    return clamp(Math.round(raw), 0, stepCount - 1);
  }

  function updateDrag(clientX: number) {
    const metrics = getMetrics();
    if (!metrics) return;

    const nextLeft = clamp(
      clientX - metrics.rect.left - thumbSize / 2,
      metrics.minLeft,
      metrics.maxLeft
    );

    setDragX(nextLeft);
  }

  function commitDrag(clientX?: number) {
    const metrics = getMetrics();
    if (!metrics) return;

    const finalLeft =
      clientX != null
        ? clamp(
            clientX - metrics.rect.left - thumbSize / 2,
            metrics.minLeft,
            metrics.maxLeft
          )
        : dragX ?? getLeftFromIndex(activeIndex);

    const nextIndex = getNearestIndex(finalLeft);
    setDragX(null);
    setIsDragging(false);
    onChange(RANGE_OPTIONS[nextIndex].value);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (target.hasPointerCapture?.(e.pointerId)) return;

    target.setPointerCapture?.(e.pointerId);
    setIsDragging(true);
    updateDrag(e.clientX);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging) return;
    updateDrag(e.clientX);
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    commitDrag(e.clientX);
  }

  function handlePointerCancel() {
    setDragX(null);
    setIsDragging(false);
  }

  useEffect(() => {
    if (!isDragging) return;

    const handleWindowUp = () => {
      setDragX(null);
      setIsDragging(false);
    };

    window.addEventListener("mouseup", handleWindowUp);
    return () => window.removeEventListener("mouseup", handleWindowUp);
  }, [isDragging]);

  const currentLeft = isDragging && dragX !== null ? dragX : getLeftFromIndex(activeIndex);

  return (
    <div className="relative w-[200px] select-none">
      <div
        ref={trackRef}
        className="relative h-10 rounded-full bg-zinc-200 p-1.5 shadow-[inset_0_2px_6px_rgba(0,0,0,0.12)]"
      >
        {/* labels no fundo */}
        <div className="absolute inset-0 grid grid-cols-3">
          {RANGE_OPTIONS.map((item) => (
            <div
              key={item.value}
              className="flex items-center justify-center text-sm font-bold uppercase tracking-wide text-zinc-500"
            >
              {item.label}
            </div>
          ))}
        </div>

        {/* thumb */}
        <div
          className={`absolute top-1/2 z-10 h-[30px] w-[52px] -translate-y-1/2 rounded-full bg-transparent shadow-[0_6px_14px_rgba(0,0,0,0.20),inset_0_1px_1px_rgba(255,255,255,0.95)] ${
            isDragging
              ? "cursor-grabbing transition-none scale-[1.03] hover:scale-[1.04]"
              : "cursor-grab transition-all duration-300 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]"
          }`}
          style={{
            left: `${currentLeft}px`,
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        >
        </div>

        {/* áreas clicáveis */}
        <div className="absolute inset-0 grid grid-cols-3">
          {RANGE_OPTIONS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => {
                if (!isDragging) onChange(item.value);
              }}
              className="h-full w-full bg-transparent"
              aria-label={`Selecionar ${item.label}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}