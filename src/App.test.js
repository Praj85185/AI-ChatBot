import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App, { askLLM, MODELS, API_KEY } from './App';

describe('AI Chatbot & askLLM', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('renders AI Chatbot interface', () => {
    render(<App />);
    expect(screen.getByText(/AI Chatbot/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ask a question/i)).toBeInTheDocument();
  });

  test('askLLM returns answer from the first working model', async () => {
    global.fetch.mockResolvedValueOnce({
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: 'Docker is a containerization platform.' }],
            },
          },
        ],
      }),
    });

    const result = await askLLM('What is Docker?');
    expect(result).toBe('Docker is a containerization platform.');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODELS[0]}:generateContent?key=${API_KEY}`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'What is Docker?' }] }],
        }),
      })
    );
  });

  test('askLLM falls back to subsequent models when earlier models fail', async () => {
    global.fetch
      .mockResolvedValueOnce({ status: 404 })
      .mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: 'Fallback model answer' }],
              },
            },
          ],
        }),
      });

    const result = await askLLM('What is Docker?');
    expect(result).toBe('Fallback model answer');
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch.mock.calls[1][0]).toContain(MODELS[1]);
  });

  test('sending a message displays user question and AI answer', async () => {
    global.fetch.mockResolvedValueOnce({
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: 'Docker packages applications into containers.' }],
            },
          },
        ],
      }),
    });

    render(<App />);
    const input = screen.getByPlaceholderText(/Ask a question/i);
    fireEvent.change(input, { target: { value: 'What is Docker?' } });
    fireEvent.click(screen.getByRole('button', { name: /Send/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Docker packages applications into containers.')
      ).toBeInTheDocument();
    });
  });
});
