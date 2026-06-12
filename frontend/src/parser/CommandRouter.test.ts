import { describe, expect, it, vi } from 'vitest';
import { routeCommand } from './CommandRouter';

describe('CommandRouter 混合编排', () => {
  it('规则命中时不调用 LLM', async () => {
    const fetchImpl = vi.fn();
    const r = await routeCommand('画一个红色的圆', { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(r.source).toBe('rule');
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(r.commands[0]).toMatchObject({ op: 'create', shape: 'circle' });
  });

  it('规则未命中时 fallback 到 LLM', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ commands: [{ op: 'create', shape: 'arrow' }] }),
    })) as unknown as typeof fetch;
    const r = await routeCommand('给我来点抽象的东西', { fetchImpl });
    expect(r.source).toBe('llm');
    expect(r.commands[0]).toMatchObject({ op: 'create', shape: 'arrow' });
  });

  it('LLM 网络异常时退回规则结果(unknown)', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    const r = await routeCommand('胡言乱语一通', { fetchImpl });
    expect(r.source).toBe('llm-fallback-rule');
    expect(r.commands[0].op).toBe('unknown');
  });

  it('过滤 LLM 返回的非法命令', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ commands: [{ op: 'bogus' }, { op: 'undo' }] }),
    })) as unknown as typeof fetch;
    const r = await routeCommand('随便什么复杂句子触发llm', { fetchImpl });
    expect(r.commands).toEqual([{ op: 'undo' }]);
  });
});
