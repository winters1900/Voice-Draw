// CommandExecutor —— 把结构化 DrawCommand 应用到 CanvasEngine。
// 负责：目标指代解析、count/layout 批量排布、相对尺寸/方位换算，
// 并为每条命令生成中文反馈文案（供日志与 TTS 播报）。

import { resolveColor } from '@shared/colors';
import {
  SHAPE_LABEL,
  type CreateCommand,
  type DrawCommand,
  type PositionHint,
  type SelectTarget,
} from '@shared/commands';
import { CanvasEngine } from '../engine/CanvasEngine';
import { SHAPE_DEFAULTS, type Shape, type ShapeType } from '../engine/shapes';

export interface ExecOutcome {
  ok: boolean;
  /** 面向用户的中文反馈（成功描述或失败原因）。 */
  message: string;
  command: DrawCommand;
}

const DEFAULT_MOVE = 60;

export class CommandExecutor {
  constructor(private engine: CanvasEngine) {}

  executeAll(cmds: DrawCommand[]): ExecOutcome[] {
    return cmds.map((c) => this.execute(c));
  }

  execute(cmd: DrawCommand): ExecOutcome {
    switch (cmd.op) {
      case 'create':
        return this.create(cmd);
      case 'select':
        return this.select(cmd.target);
      case 'move':
        return this.move(cmd);
      case 'scale':
        return this.scale(cmd.factor, cmd.target);
      case 'rotate':
        return this.rotate(cmd.deg, cmd.target);
      case 'recolor':
        return this.recolor(cmd.color, cmd.target);
      case 'style':
        return this.style(cmd);
      case 'delete':
        return this.remove(cmd.target);
      case 'undo':
        return { ok: this.engine.undo(), message: '已撤销', command: cmd };
      case 'redo':
        return { ok: this.engine.redo(), message: '已重做', command: cmd };
      case 'clear':
        this.engine.clear();
        return { ok: true, message: '已清空画布', command: cmd };
      case 'export':
        return { ok: true, message: '已导出当前画布', command: cmd };
      case 'unknown':
        return { ok: false, message: cmd.reason ?? `没听懂：${cmd.raw}`, command: cmd };
    }
  }

  // —— 创建 ——
  private create(cmd: CreateCommand): ExecOutcome {
    const count = Math.max(1, Math.min(cmd.count ?? 1, 20));
    const props = cmd.props ?? {};
    const color = resolveColor(props.color);
    const scale = props.sizeScale ?? 1;
    const positions = this.layoutPositions(count, cmd.layout ?? 'row', props.position);

    const specs = positions.map((pos) => ({
      type: cmd.shape as ShapeType,
      props: this.sizedProps(cmd.shape as ShapeType, scale, {
        ...pos,
        ...(color ? { color } : {}),
        ...(props.fill != null ? { fill: props.fill } : {}),
        ...(props.strokeWidth != null ? { strokeWidth: props.strokeWidth } : {}),
        ...(props.text != null ? { text: props.text } : {}),
      }),
    }));

    this.engine.addMany(specs);
    const colorLabel = props.color && color ? describeColor(props.color) : '';
    const sizeLabel = scale > 1.1 ? '大' : scale < 0.9 ? '小' : '';
    const label = SHAPE_LABEL[cmd.shape];
    const countLabel = count > 1 ? `${count}个` : '一个';
    const layoutLabel = count > 1 ? this.layoutLabel(cmd.layout ?? 'row') : '';
    return {
      ok: true,
      message: `已画${countLabel}${sizeLabel}${colorLabel}${label}${layoutLabel}`,
      command: cmd,
    };
  }

  /** 按相对缩放系数算出该形状的实际尺寸属性。 */
  private sizedProps(type: ShapeType, scale: number, extra: Partial<Shape>): Partial<Shape> {
    const p: Partial<Shape> = { ...extra };
    switch (type) {
      case 'circle':
        p.r = SHAPE_DEFAULTS.circleR * scale;
        break;
      case 'rect':
        p.w = SHAPE_DEFAULTS.rectW * scale;
        p.h = SHAPE_DEFAULTS.rectH * scale;
        break;
      case 'triangle':
        p.size = SHAPE_DEFAULTS.triangleSize * scale;
        break;
      case 'text':
        p.fontSize = SHAPE_DEFAULTS.fontSize * scale;
        break;
      case 'line':
      case 'arrow':
        if (p.x != null) {
          p.x2 = p.x + SHAPE_DEFAULTS.lineLen * scale;
          p.y2 = p.y;
        }
        break;
    }
    return p;
  }

  /** 计算 count 个图形的中心坐标，支持 row/col/grid 与整组方位。 */
  private layoutPositions(count: number, layout: 'row' | 'col' | 'grid', pos?: PositionHint) {
    const W = this.engine.width;
    const H = this.engine.height;
    const center = this.positionToXY(pos, W, H);
    if (count === 1) return [center];

    const gap = Math.min(180, (W * 0.8) / count);
    const out: Array<{ x: number; y: number }> = [];
    if (layout === 'row') {
      const start = center.x - (gap * (count - 1)) / 2;
      for (let i = 0; i < count; i++) out.push({ x: start + i * gap, y: center.y });
    } else if (layout === 'col') {
      const vgap = Math.min(140, (H * 0.8) / count);
      const start = center.y - (vgap * (count - 1)) / 2;
      for (let i = 0; i < count; i++) out.push({ x: center.x, y: start + i * vgap });
    } else {
      const cols = Math.ceil(Math.sqrt(count));
      const vgap = Math.min(140, gap);
      const startX = center.x - (gap * (cols - 1)) / 2;
      for (let i = 0; i < count; i++) {
        const r = Math.floor(i / cols);
        const c = i % cols;
        out.push({ x: startX + c * gap, y: center.y + (r - (Math.ceil(count / cols) - 1) / 2) * vgap });
      }
    }
    return out;
  }

  private positionToXY(pos: PositionHint | undefined, W: number, H: number) {
    const fx = { left: 0.25, right: 0.75, center: 0.5 };
    const fy = { top: 0.25, bottom: 0.75, center: 0.5 };
    let x = 0.5, y = 0.5;
    switch (pos) {
      case 'top': y = fy.top; break;
      case 'bottom': y = fy.bottom; break;
      case 'left': x = fx.left; break;
      case 'right': x = fx.right; break;
      case 'top-left': x = fx.left; y = fy.top; break;
      case 'top-right': x = fx.right; y = fy.top; break;
      case 'bottom-left': x = fx.left; y = fy.bottom; break;
      case 'bottom-right': x = fx.right; y = fy.bottom; break;
    }
    return { x: W * x, y: H * y };
  }

  private layoutLabel(layout: 'row' | 'col' | 'grid'): string {
    return layout === 'row' ? '排成一行' : layout === 'col' ? '排成一列' : '排成网格';
  }

  // —— 选区 / 指代解析 ——
  private resolveTarget(target?: SelectTarget): string[] {
    const { shapes, selectedIds } = this.engine.getState();
    if (!target) return selectedIds;
    switch (target.kind) {
      case 'last':
        return this.engine.lastShapeId();
      case 'all':
        return shapes.map((s) => s.id);
      case 'byType':
        return shapes.filter((s) => s.type === target.shape).map((s) => s.id);
      case 'byColor': {
        const c = resolveColor(target.color);
        return shapes.filter((s) => s.color === c).map((s) => s.id);
      }
      case 'byIndex': {
        const s = shapes[target.index - 1];
        return s ? [s.id] : [];
      }
    }
  }

  private select(target: SelectTarget): ExecOutcome {
    const ids = this.resolveTarget(target);
    this.engine.select(ids);
    return { ok: ids.length > 0, message: ids.length ? `已选中 ${ids.length} 个图形` : '没有匹配的图形', command: { op: 'select', target } };
  }

  private move(cmd: DrawCommand & { op: 'move' }): ExecOutcome {
    const ids = this.resolveTarget(cmd.target);
    if (!ids.length) return { ok: false, message: '请先选择要移动的图形', command: cmd };
    let dx = cmd.dx ?? 0;
    let dy = cmd.dy ?? 0;
    if (cmd.direction) {
      const d = cmd.distance ?? DEFAULT_MOVE;
      if (cmd.direction === 'left') dx = -d;
      if (cmd.direction === 'right') dx = d;
      if (cmd.direction === 'up') dy = -d;
      if (cmd.direction === 'down') dy = d;
    }
    this.engine.move(dx, dy, ids);
    return { ok: true, message: '已移动', command: cmd };
  }

  private scale(factor: number, target?: SelectTarget): ExecOutcome {
    const ids = this.resolveTarget(target);
    if (!ids.length) return { ok: false, message: '请先选择要缩放的图形', command: { op: 'scale', factor, target } };
    this.engine.scale(factor, ids);
    return { ok: true, message: factor >= 1 ? '已放大' : '已缩小', command: { op: 'scale', factor, target } };
  }

  private rotate(deg: number, target?: SelectTarget): ExecOutcome {
    const ids = this.resolveTarget(target);
    if (!ids.length) return { ok: false, message: '请先选择要旋转的图形', command: { op: 'rotate', deg, target } };
    this.engine.rotate(deg, ids);
    return { ok: true, message: `已旋转 ${deg} 度`, command: { op: 'rotate', deg, target } };
  }

  private recolor(color: string, target?: SelectTarget): ExecOutcome {
    const resolved = resolveColor(color);
    const ids = this.resolveTarget(target);
    if (!resolved) return { ok: false, message: `不认识的颜色：${color}`, command: { op: 'recolor', color, target } };
    if (!ids.length) return { ok: false, message: '请先选择要改色的图形', command: { op: 'recolor', color, target } };
    this.engine.recolor(resolved, ids);
    return { ok: true, message: `已改成${describeColor(color)}`, command: { op: 'recolor', color, target } };
  }

  private style(cmd: DrawCommand & { op: 'style' }): ExecOutcome {
    const ids = this.resolveTarget(cmd.target);
    if (!ids.length) return { ok: false, message: '请先选择图形', command: cmd };
    const patch: Partial<Shape> = {};
    if (cmd.fill != null) patch.fill = cmd.fill;
    if (cmd.strokeWidth != null) patch.strokeWidth = cmd.strokeWidth;
    this.engine.update(patch, ids);
    return { ok: true, message: '已调整样式', command: cmd };
  }

  private remove(target?: SelectTarget): ExecOutcome {
    const ids = this.resolveTarget(target);
    if (!ids.length) return { ok: false, message: '没有可删除的图形', command: { op: 'delete', target } };
    this.engine.remove(ids);
    return { ok: true, message: `已删除 ${ids.length} 个图形`, command: { op: 'delete', target } };
  }
}

/** 颜色原词去掉“色”字用于口语反馈（“红色”→“红色”，“蓝”→“蓝色”）。 */
function describeColor(raw: string): string {
  const t = raw.trim();
  if (/[一-龥]/.test(t)) return t.endsWith('色') ? t : `${t}色`;
  return t;
}
