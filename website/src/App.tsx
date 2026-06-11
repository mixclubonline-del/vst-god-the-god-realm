import Navigation from './components/Navigation'
import HeroScene from './components/HeroScene'
import HeroOverlay from './components/HeroOverlay'
import FeatureShowcase from './components/FeatureShowcase'
import GodRealmSection from './components/GodRealmSection'
import PluginShowcase from './components/PluginShowcase'
import KineticMarquee from './components/KineticMarquee'
import StatsCounter from './components/StatsCounter'
import CTASection from './components/CTASection'
import Footer from './components/Footer'
import LoadingScreen from './components/LoadingScreen'
import CursorGlow from './components/CursorGlow'
import ScrollProgress from './components/ScrollProgress'
import GodNav from './components/GodNav'
import { gods } from './data/godData'

/**
 * VST GOD — The God Realm
 * Premium 3D marketing website for the Electric Pantheon VST plugin.
 */
function App() {
  return (
    <div className="app">
      {/* Cinematic God Intro */}
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

      {/* CTA — Download + Email Signup */}
      <CTASection />

      {/* Footer */}
      <Footer />
    </div>
  )
}

export default App
