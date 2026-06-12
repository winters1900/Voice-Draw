import { useEffect, useState } from 'react';
import { useCanvasEngine } from './engine/useCanvasEngine';
import { useDrawController } from './controller/useDrawController';
import { DebugToolbar } from './components/DebugToolbar';
import { CommandConsole } from './components/CommandConsole';
import { VoicePanel } from './components/VoicePanel';

// PR-6：语音(七牛 ASR / 浏览器) → 混合解析 → 绘图执行 的完整链路。
export default function App() {
  const { canvasRef, engine, state } = useCanvasEngine(960, 600);
  const { run, log, busy } = useDrawController(engine.current);
  const [health, setHealth] = useState<{ ok: boolean; qiniuConfigured: boolean } | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setHealth({ ok: d?.ok === true, qiniuConfigured: d?.qiniuConfigured === true }))
      .catch(() => setHealth({ ok: false, qiniuConfigured: false }));
  }, []);

  return (
    <div className="app">
      <header className="app__header">
        <h1>🎙️ AI 语音绘图工具</h1>
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>
          后端：{health === null ? '检测中…' : health.ok ? '已连接 ✓' : '未连接 ✗'}
          {health?.ok && (health.qiniuConfigured ? ' · 七牛已配置' : ' · 未配置密钥(用浏览器识别)')}
        </span>
        <span style={{ color: 'var(--muted)', fontSize: 13, marginLeft: 'auto' }}>
          图形 {state.shapes.length} · 选中 {state.selectedIds.length}
        </span>
      </header>
      <DebugToolbar engine={engine.current} />
      <div className="app__body">
        <div className="canvas-wrap">
          <canvas ref={canvasRef} width={960} height={600} />
        </div>
        <aside className="app__side">
          <VoicePanel run={run} qiniuConfigured={health?.qiniuConfigured ?? false} />
          <CommandConsole run={run} log={log} busy={busy} />
        </aside>
      </div>
    </div>
  );
}
