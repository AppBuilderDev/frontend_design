import { useEffect, useRef } from 'react';
/** Keep scrolling while a native drag is held near the canvas edge. */
export function useDragScroll() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    let frame = 0;
    let speed = 0;
    const tick = () => {
      if (!speed || !ref.current) {
        frame = 0;
        return;
      }
      ref.current.scrollTop += speed;
      frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      speed = 0;
      cancelAnimationFrame(frame);
      frame = 0;
    };
    const drag = (event: DragEvent) => {
      const canvas = ref.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      ) {
        stop();
        return;
      }
      const edge = 64;
      const top = event.clientY - rect.top;
      const bottom = rect.bottom - event.clientY;
      speed =
        top < edge
          ? -Math.ceil((edge - top) / 5)
          : bottom < edge
            ? Math.ceil((edge - bottom) / 5)
            : 0;
      if (speed && !frame) frame = requestAnimationFrame(tick);
      if (!speed) stop();
    };
    window.addEventListener('dragover', drag);
    window.addEventListener('drop', stop);
    window.addEventListener('dragend', stop);
    window.addEventListener('blur', stop);
    return () => {
      stop();
      window.removeEventListener('dragover', drag);
      window.removeEventListener('drop', stop);
      window.removeEventListener('dragend', stop);
      window.removeEventListener('blur', stop);
    };
  }, []);
  return ref;
}
