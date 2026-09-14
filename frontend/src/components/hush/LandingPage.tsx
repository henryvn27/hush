'use client';

import Image from 'next/image';

const downloadPath = 'https://github.com/henryvn27/hush/releases';

function Arrow() {
  return <span className="hush-landing-arrow" aria-hidden="true">-&gt;</span>;
}

export default function LandingPage() {
  return (
    <main className="hush-landing">
      <nav className="hush-landing-real-nav" aria-label="Hush landing page">
        <a className="hush-landing-real-brand" href="#top" aria-label="Hush home">
          <Image src="/hush-mark.png" alt="" width={22} height={22} unoptimized />
          <span>Hush</span>
        </a>
        <div className="hush-landing-real-links">
          <a href="#how">How it works</a>
          <a href="#local">Local by design</a>
        </div>
        <a className="hush-landing-real-nav-cta" href={downloadPath} download>
          Download for Mac <Arrow />
        </a>
      </nav>

      <section id="top" className="hush-landing-real-hero">
        <div className="hush-landing-real-copy">
          <p className="hush-landing-real-eyebrow"><span /> Local dictation for Mac</p>
          <h1>Hush<span>.</span></h1>
          <p className="hush-landing-real-claim">Speak wherever you work. Keep the words on this Mac.</p>
          <p className="hush-landing-real-lede">Hold Globe / Fn to dictate, release to finish, or double-press to keep going. Hush transcribes locally and leaves a clear meeting history behind.</p>
          <div className="hush-landing-real-actions">
            <a className="hush-landing-real-primary" href={downloadPath} download>
              Download Hush <Arrow />
            </a>
            <a className="hush-landing-real-text-link" href="#how">See the interaction <Arrow /></a>
          </div>
          <div className="hush-landing-real-proof" aria-label="Hush product qualities">
            <span><b>01</b> Hold Globe / Fn</span>
            <span><b>02</b> Local transcription</span>
            <span><b>03</b> No account</span>
          </div>
        </div>

        <div className="hush-landing-real-product" aria-label="Hush desktop Activity view">
          <div className="hush-landing-real-product-head">
            <span>Hush / Activity</span>
            <span>Real product view</span>
          </div>
          <div className="hush-landing-real-screenshot">
            <Image
              src="/hush-workspace-preview.png"
              alt="Hush Activity view with the local engine status, recent flows, and compact Flow Bar"
              fill
              priority
              sizes="(max-width: 900px) 100vw, 56vw"
              unoptimized
            />
            <div className="hush-landing-real-bar-overlay" aria-hidden="true">
              <Image src="/hush-mark.png" alt="" width={14} height={14} unoptimized />
              <span className="hush-landing-real-bar-dot" />
              <span>Click to start dictating</span>
              <i /><i /><i />
            </div>
          </div>
          <div className="hush-landing-real-product-caption">
            <strong>The app you download</strong>
            <span>Activity, local history, and the small Flow Bar in one place.</span>
          </div>
        </div>
      </section>

      <div className="hush-landing-real-signal" aria-label="Hush interaction summary">
        <span>Hold to dictate</span><i />
        <span>Double-press to keep going</span><i />
        <span>Release to finish</span>
      </div>

      <section id="how" className="hush-landing-real-section hush-landing-real-how">
        <div className="hush-landing-real-section-intro">
          <p className="hush-landing-real-eyebrow"><span /> The interaction</p>
          <h2>A small control<br />with a clear job.</h2>
          <p>Hush is built around the few seconds between thinking a sentence and typing it. The bar stays quiet until you need feedback.</p>
        </div>
        <div className="hush-landing-real-steps">
          <article>
            <span className="hush-landing-real-step-number">01</span>
            <div className="hush-keycap">fn</div>
            <h3>Hold Globe / Fn</h3>
            <p>Start dictation from any focused text field. Your app stays in front.</p>
          </article>
          <article>
            <span className="hush-landing-real-step-number">02</span>
            <div className="hush-landing-real-bar-mock" aria-label="Compact Hush Flow Bar">
              <Image src="/hush-mark.png" alt="" width={15} height={15} unoptimized />
              <span>Listening</span>
              <i /><i /><i />
            </div>
            <h3>Watch the small signal</h3>
            <p>Ready, listening, processing, and done are visible without covering your work.</p>
          </article>
          <article>
            <span className="hush-landing-real-step-number">03</span>
            <div className="hush-landing-real-insert-mark">Aa <Arrow /></div>
            <h3>Keep moving</h3>
            <p>Release to finish. Hush inserts the transcript when Accessibility is available, or copies it honestly when it is not.</p>
          </article>
        </div>
      </section>

      <section id="local" className="hush-landing-real-local">
        <div className="hush-landing-real-local-copy">
          <p className="hush-landing-real-eyebrow"><span /> Local by design</p>
          <h2>Your voice stays<br />in the room.</h2>
          <p>Hush is a desktop product first. Audio, transcripts, imports, and history are designed to live on your Mac, with the permission boundary visible when it matters.</p>
          <a className="hush-landing-real-text-link hush-landing-real-text-link-dark" href={downloadPath} download>Download the local app <Arrow /></a>
        </div>
        <div className="hush-landing-real-local-panel" aria-label="Hush local product details">
          <div className="hush-landing-real-panel-head"><span>Hush / local desk</span><span className="hush-landing-real-panel-status">On this Mac</span></div>
          <div className="hush-landing-real-panel-row"><span>Transcription</span><strong>Local engine</strong></div>
          <div className="hush-landing-real-panel-row"><span>Meeting history</span><strong>Saved locally</strong></div>
          <div className="hush-landing-real-panel-row"><span>App insertion</span><strong>Permission-aware</strong></div>
          <div className="hush-landing-real-panel-foot">No cloud account required to start.</div>
        </div>
      </section>

      <section className="hush-landing-real-final">
        <p className="hush-landing-real-eyebrow"><span /> A quieter way to dictate</p>
        <h2>Put the words<br />where they belong.</h2>
        <a className="hush-landing-real-primary hush-landing-real-primary-dark" href={downloadPath} download>
          Download for Apple silicon <Arrow />
        </a>
      </section>

      <footer className="hush-landing-real-footer">
        <span>Hush / local voice workspace</span>
        <span>Private capture. Clearer thinking.</span>
        <a href={downloadPath} download>Download app <Arrow /></a>
      </footer>
    </main>
  );
}
