const { formatMessage, outreachQueue } = require('../lib/queue');

afterAll(async () => {
  await outreachQueue.close();
});

describe('Message Template Formatter Utility', () => {
  test('should replace double bracket lead name variable with actual value', () => {
    const template = 'Hello {{name}}, welcome to {{company}}!';
    const lead = { name: 'Alice', company: 'Nexcure' };
    const result = formatMessage(template, lead);
    expect(result).toBe('Hello Alice, welcome to Nexcure!');
  });

  test('should handle missing fields gracefully and output empty string', () => {
    const template = 'Buying {{quantity}} units of {{product}}';
    const lead = { product: 'Sildenafil' };
    const result = formatMessage(template, lead);
    expect(result).toBe('Buying  units of Sildenafil');
  });
});
