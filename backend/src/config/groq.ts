import Groq from 'groq-sdk';

const apiKey = process.env.GROQ_API_KEY;

if (!apiKey) {
  console.warn('WARNING: GROQ_API_KEY is not defined in the environment. AI agents will run in mock mode.');
}

export const groq = new Groq({
  apiKey: apiKey || 'MOCK_KEY',
});

export const isGroqEnabled = () => !!apiKey;
