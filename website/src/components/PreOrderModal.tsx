import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, Copy, ExternalLink, Check, Sparkles, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import { createStripeCheckoutSession, getLicenseKeyByCheckoutSession, APP_URL } from '../lib/supabase';

interface PreOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  price: number;
  checkoutSessionId?: string;
}

const COLORS = {
  void: 'hsl(240, 30%, 4%)',
  obsidian: 'hsl(0, 0%, 4%)',
  goldHex: '#c29623',
  goldLight: '#e8c547',
  goldDark: '#8c6613',
  ether: 'rgba(255,255,255,0.05)',
  textPrimary: '#ffffff',
  textMuted: 'rgba(255,255,255,0.5)',
  textDim: 'rgba(255,255,255,0.35)',
};

const GOLDEN_GRADIENT = `linear-gradient(135deg, ${COLORS.goldHex} 0%, ${COLORS.goldLight} 50%, ${COLORS.goldHex} 100%)`;

export default function PreOrderModal({ isOpen, onClose, price, checkoutSessionId }: PreOrderModalProps) {
  const [email, setEmail] = useState('');
  const [checkoutState, setCheckoutState] = useState<'input' | 'processing' | 'success' | 'error'>('input');
  const [processStep, setProcessStep] = useState(0);
  const [generatedKey, setGeneratedKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isFlipped, setIsFlipped] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);

  // Dynamic 3D card tilt effect
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || isFlipped) return;
    const rect = cardRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left - width / 2;
    const mouseY = e.clientY - rect.top - height / 2;
    const rX = -(mouseY / height) * 20; // max 20 degrees
    const rY = (mouseX / width) * 20; // max 20 degrees
    setRotateX(rX);
    setRotateY(rY);
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
  };

  // Poll for key once returning from Stripe Checkout
  useEffect(() => {
    if (isOpen && checkoutSessionId) {
      verifyCheckoutSession(checkoutSessionId);
    }
  }, [isOpen, checkoutSessionId]);

  const verifyCheckoutSession = async (sessionId: string) => {
    setCheckoutState('processing');
    setProcessStep(0); // Connecting...
    
    // Simulate steps in UI for styling
    setTimeout(() => setProcessStep(1), 1000); // Retrieving key...
    
    let attempts = 0;
    const maxAttempts = 15; // Poll for 30s max
    
    while (attempts < maxAttempts) {
      try {
        const result = await getLicenseKeyByCheckoutSession(sessionId);
        if (result.success && result.licenseKey) {
          setProcessStep(2); // Success!
          await new Promise((resolve) => setTimeout(resolve, 500));
          setGeneratedKey(result.licenseKey);
          if (result.email) setEmail(result.email);
          setCheckoutState('success');
          return;
        }
      } catch (e) {
        console.warn('Error fetching key attempt:', attempts, e);
      }
      
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    
    setErrorMessage("The transaction was complete, but we couldn't retrieve your license key immediately. Please check your email for details or contact priority support.");
    setCheckoutState('error');
  };

  // Submit to create Stripe session
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setCheckoutState('processing');
    setProcessStep(0);

    const result = await createStripeCheckoutSession(email, price);
    if (result.success && result.url) {
      window.location.href = result.url; // Redirect to Stripe!
    } else {
      setErrorMessage(result.error || 'Connection failed. Unable to initiate Stripe checkout.');
      setCheckoutState('error');
    }
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(generatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetModal = () => {
    setEmail('');
    setCheckoutState('input');
    setProcessStep(0);
    setGeneratedKey('');
    setCopied(false);
    setErrorMessage('');
    setIsFlipped(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            boxSizing: 'border-box',
          }}
        >
          {/* Backdrop Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (checkoutState !== 'processing') {
                resetModal();
                onClose();
              }
            }}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.85)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
            }}
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 520,
              background: '#0a0a0c',
              border: `1px solid ${COLORS.goldHex}44`,
              borderRadius: 20,
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 50px rgba(194, 150, 35, 0.1)',
              zIndex: 1,
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '24px 32px 16px',
                borderBottom: `1px solid ${COLORS.ether}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <ShieldCheck size={20} color={COLORS.goldLight} />
                <span
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 14,
                    fontWeight: 800,
                    color: '#fff',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                  }}
                >
                  {checkoutSessionId ? 'Verifying payment' : 'Secure Checkout'}
                </span>
              </div>
              {checkoutState !== 'processing' && (
                <button
                  onClick={() => {
                    resetModal();
                    onClose();
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: COLORS.textMuted,
                    cursor: 'pointer',
                    padding: 4,
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
                  onMouseLeave={(e) => e.currentTarget.style.color = COLORS.textMuted}
                >
                  <X size={20} />
                </button>
              )}
            </div>

            {/* Content Area */}
            <div style={{ padding: '32px' }}>
              <AnimatePresence mode="wait">
                
                {/* 1. INPUT STATE */}
                {checkoutState === 'input' && (
                  <motion.div
                    key="input"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    {/* Selected Plan Details */}
                    <div
                      style={{
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: `1px solid ${COLORS.ether}`,
                        borderRadius: 12,
                        padding: '16px 20px',
                        marginBottom: 24,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.goldLight, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                          Selected Pre-Order
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginTop: 4 }}>
                          {price === 380 ? 'Deity Creator Edition' : 'Gold Edition'}
                        </div>
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: '#fff', fontFamily: "'Inter', sans-serif" }}>
                        ${price}.00
                      </div>
                    </div>

                    {/* access card container */}
                    <div
                      style={{
                        perspective: 1000,
                        width: '100%',
                        height: 200,
                        marginBottom: 32,
                        position: 'relative',
                        cursor: 'pointer',
                      }}
                      onMouseMove={handleMouseMove}
                      onMouseLeave={handleMouseLeave}
                      onClick={() => setIsFlipped(!isFlipped)}
                    >
                      <motion.div
                        ref={cardRef}
                        style={{
                          width: '100%',
                          height: '100%',
                          position: 'relative',
                          transformStyle: 'preserve-3d',
                        }}
                        animate={{
                          rotateY: isFlipped ? 180 : rotateY,
                          rotateX: isFlipped ? 0 : rotateX,
                        }}
                        transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                      >
                        {/* Front Side */}
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            borderRadius: 14,
                            padding: '24px',
                            background: `linear-gradient(135deg, #0f0f13 0%, #1a1a24 100%)`,
                            border: `1px solid ${COLORS.goldHex}66`,
                            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            backfaceVisibility: 'hidden',
                            WebkitBackfaceVisibility: 'hidden',
                            boxSizing: 'border-box',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: 18, letterSpacing: '0.08em', color: COLORS.goldLight }}>
                                VST GOD
                              </div>
                              <div style={{ fontSize: 9, color: COLORS.textMuted, letterSpacing: '0.1em', marginTop: 2 }}>
                                {price === 380 ? 'DEITY CREATOR PASS' : 'GOLD EDITION PASS'}
                              </div>
                            </div>
                            {/* Emblem */}
                            <div
                              style={{
                                width: 36,
                                height: 26,
                                borderRadius: 4,
                                background: `linear-gradient(135deg, ${COLORS.goldLight} 0%, ${COLORS.goldDark} 100%)`,
                                opacity: 0.8,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 0 10px rgba(194, 150, 35, 0.3)',
                              }}
                            >
                              <Sparkles size={14} color="#000" />
                            </div>
                          </div>

                          {/* Email Display as access identifier */}
                          <div
                            style={{
                              fontFamily: "'Courier New', Courier, monospace",
                              fontSize: 16,
                              fontWeight: 'bold',
                              color: email ? '#fff' : COLORS.textDim,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              background: 'rgba(0,0,0,0.3)',
                              padding: '8px 12px',
                              borderRadius: 6,
                              border: '1px solid rgba(255,255,255,0.02)',
                            }}
                          >
                            {email.toLowerCase() || 'deity@olympus.com'}
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                            <div>
                              <div style={{ fontSize: 8, color: COLORS.textDim, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                STATUS
                              </div>
                              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 700, color: COLORS.goldLight, marginTop: 2, letterSpacing: '0.02em' }}>
                                PRE-ORDER PENDING
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 8, color: COLORS.textDim, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                GATEWAY
                              </div>
                              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 700, color: '#fff', marginTop: 2 }}>
                                STRIPE
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Back Side */}
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            borderRadius: 14,
                            padding: '24px',
                            background: `linear-gradient(135deg, #07070a 0%, #121217 100%)`,
                            border: `1px solid ${COLORS.goldHex}66`,
                            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            transform: 'rotateY(180deg)',
                            backfaceVisibility: 'hidden',
                            WebkitBackfaceVisibility: 'hidden',
                            boxSizing: 'border-box',
                          }}
                        >
                          <div style={{ width: '100%', height: 35, background: '#000', marginTop: 10 }} />
                          <div style={{ padding: '0 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                            <div style={{ textAlign: 'left' }}>
                              <span style={{ fontSize: 8, color: COLORS.textDim, letterSpacing: '0.08em', display: 'block' }}>ALCHEMICAL CONTRACT</span>
                              <span style={{ fontSize: 8, color: COLORS.textDim, letterSpacing: '0.08em', display: 'block', marginTop: 2 }}>GENESIS LICENSE SECURED</span>
                            </div>
                            <div
                              style={{
                                width: 50,
                                height: 26,
                                background: '#fff',
                                color: '#000',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontFamily: "'Courier New', Courier, monospace",
                                fontWeight: 'bold',
                                fontSize: 12,
                                borderRadius: 4,
                                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)',
                              }}
                            >
                              SECURE
                            </div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.4 }}>
                            <span style={{ fontSize: 7, color: COLORS.textMuted }}>POWERED BY STRIPE METAPHYSICS</span>
                            <Lock size={10} color={COLORS.textMuted} />
                          </div>
                        </div>
                      </motion.div>
                    </div>

                    {/* Email Form */}
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: COLORS.textMuted, letterSpacing: '0.05em' }}>
                          EMAIL ADDRESS FOR LICENSE KEY
                        </label>
                        <input
                          type="email"
                          required
                          placeholder="deity@olympus.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          style={{
                            background: 'rgba(0,0,0,0.5)',
                            border: `1px solid ${COLORS.ether}`,
                            borderRadius: 10,
                            padding: '14px 16px',
                            color: '#fff',
                            fontSize: 14,
                            fontFamily: "'Inter', sans-serif",
                            outline: 'none',
                          }}
                          onFocus={(e) => e.target.style.borderColor = COLORS.goldHex}
                          onBlur={(e) => e.target.style.borderColor = COLORS.ether}
                        />
                      </div>

                      {/* Pay / Redirect Button */}
                      <button
                        type="submit"
                        style={{
                          width: '100%',
                          padding: '16px',
                          background: GOLDEN_GRADIENT,
                          border: 'none',
                          borderRadius: 12,
                          color: '#000',
                          fontWeight: 800,
                          fontSize: 15,
                          letterSpacing: '0.05em',
                          cursor: 'pointer',
                          marginTop: 10,
                          boxShadow: '0 10px 20px rgba(194, 150, 35, 0.15)',
                          transition: 'opacity 0.3s, transform 0.2s, box-shadow 0.3s',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.boxShadow = '0 15px 30px rgba(194, 150, 35, 0.3)';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.boxShadow = '0 10px 20px rgba(194, 150, 35, 0.15)';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        <Lock size={16} /> PROCEED TO STRIPE CHECKOUT (${price}.00)
                      </button>
                      <p style={{ fontSize: 11, color: COLORS.textDim, textAlign: 'center', margin: '8px 0 0', lineHeight: 1.4 }}>
                        Payments are processed securely via Stripe. We never store or see your credit card information.
                      </p>
                    </form>
                  </motion.div>
                )}

                {/* 2. PROCESSING STATE */}
                {checkoutState === 'processing' && (
                  <motion.div
                    key="processing"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '40px 0',
                    }}
                  >
                    <div style={{ position: 'relative', width: 80, height: 80, marginBottom: 32 }}>
                      <Loader2 className="animate-spin" size={80} color={COLORS.goldHex} strokeWidth={1.5} style={{ animation: 'spin 2s linear infinite' }} />
                      <div
                        style={{
                          position: 'absolute',
                          inset: 12,
                          borderRadius: '50%',
                          border: `1px solid ${COLORS.goldLight}33`,
                          background: '#0d0d10',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Sparkles size={24} color={COLORS.goldLight} />
                      </div>
                    </div>

                    <h3 style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 12, letterSpacing: '0.03em' }}>
                      {checkoutSessionId ? 'VERIFYING PANTHEON BINDINGS' : 'CHANNELS OPENING'}
                    </h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 320, marginTop: 12 }}>
                      {checkoutSessionId ? (
                        // Webhook/Payment Verification steps
                        [
                          'Connecting to Stripe ledger...',
                          'Retrieving generated license...',
                          'Binding deities to key...'
                        ].map((stepText, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: idx <= processStep ? 1 : 0.25, transition: 'opacity 0.4s ease' }}>
                            <div
                              style={{
                                width: 20,
                                height: 20,
                                borderRadius: '50%',
                                background: idx < processStep ? COLORS.goldHex : idx === processStep ? 'transparent' : 'rgba(255,255,255,0.05)',
                                border: idx === processStep ? `2px solid ${COLORS.goldHex}` : 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {idx < processStep && <Check size={12} color="#000" strokeWidth={3} />}
                              {idx === processStep && (
                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: COLORS.goldLight, animation: 'pulse 1s infinite' }} />
                              )}
                            </div>
                            <span style={{ fontSize: 13, color: idx <= processStep ? '#fff' : COLORS.textMuted, fontWeight: idx === processStep ? 600 : 400 }}>
                              {stepText}
                            </span>
                          </div>
                        ))
                      ) : (
                        // Normal Redirect loading state
                        <p style={{ color: COLORS.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 1.6 }}>
                          Securing connections and opening the alchemical ledger. Redirecting to Stripe secure gateway...
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* 3. SUCCESS STATE */}
                {checkoutState === 'success' && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    style={{ textAlign: 'center', padding: '16px 0' }}
                  >
                    <div
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: '50%',
                        background: GOLDEN_GRADIENT,
                        boxShadow: '0 0 30px rgba(194, 150, 35, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 24px',
                      }}
                    >
                      <Check size={32} color="#000" strokeWidth={3} />
                    </div>

                    <h3 style={{ fontSize: 24, fontWeight: 900, color: COLORS.goldLight, marginBottom: 8, letterSpacing: '0.04em' }}>
                      DEITY STATUS ATTAINED
                    </h3>
                    <p style={{ fontSize: 14, color: COLORS.textMuted, lineHeight: 1.5, marginBottom: 28, padding: '0 16px' }}>
                      Your VST GOD license key has been successfully forged and bound to <strong style={{ color: '#fff' }}>{email}</strong>.
                    </p>

                    {/* License Box */}
                    <div
                      style={{
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: `1px solid ${COLORS.goldHex}44`,
                        borderRadius: 12,
                        padding: '16px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 12,
                        marginBottom: 32,
                        position: 'relative',
                      }}
                    >
                      <span style={{ fontSize: 10, color: COLORS.textDim, fontWeight: 600, letterSpacing: '0.1em' }}>
                        YOUR LICENSE KEY
                      </span>
                      <div
                        style={{
                          fontFamily: "'Courier New', Courier, monospace",
                          fontSize: 20,
                          fontWeight: 'bold',
                          color: '#fff',
                          letterSpacing: '0.05em',
                          background: 'rgba(0,0,0,0.5)',
                          padding: '10px 16px',
                          borderRadius: 8,
                          border: '1px solid rgba(255,255,255,0.05)',
                        }}
                      >
                        {generatedKey}
                      </div>
                      <button
                        onClick={handleCopyKey}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          background: 'none',
                          border: 'none',
                          color: copied ? COLORS.goldLight : COLORS.textMuted,
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: 600,
                          transition: 'color 0.2s',
                        }}
                      >
                        {copied ? (
                          <>
                            <Check size={14} /> Key Copied!
                          </>
                        ) : (
                          <>
                            <Copy size={14} /> Copy to Clipboard
                          </>
                        )}
                      </button>
                    </div>

                    {/* Instructions & CTA for Portal */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <p style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.5, padding: '0 20px' }}>
                        To download the plugin binaries (macOS & Windows installers) and activate your key, access the client portal using this exact email:
                      </p>
                      
                      <a
                        href={`${APP_URL}/login?email=${encodeURIComponent(email)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          padding: '16px 24px',
                          background: GOLDEN_GRADIENT,
                          borderRadius: 12,
                          color: '#000',
                          fontWeight: 800,
                          fontSize: 15,
                          textDecoration: 'none',
                          boxShadow: '0 10px 20px rgba(194, 150, 35, 0.15)',
                          transition: 'transform 0.2s, box-shadow 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-1px)';
                          e.currentTarget.style.boxShadow = '0 15px 30px rgba(194, 150, 35, 0.3)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 10px 20px rgba(194, 150, 35, 0.15)';
                        }}
                      >
                        Access User Portal <ExternalLink size={16} />
                      </a>
                    </div>
                  </motion.div>
                )}

                {/* 4. ERROR STATE */}
                {checkoutState === 'error' && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    style={{ textAlign: 'center', padding: '24px 0' }}
                  >
                    <div
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: '50%',
                        background: 'rgba(214, 75, 53, 0.1)',
                        border: '2px solid #d64b35',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 24px',
                      }}
                    >
                      <AlertCircle size={32} color="#d64b35" />
                    </div>

                    <h3 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 12 }}>
                      TRANSACTION ERROR
                    </h3>
                    <p style={{ fontSize: 14, color: COLORS.textMuted, lineHeight: 1.5, marginBottom: 32, padding: '0 24px' }}>
                      {errorMessage}
                    </p>

                    <button
                      onClick={() => setCheckoutState('input')}
                      style={{
                        padding: '12px 24px',
                        background: 'rgba(255,255,255,0.05)',
                        border: `1px solid ${COLORS.ether}`,
                        borderRadius: 10,
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: 14,
                        cursor: 'pointer',
                        transition: 'background 0.3s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    >
                      Return to Checkout
                    </button>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
