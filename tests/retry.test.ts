import { retry } from '../src/utils/retry';

describe('retry utility', () => {
  it('resolves on first attempt', async () => {
    const result = await retry(() => Promise.resolve(42), 3, 10);
    expect(result).toBe(42);
  });

  it('retries on failure and eventually resolves', async () => {
    let attempts = 0;
    const result = await retry(() => { attempts++; if (attempts < 3) throw new Error('fail'); return Promise.resolve('ok'); }, 5, 10);
    expect(result).toBe('ok');
    expect(attempts).toBe(3);
  });

  it('throws after all retries exhausted', async () => {
    await expect(retry(() => Promise.reject(new Error('always fail')), 3, 10)).rejects.toThrow('always fail');
  });

  it('supports RetryOptions configuration object and onRetry callback', async () => {
    let count = 0;
    const onRetryCalls: Array<{ attempt: number; error: unknown }> = [];
    const result = await retry(
      async (attempt) => {
        count++;
        if (attempt < 2) throw new Error(`error-${attempt}`);
        return 'success';
      },
      {
        attempts: 3,
        delayMs: 1,
        onRetry: (attempt, error) => onRetryCalls.push({ attempt, error }),
      },
    );

    expect(result).toBe('success');
    expect(count).toBe(2);
    expect(onRetryCalls.length).toBe(1);
    expect(onRetryCalls[0].attempt).toBe(1);
    expect((onRetryCalls[0].error as Error).message).toBe('error-1');
  });

  it('supports custom delay strategy function', async () => {
    const delayFn = jest.fn((attempt: number) => attempt * 2);
    let attempts = 0;

    const result = await retry(
      async () => {
        attempts++;
        if (attempts < 3) throw new Error('delay-test');
        return 'done';
      },
      {
        attempts: 3,
        delayMs: delayFn,
      },
    );

    expect(result).toBe('done');
    expect(attempts).toBe(3);
    expect(delayFn).toHaveBeenCalledWith(1);
    expect(delayFn).toHaveBeenCalledWith(2);
  });
});

describe('retry validation and onRetry semantics', () => {
  it.each([0, -1, 1.5, NaN, Infinity])('rejects invalid attempts %p without calling fn', async (n) => {
    const fn = jest.fn().mockResolvedValue('x');
    await expect(retry(fn, n)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(fn).not.toHaveBeenCalled();
  });

  it('rejects a non-finite or negative numeric delayMs', async () => {
    const fn = jest.fn().mockResolvedValue('x');
    await expect(retry(fn, 2, -5)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(retry(fn, { attempts: 2, delayMs: NaN })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(fn).not.toHaveBeenCalled();
  });

  it('keeps the operation error and all attempts when onRetry throws', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('real failure'));
    await expect(
      retry(fn, {
        attempts: 3,
        delayMs: 1,
        onRetry: () => {
          throw new Error('logger crashed');
        },
      }),
    ).rejects.toThrow('real failure');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('reports willRetry and delayMs to onRetry when all attempts fail', async () => {
    const calls: Array<[number, { willRetry: boolean; delayMs: number }]> = [];
    await expect(
      retry(() => Promise.reject(new Error('nope')), {
        attempts: 3,
        delayMs: 2,
        onRetry: (attempt, _err, info) => calls.push([attempt, info]),
      }),
    ).rejects.toThrow('nope');
    expect(calls).toEqual([
      [1, { willRetry: true, delayMs: 2 }],
      [2, { willRetry: true, delayMs: 4 }],
      [3, { willRetry: false, delayMs: 0 }],
    ]);
  });

  it('passes the strategy function delay to onRetry', async () => {
    const delays: number[] = [];
    await expect(
      retry(() => Promise.reject(new Error('nope')), {
        attempts: 2,
        delayMs: () => 3,
        onRetry: (_a, _e, info) => delays.push(info.delayMs),
      }),
    ).rejects.toThrow('nope');
    expect(delays).toEqual([3, 0]);
  });
});
