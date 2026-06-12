import { beforeEach, describe, expect, it } from 'vitest';
import { CanvasEngine } from '../engine/CanvasEngine';
import { __resetIdSeq } from '../engine/shapes';
import { CommandExecutor } from './CommandExecutor';
import type { DrawCommand } from '@shared/commands';

// Node 环境无 DOM，这里用 Proxy 伪造一个 2D 上下文（所有方法均为 no-op），
// 让引擎可在测试中实例化而无需真实 canvas。
function makeEngine(w = 960, h = 600) {
  const ctx = new Proxy({}, { get: () => () => {} }) as unknown as CanvasRenderingContext2D;
  const canvas = {
    width: w,
    height: h,
    getContext: () => ctx,
    toDataURL: () => 'data:image/png;base64,xxx',
  } as unknown as HTMLCanvasElement;
  return new CanvasEngine(canvas);
}

function setup() {
  const engine = makeEngine();
  const exec = new CommandExecutor(engine);
  return { engine, exec };
}

beforeEach(() => __resetIdSeq());

describe('create', () => {
  it('画一个红色圆形：补全默认尺寸并解析颜色', () => {
    const { engine, exec } = setup();
    const r = exec.execute({ op: 'create', shape: 'circle', props: { color: '红色' } });
    const { shapes } = engine.getState();
    expect(shapes).toHaveLength(1);
    expect(shapes[0].type).toBe('circle');
    expect(shapes[0].color).toBe('#e23b3b');
    expect(shapes[0].r).toBeGreaterThan(0);
    expect(r.message).toContain('圆形');
  });

  it('画三个圆排成一行：数量与横向排布', () => {
    const { engine, exec } = setup();
    exec.execute({ op: 'create', shape: 'circle', count: 3, layout: 'row' });
    const { shapes } = engine.getState();
    expect(shapes).toHaveLength(3);
    const ys = new Set(shapes.map((s) => Math.round(s.y)));
    expect(ys.size).toBe(1); // 同一行 y 相同
    const xs = shapes.map((s) => s.x);
    expect(xs[0]).toBeLessThan(xs[1]);
    expect(xs[1]).toBeLessThan(xs[2]);
  });

  it('sizeScale 放大默认尺寸', () => {
    const { engine, exec } = setup();
    exec.execute({ op: 'create', shape: 'circle' });
    const base = engine.getState().shapes[0].r!;
    engine.clear();
    exec.execute({ op: 'create', shape: 'circle', props: { sizeScale: 2 } });
    expect(engine.getState().shapes[0].r!).toBeCloseTo(base * 2);
  });

  it('批量创建是单一可撤销单元', () => {
    const { engine, exec } = setup();
    exec.execute({ op: 'create', shape: 'rect', count: 4 });
    expect(engine.getState().shapes).toHaveLength(4);
    engine.undo();
    expect(engine.getState().shapes).toHaveLength(0);
  });
});

describe('指代与变换', () => {
  it('byType 选中所有圆', () => {
    const { engine, exec } = setup();
    exec.execute({ op: 'create', shape: 'circle' });
    exec.execute({ op: 'create', shape: 'rect' });
    exec.execute({ op: 'create', shape: 'circle' });
    const r = exec.execute({ op: 'select', target: { kind: 'byType', shape: 'circle' } });
    expect(r.ok).toBe(true);
    expect(engine.getState().selectedIds).toHaveLength(2);
  });

  it('recolor 作用于当前选中', () => {
    const { engine, exec } = setup();
    exec.execute({ op: 'create', shape: 'rect' }); // 新建即选中
    exec.execute({ op: 'recolor', color: '蓝色' });
    expect(engine.getState().shapes[0].color).toBe('#2f7be2');
  });

  it('byIndex 选中第 2 个（1-based）', () => {
    const { engine, exec } = setup();
    exec.execute({ op: 'create', shape: 'circle' });
    exec.execute({ op: 'create', shape: 'rect' });
    exec.execute({ op: 'select', target: { kind: 'byIndex', index: 2 } });
    const sel = engine.getState().selectedIds;
    expect(sel).toHaveLength(1);
    const target = engine.getState().shapes.find((s) => s.id === sel[0]);
    expect(target?.type).toBe('rect');
  });

  it('删除最后一个', () => {
    const { engine, exec } = setup();
    exec.execute({ op: 'create', shape: 'circle' });
    exec.execute({ op: 'create', shape: 'rect' });
    exec.execute({ op: 'delete', target: { kind: 'last' } });
    const { shapes } = engine.getState();
    expect(shapes).toHaveLength(1);
    expect(shapes[0].type).toBe('circle');
  });

  it('move 方向+距离', () => {
    const { engine, exec } = setup();
    exec.execute({ op: 'create', shape: 'circle' });
    const x0 = engine.getState().shapes[0].x;
    exec.execute({ op: 'move', direction: 'right', distance: 100 });
    expect(engine.getState().shapes[0].x).toBeCloseTo(x0 + 100);
  });
});

describe('全局命令与容错', () => {
  it('undo/redo 往返', () => {
    const { engine, exec } = setup();
    exec.execute({ op: 'create', shape: 'circle' });
    exec.execute({ op: 'undo' });
    expect(engine.getState().shapes).toHaveLength(0);
    exec.execute({ op: 'redo' });
    expect(engine.getState().shapes).toHaveLength(1);
  });

  it('clear 清空', () => {
    const { engine, exec } = setup();
    exec.execute({ op: 'create', shape: 'circle', count: 3 });
    exec.execute({ op: 'clear' });
    expect(engine.getState().shapes).toHaveLength(0);
  });

  it('unknown 返回失败但不抛错', () => {
    const { exec } = setup();
    const r = exec.execute({ op: 'unknown', raw: '随便说点啥' } as DrawCommand);
    expect(r.ok).toBe(false);
    expect(r.message).toContain('再说一次'); // 友好的语音追问，而非回读原话
  });

  it('未识别颜色返回失败', () => {
    const { exec } = setup();
    exec.execute({ op: 'create', shape: 'circle' });
    const r = exec.execute({ op: 'recolor', color: '马卡龙紫罗兰' });
    expect(r.ok).toBe(false);
  });
});
