'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AboutPage() {
  const router = useRouter();

  useEffect(() => {
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';
    document.body.style.height = 'auto';
  }, []);

  return (
    <div className="about-root">
      <header className="db-topbar about-topbar">
        <div className="db-topbar-left">
          <span className="db-logo">🌾</span>
          <div>
            <h1 className="db-title">GenoSense</h1>
            <p className="db-meta">Smart agricultural analytics for field trials.</p>
          </div>
        </div>
        <div className="db-topbar-actions">
          <button className="db-btn" type="button" onClick={() => router.push('/')}>
            Back to dashboard
          </button>
        </div>
      </header>

      <main className="about-body">
        <section className="about-hero">
          <div className="about-hero-main">
            <span className="about-pill">About GenoSense</span>
            <h2 className="about-title">
              Turn raw field data into <span className="about-title-em">clear, actionable insights</span>.
            </h2>
            <p className="about-lede">
              GenoSense is a smart, web-based agricultural analytics platform built for growers, researchers,
              and agribusinesses. It automates complex crop trial analysis so teams can make better planting,
              breeding, and harvest decisions without needing advanced data science skills.
            </p>
            <div className="about-hero-actions">
              <button className="about-btn-primary" type="button" onClick={() => router.push('/upload')}>
                Start with data upload
              </button>
              <button className="about-btn-secondary" type="button" onClick={() => router.push('/')}>
                Explore the map
              </button>
            </div>
          </div>
          <div className="about-hero-panel">
            <div className="about-panel-card">
              <p className="about-panel-label">Problem</p>
              <p className="about-panel-value">Manual crop trial analysis is slow and highly specialized.</p>
            </div>
            <div className="about-panel-card">
              <p className="about-panel-label">Solution</p>
              <p className="about-panel-value">Automate agronomic insights and visualize performance instantly.</p>
            </div>
            <div className="about-panel-card">
              <p className="about-panel-label">Impact</p>
              <p className="about-panel-value">Weeks of analysis reduced to seconds with clear, shareable outputs.</p>
            </div>
          </div>
        </section>

        <section className="about-section about-split">
          <div className="about-section-head">
            <span className="about-kicker">Why it exists</span>
            <h3>What problem does it solve?</h3>
            <p>
              Traditional crop trial analysis is slow, manual, and requires specialized expertise.
              GenoSense automates complex agronomic analysis so you can focus on better decisions instead of
              wrestling with spreadsheets.
            </p>
          </div>
          <div className="about-callout">
            <h4>Designed for real field teams</h4>
            <p>
              Upload once, analyze instantly, and share results without spreadsheet cleanup or custom scripts.
            </p>
          </div>
        </section>

        <section className="about-section">
          <div className="about-section-head">
            <span className="about-kicker">Capabilities</span>
            <h3>Key features</h3>
            <p>Everything you need to move from field data to decisions in one workflow.</p>
          </div>
          <div className="about-grid">
            <div className="about-card">
              <h4>Easy data upload</h4>
              <p>Drag-and-drop field maps, crop images, and yield spreadsheets. Formatting is handled for you.</p>
            </div>
            <div className="about-card">
              <h4>Interactive field maps</h4>
              <p>View plots on satellite imagery with color-coded health and performance overlays.</p>
            </div>
            <div className="about-card">
              <h4>Automated performance analysis</h4>
              <p>Instantly identify the most stable, high-yielding, and resilient genotypes.</p>
            </div>
            <div className="about-card">
              <h4>Yield prediction</h4>
              <p>Forecast yields in advance to plan harvests, storage, and sales with confidence.</p>
            </div>
            <div className="about-card">
              <h4>AI agronomy assistant</h4>
              <p>Ask plain-English questions and get evidence-backed recommendations.</p>
            </div>
            <div className="about-card">
              <h4>One-click reporting</h4>
              <p>Export analysis results into a single ZIP of CSVs for reports or stakeholders.</p>
            </div>
          </div>
        </section>

        <section className="about-section">
          <div className="about-section-head">
            <span className="about-kicker">Audience</span>
            <h3>Who uses GenoSense?</h3>
          </div>
          <div className="about-list">
            <div className="about-list-item">Agricultural researchers running crop variety trials</div>
            <div className="about-list-item">Seed companies evaluating genotype performance</div>
            <div className="about-list-item">Large-scale farmers managing field trials</div>
            <div className="about-list-item">Agribusinesses making data-driven procurement decisions</div>
          </div>
        </section>

        <section className="about-section about-section-accent">
          <div className="about-section-head">
            <span className="about-kicker">Value</span>
            <h3>Why GenoSense?</h3>
          </div>
          <div className="about-grid">
            <div className="about-card">
              <h4>Save time</h4>
              <p>Automate weeks of manual analysis into seconds.</p>
            </div>
            <div className="about-card">
              <h4>Reduce risk</h4>
              <p>Replace guesswork with data-backed insights.</p>
            </div>
            <div className="about-card">
              <h4>Accessible</h4>
              <p>Works on any device with a browser. No software installation required.</p>
            </div>
            <div className="about-card">
              <h4>Secure</h4>
              <p>Your data is private, encrypted, and only accessible to your team.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
