// CommandRouter —— 混合解析编排（延迟 vs 容错的核心折中）。
// 1) 先走本地规则(parseWithRules)，命中即返回，零网络延迟；
// 2) 未命中则 fallback 到后端 /api/parse 交七牛 LLM；
// 3) LLM 失败/超时再退回规则产出的结果，保证永远有可执行/可反馈的输出。

import { isValidCommand, type DrawCommand } from '@shared/commands';
import { parseWithRules } from './RuleParser';

export type ParseSource = 'rule' | 'llm' | 'llm-fallback-rule';

export interface RouteResult {
  commands: DrawCommand[];
  source: ParseSource;
  ms: number;
}

export interface RouterOptions {
  /** 注入 fetch 便于测试；默认用全局 fetch。 */
  fetchImpl?: typeof fetch;
  /** LLM 解析端点。 */
  endpoint?: string;
}

export async function routeCommand(text: string, opts: RouterOptions = {}): Promise<RouteResult> {
  const t0 = now();
  const rule = parseWithRules(text);
  if (rule.matched) {
    return { commands: rule.commands, source: 'rule', ms: round(now() - t0) };
  }

  const doFetch = opts.fetchImpl ?? globalThis.fetch;
  const endpoint = opts.endpoint ?? '/api/parse';
  try {
    const resp = await doFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!resp.ok) throw new Error(`parse HTTP ${resp.status}`);
    const data = (await resp.json()) as { commands?: unknown };
    const commands = sanitize(data.commands);
    if (commands.length) return { commands, source: 'llm', ms: round(now() - t0) };
    // LLM 没产出有效命令：退回规则结果（通常是 unknown，用于语音追问）
    return { commands: ensureNonEmpty(rule.commands, text), source: 'llm-fallback-rule', ms: round(now() - t0) };
  } catch {
    return { commands: ensureNonEmpty(rule.commands, text), source: 'llm-fallback-rule', ms: round(now() - t0) };
  }
}

function sanitize(raw: unknown): DrawCommand[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isValidCommand);
}

function ensureNonEmpty(cmds: DrawCommand[], text: string): DrawCommand[] {
  const valid = cmds.filter(isValidCommand);
  return valid.length ? valid : [{ op: 'unknown', raw: text, reason: '未能理解该指令' }];
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}
function round(n: number): number {
  return Math.round(n * 10) / 10;
}
