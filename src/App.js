import React, { useState, useRef, useEffect } from 'react';
import './App.css';

export const API_KEY = process.env.REACT_APP_API_KEY || '';

export const MODELS = [
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
];

export async function askLLM(question) {
  const payload = {
    contents: [{ parts: [{ text: question }] }],
  };

  let lastError = null;

  for (const model of MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.status === 200) {
        const data = await response.json();
        return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }

      lastError = new Error(`Model ${model} failed with status ${response.status}`);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('All models failed to respond.');
}

const STARTER_PROMPTS = [
  {
    title: 'What is Docker?',
    subtitle: 'Containerization & how it compares to VMs',
    tag: 'DevOps',
  },
  {
    title: 'Explain React Hooks',
    subtitle: 'How useState and useEffect work with examples',
    tag: 'Frontend',
  },
  {
    title: 'Design a REST API',
    subtitle: 'Best practices for endpoints, auth & status codes',
    tag: 'Backend',
  },
  {
    title: 'SQL vs NoSQL Databases',
    subtitle: 'When to choose relational vs document stores',
    tag: 'Architecture',
  },
];

function formatInlineText(text) {
  const parts = text.split(/(\*\*.*?\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={idx}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={idx} className="inline-code">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function FormattedMessage({ text, onCopy }) {
  const segments = String(text || '').split(/(```[\s\S]*?```)/g);

  return (
    <div className="formatted-content">
      {segments.map((segment, index) => {
        if (segment.startsWith('```') && segment.endsWith('```')) {
          const raw = segment.slice(3, -3).trim();
          const firstNewLine = raw.indexOf('\n');
          const lang =
            firstNewLine !== -1 && !raw.slice(0, firstNewLine).includes(' ')
              ? raw.slice(0, firstNewLine).trim()
              : 'code';
          const code =
            firstNewLine !== -1 && lang !== 'code'
              ? raw.slice(firstNewLine + 1)
              : raw;

          return (
            <div key={index} className="code-block">
              <div className="code-block-header">
                <span className="code-lang">{lang}</span>
                <button
                  type="button"
                  className="code-copy-btn"
                  onClick={() => onCopy(code)}
                >
                  Copy code
                </button>
              </div>
              <pre>
                <code>{code}</code>
              </pre>
            </div>
          );
        }

        const paragraphs = segment
          .split('\n\n')
          .map((p) => p.trim())
          .filter(Boolean);

        return paragraphs.map((para, pIdx) => {
          const lines = para.split('\n');
          const isList = lines.every((l) => /^(\*|-|\d+\.)\s+/.test(l.trim()));

          if (isList) {
            return (
              <ul key={`${index}-${pIdx}`} className="message-list">
                {lines.map((line, lIdx) => (
                  <li key={lIdx}>
                    {formatInlineText(line.replace(/^(\*|-|\d+\.)\s+/, ''))}
                  </li>
                ))}
              </ul>
            );
          }

          return (
            <p key={`${index}-${pIdx}`} className="message-paragraph">
              {formatInlineText(para)}
            </p>
          );
        });
      })}
    </div>
  );
}

function App() {
  const [sessions, setSessions] = useState([
    {
      id: 'session-default',
      title: 'New Conversation',
      messages: [
        {
          id: 'welcome',
          role: 'assistant',
          text: 'Hello! Ask me anything to get started.',
          time: 'Just now',
        },
      ],
    },
  ]);
  const [activeSessionId, setActiveSessionId] = useState('session-default');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const messagesEndRef = useRef(null);

  const activeSession =
    sessions.find((s) => s.id === activeSessionId) || sessions[0];
  const messages = activeSession.messages;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages, loading]);

  const formatTime = () => {
    try {
      return new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Now';
    }
  };

  const handleCopy = (text, id = 'code') => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleNewChat = () => {
    if (loading) return;
    const newId = `session-${Date.now()}`;
    const newSession = {
      id: newId,
      title: 'New Conversation',
      messages: [
        {
          id: 'welcome',
          role: 'assistant',
          text: 'Hello! Ask me anything to get started.',
          time: formatTime(),
        },
      ],
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newId);
    setError('');
    setInput('');
  };

  const handleClearCurrent = () => {
    if (loading) return;
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSession.id
          ? {
              ...s,
              title: 'New Conversation',
              messages: [
                {
                  id: 'welcome',
                  role: 'assistant',
                  text: 'Hello! Ask me anything to get started.',
                  time: formatTime(),
                },
              ],
            }
          : s
      )
    );
    setError('');
  };

  const sendQuestion = async (rawQuestion) => {
    const question = rawQuestion.trim();
    if (!question || loading) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: question,
      time: formatTime(),
    };

    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== activeSession.id) return s;
        const isFirstUserMsg = !s.messages.some((m) => m.role === 'user');
        return {
          ...s,
          title: isFirstUserMsg ? question.slice(0, 34) : s.title,
          messages: [...s.messages, userMsg],
        };
      })
    );

    setInput('');
    setError('');
    setLoading(true);

    try {
      const answer = await askLLM(question);
      const botMsg = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        text: answer || 'No response received.',
        time: formatTime(),
      };
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSession.id
            ? { ...s, messages: [...s.messages, botMsg] }
            : s
        )
      );
    } catch (err) {
      setError(err.message || 'Failed to fetch response.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendQuestion(input);
  };

  const hasUserMessages = messages.some((m) => m.role === 'user');

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'collapsed'}`}>
        <div className="sidebar-brand">
          <div className="brand-logo" aria-hidden="true">
            ✦
          </div>
          <div className="brand-text">
            <span className="brand-title">AI Assistant</span>
            <span className="brand-subtitle">Workspace</span>
          </div>
        </div>

        <button
          type="button"
          className="new-chat-btn"
          onClick={handleNewChat}
          disabled={loading}
        >
          <span>+</span> New Chat
        </button>

        <div className="sidebar-section-label">Recent Chats</div>
        <div className="session-list">
          {sessions.map((session) => (
            <button
              key={session.id}
              type="button"
              className={`session-item ${
                session.id === activeSession.id ? 'active' : ''
              }`}
              onClick={() => {
                setActiveSessionId(session.id);
                setError('');
              }}
            >
              <span className="session-icon">💬</span>
              <span className="session-title">{session.title}</span>
            </button>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="status-indicator">
            <span className="status-dot" />
            <span>System Online</span>
          </div>
        </div>
      </aside>

      <div className="chat-app">
        <header className="chat-header">
          <div className="header-left">
            <button
              type="button"
              className="sidebar-toggle-btn"
              onClick={() => setSidebarOpen((prev) => !prev)}
              aria-label="Toggle sidebar"
            >
              ☰
            </button>
            <div className="header-titles">
              <h1>AI Chatbot</h1>
            </div>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="clear-chat-btn"
              onClick={handleClearCurrent}
              disabled={loading}
            >
              Clear Chat
            </button>
          </div>
        </header>

        <main className="chat-messages" aria-live="polite">
          {!hasUserMessages && (
            <section className="hero-welcome">
              <div className="hero-icon">✦</div>
              <h2>How can I help you today?</h2>
              <p>
                Ask technical questions, generate code, or explore concepts.
              </p>
              <div className="starter-grid">
                {STARTER_PROMPTS.map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    className="starter-card"
                    onClick={() => sendQuestion(item.title)}
                    disabled={loading}
                  >
                    <span className="starter-tag">{item.tag}</span>
                    <strong>{item.title}</strong>
                    <span>{item.subtitle}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`message-row ${msg.role}`}>
              <div className="message-avatar">
                {msg.role === 'user' ? 'You' : 'AI'}
              </div>
              <div className="message-content-wrapper">
                <div className="message-meta">
                  <span className="message-author">
                    {msg.role === 'user' ? 'You' : 'Assistant'}
                  </span>
                  {msg.time && <span className="message-time">{msg.time}</span>}
                </div>
                <div className="message-bubble">
                  <FormattedMessage
                    text={msg.text}
                    onCopy={(code) => handleCopy(code, msg.id)}
                  />
                </div>
                {msg.role === 'assistant' && msg.id !== 'welcome' && (
                  <div className="message-toolbar">
                    <button
                      type="button"
                      className="toolbar-btn"
                      onClick={() => handleCopy(msg.text, msg.id)}
                    >
                      {copiedId === msg.id ? '✓ Copied' : 'Copy response'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="message-row assistant">
              <div className="message-avatar">AI</div>
              <div className="message-content-wrapper">
                <div className="message-meta">
                  <span className="message-author">Assistant</span>
                  <span className="message-time">Generating...</span>
                </div>
                <div className="message-bubble thinking-bubble">
                  <div className="typing-dots" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                  <span>Thinking...</span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="error-banner" role="alert">
              <div className="error-text">
                <strong>Request failed:</strong> {error}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </main>

        <footer className="chat-footer">
          <form className="chat-input-form" onSubmit={handleSubmit}>
            <div className="input-container">
              <input
                type="text"
                className="chat-input"
                placeholder="Ask a question (e.g., What is Docker?)..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading}
                aria-label="Question input"
              />
              <button
                type="submit"
                className="send-btn"
                disabled={loading || !input.trim()}
              >
                {loading ? 'Sending...' : 'Send'}
              </button>
            </div>
          </form>
        </footer>
      </div>
    </div>
  );
}

export default App;
