import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';

// Resume AudioContext on first user interaction inside WebView2.
// evaluateJavascript() calls from JUCE have no user-activation status in
// WebView2's Chromium engine, so programmatic resume() fails silently there.
// A real mousedown/touchstart inside the plugin window IS a user gesture and
// will unblock the context — this fires at most once per page load.
(function () {
  function tryResume() {
    const ctx = (window as any).__godRealmAudioCtx as AudioContext | undefined;
    if (ctx) ctx.resume().catch(() => {});
    // No early-return if ctx is undefined — keep the listener alive so the
    // next interaction retries. (The `once` bug: if ctx isn't set yet on the
    // first fire, a one-shot listener would be removed and never retry.)
  }
  // Attempt immediately — works once --autoplay-policy=no-user-gesture-required
  // is passed to the WebView2 environment. Belt-and-suspenders: also retry on
  // every interaction so it self-heals if the initial attempt races ctx
  // creation or the autoplay flag isn't honored by this WebView2 build. ANY
  // real gesture (clicking a tab, turning a knob, a key) unblocks the context.
  for (const ms of [50, 300, 800, 1500, 3000]) setTimeout(tryResume, ms);
  for (const ev of ['pointerdown', 'mousedown', 'mouseup', 'click', 'touchstart', 'keydown', 'wheel']) {
    document.addEventListener(ev, tryResume, true);
  }
  // Keep nudging for the first ~20s after load in case the host pushes audio
  // before the user touches the UI (the autoplay flag should already cover this).
  let ticks = 0;
  const iv = setInterval(() => {
    tryResume();
    if (++ticks > 40) clearInterval(iv);
  }, 500);
})();

if (!import.meta.env.DEV) {
  console.log = () => {};
  console.warn = () => {};
  console.info = () => {};
}

// ─── Error Boundary — prevents full black screen on render crash ─────────────
class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[AppErrorBoundary]', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', width: '100vw', height: '100vh',
          background: '#050507', color: '#fafafa', fontFamily: 'monospace',
          padding: 32, boxSizing: 'border-box',
        }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#f87171', marginBottom: 12 }}>
            ⚠ VST GOD — The God Realm encountered an error
          </div>
          <div style={{
            background: '#1a1a1a', border: '1px solid #333', borderRadius: 8,
            padding: 16, maxWidth: 680, width: '100%', fontSize: 11,
            color: '#fca5a5', whiteSpace: 'pre-wrap', overflowY: 'auto', maxHeight: 300,
          }}>
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              marginTop: 20, padding: '8px 24px', background: '#7c3aed',
              border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);
