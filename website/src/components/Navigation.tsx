/**
 * Navigation.tsx — Fixed glass navigation bar
 *
 * Premium dark-mode nav with:
 * - Glassmorphism backdrop-filter
 * - Scroll-aware show/hide (hides on scroll-down, shows on scroll-up)
 * - Active section detection via IntersectionObserver
 * - Golden gradient CTA button
 * - Responsive mobile hamburger menu
 * - prefers-reduced-motion respect
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';

/* ─── Nav links config ──────────────────────────────────────────────── */
const NAV_LINKS = [
  { label: 'Gods', href: '#gods' },
  { label: 'Features', href: '#features' },
  { label: 'Sounds', href: '#sounds' },
  { label: 'Pre-Order', href: '#pre-order' },
  { label: 'Download', href: '#download' },
] as const;

const SECTION_IDS = NAV_LINKS.map((l) => l.href.slice(1));

/* ─── Scroll throttle helper ────────────────────────────────────────── */
function useThrottledScroll(callback: (scrollY: number) => void, delay = 100) {
  const lastRun = useRef(0);
  const rafId = useRef(0);

  useEffect(() => {
    const handler = () => {
      const now = Date.now();
      if (now - lastRun.current >= delay) {
        lastRun.current = now;
        callback(window.scrollY);
      } else {
        cancelAnimationFrame(rafId.current);
        rafId.current = requestAnimationFrame(() => {
          lastRun.current = Date.now();
          callback(window.scrollY);
        });
      }
    };

    window.addEventListener('scroll', handler, { passive: true });
    return () => {
      window.removeEventListener('scroll', handler);
      cancelAnimationFrame(rafId.current);
    };
  }, [callback, delay]);
}

/* ─── Smooth scroll helper ──────────────────────────────────────────── */
function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

/* ─── Component ─────────────────────────────────────────────────────── */
export default function Navigation() {
  const [isVisible, setIsVisible] = useState(true);
  const [isPastHero, setIsPastHero] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const lastScrollY = useRef(0);
  const navRef = useRef<HTMLElement>(null);

  /* ── Scroll-aware show/hide + hero detection ───────────────────── */
  const handleScroll = useCallback(
    (scrollY: number) => {
      const delta = scrollY - lastScrollY.current;
      const heroHeight = window.innerHeight * 0.85;

      // Always show at top
      if (scrollY < 80) {
        setIsVisible(true);
        setIsPastHero(false);
      } else {
        // Hide on scroll-down, show on scroll-up (threshold to avoid jitter)
        if (delta > 8) setIsVisible(false);
        else if (delta < -4) setIsVisible(true);

        setIsPastHero(scrollY > heroHeight);
      }

      lastScrollY.current = scrollY;
    },
    [],
  );

  useThrottledScroll(handleScroll, 50);

  /* ── Active section detection via IntersectionObserver ──────────── */
  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    SECTION_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActiveSection(id);
          }
        },
        { rootMargin: '-30% 0px -60% 0px', threshold: 0 },
      );

      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  /* ── Close mobile menu on outside click ────────────────────────── */
  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handleClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [mobileMenuOpen]);

  /* ── Close mobile menu on Escape ───────────────────────────────── */
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  /* ── Lock body scroll when mobile menu is open ─────────────────── */
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  const handleNavClick = (href: string) => {
    scrollToSection(href.slice(1));
    setMobileMenuOpen(false);
  };

  /* ── Reduced motion ────────────────────────────────────────────── */
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const navVariants = prefersReducedMotion
    ? { visible: { y: 0 }, hidden: { y: 0 } }
    : {
        visible: { y: 0, transition: { type: 'spring' as const, stiffness: 260, damping: 30 } },
        hidden: { y: '-100%', transition: { duration: 0.3, ease: 'easeInOut' as const } },
      };

  const menuVariants = prefersReducedMotion
    ? { closed: { height: 0, opacity: 1 }, open: { height: 'auto', opacity: 1 } }
    : {
        closed: { height: 0, opacity: 0, transition: { duration: 0.25, ease: 'easeInOut' as const } },
        open: { height: 'auto', opacity: 1, transition: { duration: 0.35, ease: 'easeOut' as const } },
      };

  /* ── Render ─────────────────────────────────────────────────────── */
  return (
    <motion.nav
      ref={navRef}
      initial="visible"
      animate={isVisible || mobileMenuOpen ? 'visible' : 'hidden'}
      variants={navVariants}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        height: 'var(--nav-height, 64px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 clamp(16px, 4vw, 48px)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        background: isPastHero
          ? 'rgba(6, 6, 12, 0.92)'
          : 'rgba(10, 10, 15, 0.7)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        transition: 'background 0.5s ease',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* ── Left: Wordmark ─────────────────────────────────────────── */}
      <a
        href="#"
        onClick={(e) => {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          textDecoration: 'none',
          flexShrink: 0,
        }}
        aria-label="Back to top"
      >
        <span
          style={{
            color: '#ffffff',
            fontSize: 'clamp(14px, 1.6vw, 18px)',
            fontWeight: 900,
            letterSpacing: '0.2em',
            textTransform: 'uppercase' as const,
            lineHeight: 1,
          }}
        >
          VST GOD
        </span>

        {/* Golden dot separator */}
        <span
          style={{
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            background: '#c29623',
            flexShrink: 0,
          }}
          aria-hidden="true"
        />

        <span
          style={{
            color: '#c29623',
            fontSize: 'clamp(9px, 1vw, 11px)',
            fontWeight: 700,
            letterSpacing: '0.2em',
            textTransform: 'uppercase' as const,
            lineHeight: 1,
            whiteSpace: 'nowrap',
          }}
        >
          THE GOD REALM
        </span>
      </a>

      {/* ── Center: Desktop nav links ──────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '32px',
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
        }}
        className="nav-desktop-links"
      >
        {NAV_LINKS.map((link) => {
          const isActive = activeSection === link.href.slice(1);
          return (
            <a
              key={link.href}
              href={link.href}
              onClick={(e) => {
                e.preventDefault();
                handleNavClick(link.href);
              }}
              style={{
                position: 'relative',
                color: isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)',
                fontSize: '10px',
                fontWeight: 600,
                letterSpacing: '0.15em',
                textTransform: 'uppercase' as const,
                textDecoration: 'none',
                padding: '4px 0',
                transition: 'color 0.3s ease',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.color = 'rgba(255,255,255,0.4)';
              }}
            >
              {link.label}
              {/* Active / hover underline */}
              <span
                style={{
                  position: 'absolute',
                  bottom: '-2px',
                  left: 0,
                  right: 0,
                  height: '1.5px',
                  background: 'linear-gradient(90deg, #c29623, #ff6600)',
                  borderRadius: '1px',
                  transform: isActive ? 'scaleX(1)' : 'scaleX(0)',
                  transformOrigin: 'center',
                  transition: 'transform 0.3s ease',
                }}
                aria-hidden="true"
              />
            </a>
          );
        })}
      </div>

      {/* ── Right: CTA + Mobile toggle ─────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        {/* CTA — Desktop */}
        <a
          href="#pre-order"
          onClick={(e) => {
            e.preventDefault();
            handleNavClick('#pre-order');
          }}
          className="nav-cta-desktop"
          style={{
            background: 'linear-gradient(135deg, #c29623 0%, #ff6600 100%)',
            color: '#ffffff',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.15em',
            textTransform: 'uppercase' as const,
            textDecoration: 'none',
            padding: '8px 20px',
            borderRadius: '9999px',
            boxShadow: '0 0 20px rgba(194, 150, 35, 0.25), 0 0 60px rgba(194, 150, 35, 0.1)',
            transition: 'box-shadow 0.3s ease, transform 0.2s ease',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow =
              '0 0 30px rgba(194, 150, 35, 0.4), 0 0 80px rgba(194, 150, 35, 0.15)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow =
              '0 0 20px rgba(194, 150, 35, 0.25), 0 0 60px rgba(194, 150, 35, 0.1)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          Pre-Order
        </a>

        {/* Mobile hamburger toggle */}
        <button
          onClick={() => setMobileMenuOpen((v) => !v)}
          className="nav-mobile-toggle"
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
          style={{
            display: 'none', // shown via CSS on mobile
            background: 'none',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            padding: '8px',
            color: 'rgba(255,255,255,0.7)',
            cursor: 'pointer',
            transition: 'border-color 0.2s ease',
            lineHeight: 0,
          }}
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* ── Mobile slide-down menu ──────────────────────────────────── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            key="mobile-menu"
            initial="closed"
            animate="open"
            exit="closed"
            variants={menuVariants}
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              overflow: 'hidden',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              background: 'rgba(6, 6, 12, 0.95)',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            <div style={{ padding: '16px clamp(16px, 4vw, 48px) 24px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {NAV_LINKS.map((link, i) => {
                const isActive = activeSection === link.href.slice(1);
                return (
                  <motion.a
                    key={link.href}
                    href={link.href}
                    onClick={(e) => {
                      e.preventDefault();
                      handleNavClick(link.href);
                    }}
                    initial={prefersReducedMotion ? {} : { opacity: 0, x: -16 }}
                    animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.25 }}
                    style={{
                      color: isActive ? '#c29623' : 'rgba(255,255,255,0.6)',
                      fontSize: '12px',
                      fontWeight: 600,
                      letterSpacing: '0.15em',
                      textTransform: 'uppercase' as const,
                      textDecoration: 'none',
                      padding: '14px 0',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      transition: 'color 0.2s ease',
                      display: 'block',
                    }}
                  >
                    {link.label}
                  </motion.a>
                );
              })}

              {/* Mobile CTA */}
              <a
                href="#pre-order"
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick('#pre-order');
                }}
                style={{
                  marginTop: '12px',
                  display: 'block',
                  textAlign: 'center',
                  background: 'linear-gradient(135deg, #c29623 0%, #ff6600 100%)',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase' as const,
                  textDecoration: 'none',
                  padding: '12px 24px',
                  borderRadius: '9999px',
                  boxShadow: '0 0 20px rgba(194, 150, 35, 0.3)',
                }}
              >
                Pre-Order Now
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Responsive CSS injection ─────────────────────────────────
           We inject a <style> tag to handle responsive breakpoints
           that inline styles can't handle cleanly. */}
      <style>{`
        :root {
          --nav-height: 64px;
        }

        @media (max-width: 768px) {
          :root {
            --nav-height: 56px;
          }
          .nav-desktop-links {
            display: none !important;
          }
          .nav-cta-desktop {
            display: none !important;
          }
          .nav-mobile-toggle {
            display: flex !important;
          }
        }

        @media (min-width: 769px) {
          .nav-mobile-toggle {
            display: none !important;
          }
        }
      `}</style>
    </motion.nav>
  );
}
