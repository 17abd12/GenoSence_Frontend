'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = 'http://localhost:8000';
const STORAGE_KEY = 'ai-chat-history';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
};

type ChatResponse = {
  reply: string;
};

export default function AssistantPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<string>('');
  const [authReady, setAuthReady] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as ChatMessage[];
        setMessages(parsed);
      } catch {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const checkAuth = async () => {
      try {
        const res = await fetch(`${API}/auth/me`, { credentials: 'include' });
        if (!cancelled) {
          setIsAuthed(res.ok);
          setAuthReady(true);
        }
      } catch {
        if (!cancelled) {
          setIsAuthed(false);
          setAuthReady(true);
        }
      }
    };
    checkAuth();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadContext = async () => {
      try {
        const res = await fetch(`${API}/temporal/chat-context`);
        if (!res.ok) return;
        const data = (await res.json()) as { context?: string };
        if (!cancelled && data.context) {
          setContext(data.context);
        }
      } catch {
        // Optional context; ignore failures.
      }
    };
    loadContext();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  const historyForApi = useMemo(
    () => messages.slice(-12).map(m => ({ role: m.role, content: m.content })),
    [messages],
  );

  const send = async () => {
    const trimmed = input.trim();
    if (!trimmed || busy || !isAuthed) return;
    const userMsg: ChatMessage = { role: 'user', content: trimmed, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history: historyForApi, context }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ChatResponse;
      const botMsg: ChatMessage = {
        role: 'assistant',
        content: data.reply || 'No response returned.',
        ts: Date.now(),
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const clearSession = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setMessages([]);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(circle at top, #e0f2fe 0%, #f8fafc 45%, #ffffff 100%)',
        color: '#0f172a',
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        padding: '28px 24px 40px',
      }}
    >
      <div
        className="ai-chat-shell"
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'minmax(260px, 1fr) minmax(520px, 2.2fr)',
          gap: 24,
        }}
      >
        <aside
          style={{
            background: '#ffffff',
            borderRadius: 18,
            padding: 20,
            border: '1px solid #e5e7eb',
            boxShadow: '0 16px 40px rgba(15, 23, 42, 0.06)',
            height: 'fit-content',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700 }}>
              AI Chat Assistant
            </div>
            <button
              onClick={() => router.back()}
              style={{
                border: '1px solid #e5e7eb',
                background: '#ffffff',
                borderRadius: 10,
                padding: '6px 10px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                color: '#0f172a',
              }}
            >
              Back
            </button>
          </div>
          <p style={{ marginTop: 6, fontSize: 12, color: '#64748b' }}>
            Ask about genotypes, stability, yield class, and phenotype signals.
          </p>

          <div style={{ marginTop: 18, display: 'grid', gap: 10 }}>
            <div style={{ padding: 12, borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                Status
              </div>
              <div style={{ fontWeight: 600, marginTop: 4 }}>{busy ? 'Thinking…' : 'Ready'}</div>
            </div>
          </div>

          <button
            onClick={clearSession}
            style={{
              marginTop: 18,
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid #e5e7eb',
              background: '#ffffff',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Clear session
          </button>
        </aside>

        <section
          style={{
            background: '#ffffff',
            borderRadius: 18,
            border: '1px solid #e5e7eb',
            boxShadow: '0 16px 40px rgba(15, 23, 42, 0.06)',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 520,
          }}
        >
          {authReady && !isAuthed && (
            <div style={{ background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 10, padding: 16, marginBottom: 12 }}>
              <p style={{ fontSize: 12, color: '#92400e', marginBottom: 10 }}>
                Please sign in to use the AI assistant.
              </p>
              <button onClick={() => router.push('/signin')} style={{ background: '#ffffff', border: '1px solid #fdba74', borderRadius: 8, color: '#92400e', padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Sign in
              </button>
            </div>
          )}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16 }}>
                Chat workspace
              </div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                Session-only history stored in this browser tab.
              </div>
            </div>
            {error && <div style={{ color: '#dc2626', fontSize: 12 }}>Error: {error}</div>}
          </div>

          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px 6px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
              borderRadius: 12,
              border: '1px solid #f1f5f9',
            }}
          >
            {messages.length === 0 && (
              <div style={{ color: '#94a3b8', fontSize: 12 }}>
                Ask the assistant about genotype stability, feature signals, or yield class trends.
              </div>
            )}
            {messages.map((m, idx) => (
              <div
                key={`${m.ts}-${idx}`}
                style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  background: m.role === 'user' ? '#2563eb' : '#f8fafc',
                  color: m.role === 'user' ? '#ffffff' : '#0f172a',
                  padding: '10px 12px',
                  borderRadius: 12,
                  maxWidth: '78%',
                  border: m.role === 'user' ? '1px solid #1d4ed8' : '1px solid #e2e8f0',
                  boxShadow: '0 10px 20px rgba(15, 23, 42, 0.05)',
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                {m.content}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
            <textarea
              value={input}
              onChange={event => setInput(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask about stability, yield class, or feature signals…"
              rows={3}
              style={{
                resize: 'vertical',
                width: '100%',
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                padding: 12,
                fontSize: 13,
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                background: '#ffffff',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>Enter to send, Shift+Enter for new line.</div>
              <button
                onClick={send}
                disabled={busy || !isAuthed}
                style={{
                  padding: '8px 16px',
                  borderRadius: 10,
                  border: '1px solid #1d4ed8',
                  background: busy || !isAuthed ? '#94a3b8' : '#1d4ed8',
                  color: '#ffffff',
                  fontWeight: 600,
                  cursor: busy || !isAuthed ? 'not-allowed' : 'pointer',
                }}
              >
                {busy ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </section>
      </div>
      <style jsx>{`
        .ai-chat-shell {
          align-items: start;
        }
        @media (max-width: 980px) {
          .ai-chat-shell {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
