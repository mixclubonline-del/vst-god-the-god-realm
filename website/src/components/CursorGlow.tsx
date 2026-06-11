/**
 * CursorGlow.tsx — Golden ambient cursor light
 *
 * Renders a subtle golden radial glow that follows the mouse.
 * Disabled on touch devices. Uses requestAnimationFrame for
 * smooth 60fps tracking with no re-renders.
 */

import { useEffect, useRef } from 'react';

export default function CursorGlow() {
  const glowRef = useRef<HTMLDivElement>(null);
  const posRef = useRef({ x: -200, y: -200 });
  const currentRef = useRef({ x: -200, y: -200 });
  const rafRef = useRef<number>(0);

  useEffect(() => {
    // Don't render on touch devices
    if (
      typeof window === 'undefined' ||
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0
    ) {
      return;
    }

    const onMouseMove = (e: MouseEvent) => {
      posRef.current = { x: e.clientX, y: e.clientY };
    };

    const animate = () => {
      const el = glowRef.current;
      if (!el) {
        rafRef.current = requestAnimationFrame(animate);
        return;
      }

      // Smooth lerp towards target
      const lerp = 0.12;
      currentRef.current.x += (posRef.current.x - currentRef.current.x) * lerp;
      currentRef.current.y += (posRef.current.y - currentRef.current.y) * lerp;

      el.style.transform = `translate(${currentRef.current.x - 150}px, ${currentRef.current.y - 150}px)`;

      rafRef.current = requestAnimationFrame(animate);
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Don't render on touch devices
  if (
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0)
  ) {
    return null;
  }

  return (
    <div
      ref={glowRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: 300,
        height: 300,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(194,150,35,0.06) 0%, rgba(194,150,35,0.02) 35%, transparent 65%)',
        pointerEvents: 'none',
        zIndex: 9990,
        willChange: 'transform',
        mixBlendMode: 'screen',
      }}
    />
  );
}
