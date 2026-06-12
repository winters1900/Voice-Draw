import { useEffect, useState } from 'react';
import { useCanvasEngine } from './engine/useCanvasEngine';
import { DebugToolbar } from './components/DebugToolbar';

// PR-1：挂载 Canvas 绘图引擎，并提供调试工具栏验证渲染/历史/变换。
// 语音控制与指令解析将在后续 PR 接入。
export default function App() {
  const { canvasRef, engine, state } = useCanvasEngine(960, 600);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setBackendOk(d?.ok === true))
      .catch(() => setBackendOk(false));
  }, []);

  return (
    <div className="app">
      <header className="app__header">
        <h1>🎙️ AI 语音绘图工具</h1>
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>
          后端：{backendOk === null ? '检测中…' : backendOk ? '已连接 ✓' : '未连接 ✗'}
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
      </div>
    </div>
  );
}
