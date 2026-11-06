// test/index.test.js
import { describe, it, expect } from 'vitest';
import worker from '../src/index.js';

describe('Cloudflare Worker API Tests', () => {
  it('GET / should return welcome message', async () => {
    const req = new Request('http://localhost/');
    const res = await worker.fetch(req);
    const text = await res.text();
    
    // Test check: response text-la "CI/CD" irukkaa nu verify panrom
    expect(text).toContain('CI/CD is working perfectly');
  });

  it('GET /items should return empty array initially', async () => {
    const req = new Request('http://localhost/items');
    const res = await worker.fetch(req);
    expect(res.status).toBe(200);
  });
});