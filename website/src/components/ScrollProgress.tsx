/**
 * ScrollProgress.tsx — Golden scroll progress bar
 *
 * Thin golden line at the top of the viewport that fills
 * as the user scrolls down the page. Uses framer-motion's
 * useScroll for buttery smooth tracking.
 */

import { motion, useScroll, useSpring } from 'framer-motion';

export default function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <motion.div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        background: 'linear-gradient(90deg, #a07818, #f0d668, #c29623)',
        transformOrigin: '0%',
        scaleX,
        zIndex: 9998,
        pointerEvents: 'none',
      }}
    />
  );
}
