import { useEffect, useState } from 'react';
import { useCanvasEngine } from './engine/useCanvasEngine';
import { useDrawController } from './controller/useDrawController';
import { useSpeech } from './voice/useSpeech';
import { DebugToolbar } from './components/DebugToolbar';
import { CommandConsole } from './components/CommandConsole';
import { VoicePanel } from './components/VoicePanel';
import { HelpOverlay } from './components/HelpOverlay';

// 完整闭环：语音(七牛 ASR / 浏览器) → 混合解析 → 绘图执行 → 语音反馈(TTS)。
export default function App() {
  const { canvasRef, engine, state } = useCanvasEngine(960, 600);
  const [health, setHealth] = useState<{ ok: boolean; qiniuConfigured: boolean } | null>(null);
  const speech = useSpeech(health?.qiniuConfigured ?? false);
  const { run, log, busy } = useDrawController(engine.current, speech.speakFeedback);
  const [showHelp, setShowHelp] = useState(false);

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
        <span className="app__status">
          后端：{health === null ? '检测中…' : health.ok ? '已连接 ✓' : '未连接 ✗'}
          {health?.ok && (health.qiniuConfigured ? ' · 七牛已配置' : ' · 未配置密钥(用浏览器识别)')}
        </span>
        <div className="app__header-right">
          <span className="app__status">图形 {state.shapes.length} · 选中 {state.selectedIds.length}</span>
          <button className="app__help-btn" onClick={() => setShowHelp(true)}>❓ 指令帮助</button>
        </div>
      </header>

      {import.meta.env.DEV && <DebugToolbar engine={engine.current} />}

      <div className="app__body">
        <div className="canvas-wrap">
          <canvas ref={canvasRef} width={960} height={600} />
        </div>
        <aside className="app__side">
          <VoicePanel
            run={run}
            qiniuConfigured={health?.qiniuConfigured ?? false}
            ttsEnabled={speech.enabled}
            onToggleTts={speech.toggle}
          />
          <CommandConsole run={run} log={log} busy={busy} />
        </aside>
      </div>

      {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}
    </div>
  );
}
