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

function App() {
  const [messages, setMessages] = useState([
    { id: 'welcome', role: 'assistant', text: 'Hello! Ask me anything.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: 'user', text: question },
    ]);
    setInput('');
    setError('');
    setLoading(true);

    try {
      const answer = await askLLM(question);
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          role: 'assistant',
          text: answer || 'No response received.',
        },
      ]);
    } catch (err) {
      setError(err.message || 'Failed to fetch response.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-app">
      <header className="chat-header">
        <h1>AI Chatbot</h1>
      </header>

      <main className="chat-messages" aria-live="polite">
        {messages.map((msg) => (
          <div key={msg.id} className={`message-row ${msg.role}`}>
            <div className="message-avatar">
              {msg.role === 'user' ? 'You' : 'AI'}
            </div>
            <div className="message-bubble">{msg.text}</div>
          </div>
        ))}

        {loading && (
          <div className="message-row assistant">
            <div className="message-avatar">AI</div>
            <div className="message-bubble">Thinking...</div>
          </div>
        )}

        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      <form className="chat-input-form" onSubmit={handleSubmit}>
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
      </form>
    </div>
  );
}

export default App;
