import { useState } from 'react';
import type { LogEntry } from '../controller/useDrawController';
import type { ParseSource } from '../parser/CommandRouter';

const SOURCE_LABEL: Record<ParseSource, string> = {
  rule: '规则',
  llm: 'AI',
  'llm-fallback-rule': 'AI→规则',
};

interface Props {
  run: (text: string, via?: 'text' | 'voice') => Promise<string>;
  log: LogEntry[];
  busy: boolean;
}

// 指令日志 + 文字输入（演示与无麦环境的备用入口）。执行逻辑统一在 useDrawController。
export function CommandConsole({ run, log, busy }: Props) {
  const [text, setText] = useState('');

  const submit = () => {
    const t = text.trim();
    if (!t || busy) return;
    setText('');
    void run(t, 'text');
  };

  const samples = ['画一个红色的圆', '画三个蓝色的圆排成一行', '在左上角写标题', '把它变成绿色', '放大一点', '撤销'];

  return (
    <div className="console">
      <div className="console__input">
        <input
          value={text}
          placeholder="输入绘图指令，如「画三个红色的圆排成一行」"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <button onClick={submit} disabled={busy}>{busy ? '…' : '执行'}</button>
      </div>
      <div className="console__samples">
        {samples.map((s) => (
          <button key={s} onClick={() => setText(s)}>{s}</button>
        ))}
      </div>
      <div className="console__log">
        {log.length === 0 && <div className="console__hint">点击麦克风说话，或在上方输入指令。</div>}
        {log.map((e) => (
          <div key={e.id} className="console__entry">
            <div className="console__cmd">
              <span>{e.via === 'voice' ? '🎤' : '▸'} {e.text}</span>
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
