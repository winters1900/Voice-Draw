import { useCallback, useMemo, useRef, useState } from 'react';
import { CanvasEngine } from '../engine/CanvasEngine';
import { CommandExecutor } from '../executor/CommandExecutor';
import { routeCommand, type ParseSource } from '../parser/CommandRouter';

export interface LogEntry {
  id: number;
  text: string;
  via: 'text' | 'voice';
  source: ParseSource;
  ms: number;
  results: { ok: boolean; message: string }[];
}

/**
 * 绘图控制器：文字与语音输入的统一执行入口。
 * run(text) = 混合解析(routeCommand) → 执行器落地 → 追加日志，并返回反馈文案（供 TTS 播报）。
 */
export function useDrawController(engine: CanvasEngine | null) {
  const executor = useMemo(() => (engine ? new CommandExecutor(engine) : null), [engine]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  const run = useCallback(
    async (text: string, via: 'text' | 'voice' = 'text'): Promise<string> => {
      const t = text.trim();
      if (!t || !executor) return '';
      setBusy(true);
      try {
        const { commands, source, ms } = await routeCommand(t);
        const outcomes = executor.executeAll(commands);
        const results = outcomes.map((r) => ({ ok: r.ok, message: r.message }));
        setLog((prev) => [{ id: seq.current++, text: t, via, source, ms, results }, ...prev].slice(0, 20));
        return results.map((r) => r.message).join('；');
      } finally {
        setBusy(false);
      }
    },
    [executor],
  );

  return { run, log, busy };
}
