"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { PixelSprite } from "@/components/PixelSprite";
import { room, sprites } from "@/data/sprites";
import { frameIndex, roomPose } from "@/lib/sprite";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

// Check how often to look at the clock. Frames only change every frameMs, so this just needs to be finer.
const CHECK_MS = 100;

// The room. It shows what the server already knows: whether a timer is running. It reads no clock and no
// time; the only timer here steps the sprite frames. Frame 0 on the server and on the first client render.
export function RoomScene({ studying }: { studying: boolean }) {
  const pose = roomPose(studying);
  const data = room.states[pose];
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );

  // The frame belongs to the pose it was computed for, so a pose change shows frame 0 straight away.
  const [tick, setTick] = useState({ pose, frame: 0 });
  const frameCount = data.character.frames.length;
  const frame = tick.pose === pose && !reducedMotion ? tick.frame : 0;

  useEffect(() => {
    if (reducedMotion) return;
    let interval: ReturnType<typeof setInterval> | undefined;

    const start = () => {
      const startedAt = performance.now();
      interval = setInterval(() => {
        const next = frameIndex(performance.now() - startedAt, frameCount, data.frameMs, false);
        setTick((previous) => (previous.pose === pose && previous.frame === next ? previous : { pose, frame: next }));
      }, CHECK_MS);
    };
    const stop = () => {
      clearInterval(interval);
      interval = undefined;
    };
    const onVisibility = () => {
      stop();
      if (!document.hidden) start();
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pose, frameCount, data.frameMs, reducedMotion]);

  const size = room.tileSize;
  const width = room.cols * size;
  const height = room.rows * size;
  const character = sprites[data.character.frames[frame]];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={data.label}
      className="h-room-phone-h w-room-phone-w max-w-none shrink-0 md:h-room-desktop-h md:w-room-desktop-w"
    >
      {room.tiles.flatMap((row, y) =>
        [...row].map((key, x) => (
          <PixelSprite key={`${x},${y}`} sprite={sprites[room.tileKey[key]]} x={x * size} y={y * size} />
        )),
      )}
      {[...room.objects, ...data.objects].map((object, index) => (
        <PixelSprite key={index} sprite={sprites[object.sprite]} x={object.x * size} y={object.y * size} />
      ))}
      <PixelSprite sprite={character} x={data.character.x * size} y={data.character.y * size} />
    </svg>
  );
}
