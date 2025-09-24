jest.mock('xss', () => ({
  __esModule: true,
  default: (input: string) =>
    input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;'),
}));

import { sanitizeInput } from '../../src/middlewares/sanitization';

describe('sanitizeInput middleware', () => {
  it('sanitizes strings recursively in body, query, and params', () => {
    const req: any = {
      body: {
        comment: '<script>1</script>',
        nested: {
          value: '<img src=x onerror=alert(1)>',
        },
        list: ['<a href=javascript:evil()>click</a>', 5],
        count: 10,
      },
      query: { search: '<svg/onload=alert(1)>' },
      params: { id: '<div onmouseover=alert(1)></div>' },
    };
    const next = jest.fn();

    sanitizeInput(req, {} as any, next);

    expect(req.body.comment).toBe('&lt;script&gt;1&lt;/script&gt;');
    expect(req.body.nested.value).toContain('&lt;img');
    expect(req.body.nested.value).not.toContain('<');
    expect(req.body.list[0]).toContain('&lt;a');
    expect(req.body.list[0]).not.toContain('<');
    expect(req.body.list[1]).toBe(5);
    expect(req.query.search).toContain('&lt;svg');
    expect(req.query.search).not.toContain('<');
    expect(req.params.id).toContain('&lt;div');
    expect(req.params.id).not.toContain('<');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('leaves falsy segments untouched', () => {
    const req: any = { body: null, query: undefined, params: 0 };
    const next = jest.fn();

    sanitizeInput(req, {} as any, next);

    expect(req.body).toBeNull();
    expect(req.query).toBeUndefined();
    expect(req.params).toBe(0);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('handles top-level arrays and preserves non-string primitives', () => {
    const req: any = {
      body: ['<b>bold</b>', { inner: '<i>tag</i>', count: 42, flag: true }],
      query: {},
      params: { id: 9, extra: false },
    };
    const next = jest.fn();

    sanitizeInput(req, {} as any, next);

    expect(Array.isArray(req.body)).toBe(true);
    expect(req.body[0]).toBe('&lt;b&gt;bold&lt;/b&gt;');
    expect(req.body[1].inner).toBe('&lt;i&gt;tag&lt;/i&gt;');
    expect(req.body[1].count).toBe(42);
    expect(req.body[1].flag).toBe(true);
    expect(req.params.id).toBe(9);
    expect(req.params.extra).toBe(false);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
