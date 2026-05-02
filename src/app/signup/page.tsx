'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API = 'http://localhost:8000';

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Sign up failed');
      }
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <div style={{ background: '#ffffff', borderBottom: '1px solid #e5e7eb', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: '#0f172a', fontSize: 15 }}>Create account</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>Save uploads and analysis history</div>
        </div>
        <button onClick={() => router.push('/')} style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8, color: '#0f172a', padding: '7px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          Home
        </button>
      </div>

      <div style={{ maxWidth: 420, margin: '0 auto', padding: '40px 20px' }}>
        <div style={{ background: '#ffffff', borderRadius: 16, padding: 28, border: '1px solid #e5e7eb', boxShadow: '0 12px 32px rgba(15, 23, 42, 0.08)' }}>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
              Name
              <input
                type="text"
                value={name}
                onChange={event => setName(event.target.value)}
                required
                style={{ display: 'block', width: '100%', marginTop: 6, border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', fontSize: 13 }}
              />
            </label>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
              Email
              <input
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                required
                style={{ display: 'block', width: '100%', marginTop: 6, border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', fontSize: 13 }}
              />
            </label>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
              Password
              <input
                type="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                required
                minLength={6}
                style={{ display: 'block', width: '100%', marginTop: 6, border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', fontSize: 13 }}
              />
            </label>

            {error && <div style={{ color: '#dc2626', fontSize: 12 }}>{error}</div>}

            <button
              type="submit"
              disabled={busy}
              style={{
                marginTop: 4,
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid #1d4ed8',
                background: busy ? '#94a3b8' : '#1d4ed8',
                color: '#ffffff',
                fontWeight: 600,
                cursor: busy ? 'not-allowed' : 'pointer',
              }}
            >
              {busy ? 'Creating...' : 'Create account'}
            </button>
          </form>

          <div style={{ marginTop: 14, fontSize: 12, color: '#64748b' }}>
            Already have an account?{' '}
            <button
              onClick={() => router.push('/signin')}
              style={{ border: 'none', background: 'transparent', color: '#2563eb', fontWeight: 600, cursor: 'pointer', padding: 0 }}
            >
              Sign in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
