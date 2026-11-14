export default function HomePage() {
  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#overview" aria-label="ResoGuard-AI home">
          <span className="brand-mark" aria-hidden="true">R</span>
          <span>RESOGUARD<span className="brand-ai">.AI</span></span>
        </a>
        <span className="status"><i aria-hidden="true" /> DEFENSE SYSTEM READY</span>
      </header>

      <section className="hero" id="overview">
        <p className="eyebrow">REAL-TIME VOICE SECURITY</p>
        <h1>Trust the voice.<br /><span>Verify the signal.</span></h1>
        <p className="intro">
          ResoGuard-AI detects voice-cloning impersonation during high-risk calls,
          helping teams pause suspicious requests before a transaction is approved.
        </p>
        <a className="action" href="#capabilities">Explore the defense model <span aria-hidden="true">↘</span></a>
      </section>

      <section className="metrics" aria-label="Platform capabilities">
        <article><span className="metric-label">01 / ANALYSIS</span><h2>Live voice signals</h2><p>Acoustic artifacts, prosody, and enrolled-speaker consistency combine into a continuously updated risk score.</p></article>
        <article><span className="metric-label">02 / RESPONSE</span><h2>Risk-aware actions</h2><p>Policy thresholds can request step-up verification or freeze sensitive activity when evidence escalates.</p></article>
        <article><span className="metric-label">03 / AUDIT</span><h2>Verifiable records</h2><p>Hash-linked events and a Merkle root make prototype audit history independently verifiable.</p></article>
      </section>

      <section className="notice" id="capabilities">
        <span className="notice-icon" aria-hidden="true">!</span>
        <p><strong>Prototype deployment.</strong> Detection scores and voice-analysis layers require a connected detector model and signaling service before production use. This page does not record or transmit microphone audio.</p>
      </section>
      <footer><span>SIH26104 · RESOGUARD-AI</span><span>SECURE BY DESIGN / HUMAN-VERIFIED</span></footer>
    </main>
  );
}
