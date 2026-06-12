import { useEffect, useRef, useState } from 'react';
import { CanvasEngine, type EngineState } from './CanvasEngine';

/**
 * 把 CanvasEngine 接入 React：返回 canvas ref、引擎实例与其响应式状态。
 * 引擎本身是命令式的，这里只负责生命周期与状态镜像，供 UI 渲染。
 */
export function useCanvasEngine(width: number, height: number) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CanvasEngine | null>(null);
  const [state, setState] = useState<EngineState>({ shapes: [], selectedIds: [] });

  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = new CanvasEngine(canvasRef.current);
    engineRef.current = engine;
    const unsub = engine.subscribe(setState);
    setState(engine.getState());
    return () => {
      unsub();
      engineRef.current = null;
    };
  }, []);

  return { canvasRef, engine: engineRef, state, width, height };
}
