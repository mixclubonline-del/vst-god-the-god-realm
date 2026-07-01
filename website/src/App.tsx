import Navigation from './components/Navigation'
import HeroScene from './components/HeroScene'
import HeroOverlay from './components/HeroOverlay'
import FeatureShowcase from './components/FeatureShowcase'
import GodRealmSection from './components/GodRealmSection'
import PluginShowcase from './components/PluginShowcase'
import PresetPreviewPlayer from './components/PresetPreviewPlayer'
import KineticMarquee from './components/KineticMarquee'
import StatsCounter from './components/StatsCounter'
import CTASection from './components/CTASection'
import PreOrderSection from './components/PreOrderSection'
import FAQTimerSection from './components/FAQTimerSection'
import Footer from './components/Footer'
import LoadingScreen from './components/LoadingScreen'
import CursorGlow from './components/CursorGlow'
import ScrollProgress from './components/ScrollProgress'
import GodNav from './components/GodNav'
import FeatureComparisonMatrix from './components/FeatureComparisonMatrix'
import PromoTrailerSection from './components/PromoTrailerSection'
import { gods } from './data/godData'
import PreOrderModal from './components/PreOrderModal'
import { useState, useEffect } from 'react'

/**
 * VST GOD — The God Realm
 * Premium 3D marketing website for the Electric Pantheon VST plugin.
 */
function App() {
  const [successSessionId, setSuccessSessionId] = useState<string | null>(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (sessionId) {
      setSuccessSessionId(sessionId);
      setIsSuccessModalOpen(true);
      // Clean query params so refresh doesn't trigger it again
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  return (
    <div className="app">
      {/* Global UI Layers */}
      <LoadingScreen />

      {/* Global UI Layers */}
      <CursorGlow />
      <ScrollProgress />
      <GodNav />

      <Navigation />

      {/* Hero — WebGL Particle Cosmos + God Artwork + Typography */}
      <section id="hero" style={{ position: 'relative', height: '100vh', overflow: 'hidden' }}>
        <HeroScene />
        <HeroOverlay />
      </section>

      {/* Marquee — God Names Ticker */}
      <KineticMarquee />

      {/* Promo Trailer Section */}
      <PromoTrailerSection />

      {/* Feature Showcase — The 4 Divine Controls */}
      <FeatureShowcase />

      {/* Stats — Animated Counting Numbers */}
      <StatsCounter />

      {/* God Realm Sections — 8 Deity Showcases */}
      <section id="gods">
        {gods.map((god, index) => (
          <GodRealmSection key={god.id} god={god} index={index} />
        ))}
      </section>

      {/* Marquee — Reverse Direction */}
      <KineticMarquee
        direction="right"
        speed={25}
        items={[
          'DIVINE KEYS', 'ELECTRIC PANTHEON', 'GOD REALM', 'OLYMPUS KEYS',
          'UNDERWORLD BASS', 'MYTHIC LEAD', 'CELESTIAL PAD', 'ETHEREAL PLUCK',
          'AURA MASTERING', 'SAMPLE CHOPPER', 'PRESET VAULT',
        ]}
      />

      {/* Plugin Showcase — The Instruments of the Gods */}
      <PluginShowcase />

      {/* Preset Preview Player — Showcase of the Divine Presets Expansion Pack */}
      <PresetPreviewPlayer />

      {/* Feature Comparison Matrix */}
      <FeatureComparisonMatrix />

      {/* Pre-Order Section */}
      <PreOrderSection />

      {/* FAQ & Countdown Timer Section */}
      <FAQTimerSection />

      {/* CTA — Download + Email Signup */}
      <CTASection />

      {/* Footer */}
      <Footer />

      {/* Success Checkout Modal */}
      <PreOrderModal
        isOpen={isSuccessModalOpen}
        onClose={() => {
          setIsSuccessModalOpen(false);
          setSuccessSessionId(null);
        }}
        price={199}
        checkoutSessionId={successSessionId || undefined}
      />
    </div>
  )
}

export default App
