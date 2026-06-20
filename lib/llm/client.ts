import Anthropic from '@anthropic-ai/sdk';

let _client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not set');
    }
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

export function isLlmAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export async function callClaude(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 4096
): Promise<string> {
  const client = getAnthropicClient();
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });
  const block = msg.content[0];
  if (block.type !== 'text') throw new Error('Unexpected LLM response type');
  return block.text;
}
