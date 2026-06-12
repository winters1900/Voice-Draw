import { useMemo, useState } from 'react';
import { CanvasEngine } from '../engine/CanvasEngine';
import { CommandExecutor } from '../executor/CommandExecutor';
import { routeCommand, type ParseSource } from '../parser/CommandRouter';

interface LogEntry {
  id: number;
  text: string;
  source: ParseSource;
  ms: number;
  results: { ok: boolean; message: string }[];
}

const SOURCE_LABEL: Record<ParseSource, string> = {
  rule: '规则',
  llm: 'AI',
  'llm-fallback-rule': 'AI→规则',
};

// 文字指令控制台：用本地规则解析 + 执行器跑通“指令→绘图”链路。
// 语音输入(PR-6)最终会复用同一条 run() 通路。
export function CommandConsole({ engine }: { engine: CanvasEngine | null }) {
  const executor = useMemo(() => (engine ? new CommandExecutor(engine) : null), [engine]);
  const [text, setText] = useState('');
  const [log, setLog] = useState<LogEntry[]>([]);
  const [seq, setSeq] = useState(0);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    const t = text.trim();
    if (!t || !executor || busy) return;
    setText('');
    setBusy(true);
    try {
      const { commands, source, ms } = await routeCommand(t);
      const results = executor.executeAll(commands).map((r) => ({ ok: r.ok, message: r.message }));
      setLog((prev) => [{ id: seq, text: t, source, ms, results }, ...prev].slice(0, 12));
      setSeq((s) => s + 1);
    } finally {
      setBusy(false);
    }
  };

  const samples = ['画一个红色的圆', '画三个蓝色的圆排成一行', '在左上角写标题', '把它变成绿色', '放大一点', '撤销'];

  return (
    <div className="console">
      <div className="console__input">
        <input
          value={text}
          placeholder="输入绘图指令，如「画三个红色的圆排成一行」"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
        />
        <button onClick={run} disabled={busy}>{busy ? '…' : '执行'}</button>
      </div>
      <div className="console__samples">
        {samples.map((s) => (
          <button key={s} onClick={() => setText(s)}>{s}</button>
        ))}
      </div>
      <div className="console__log">
        {log.length === 0 && <div className="console__hint">试试上面的示例指令，或直接输入。</div>}
        {log.map((e) => (
          <div key={e.id} className="console__entry">
            <div className="console__cmd">
              ▸ {e.text}
              <span className="console__badge">{SOURCE_LABEL[e.source]} · {e.ms}ms</span>
            </div>
            {e.results.map((r, i) => (
              <div key={i} className={r.ok ? 'console__ok' : 'console__fail'}>
                {r.ok ? '✓' : '✗'} {r.message}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
