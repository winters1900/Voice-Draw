// CanvasEngine —— 纯命令式绘图引擎。
// 维护图形列表、选中集合与撤销/重做历史，并把状态渲染到 <canvas>。
// 不感知语音或指令解析；上层（CommandExecutor）只调用这里暴露的方法。

import { getBounds, hitTest, nextShapeId, SHAPE_DEFAULTS, type Shape, type ShapeType } from './shapes';

export interface EngineState {
  shapes: Shape[];
  selectedIds: string[];
}

type Listener = (state: EngineState) => void;

const HISTORY_LIMIT = 100;

export class CanvasEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private shapes: Shape[] = [];
  private selectedIds = new Set<string>();
  private undoStack: EngineState[] = [];
  private redoStack: EngineState[] = [];
  private listeners = new Set<Listener>();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法获取 2D 渲染上下文');
    this.ctx = ctx;
    this.render();
  }

  // —— 订阅 / 状态 ——
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  getState(): EngineState {
    return { shapes: this.shapes.map((s) => ({ ...s })), selectedIds: [...this.selectedIds] };
  }

  get width(): number {
    return this.canvas.width;
  }
  get height(): number {
    return this.canvas.height;
  }

  private emit(): void {
    const state = this.getState();
    this.listeners.forEach((fn) => fn(state));
    this.render();
  }

  // —— 历史 ——
  private snapshot(): EngineState {
    return { shapes: this.shapes.map((s) => ({ ...s })), selectedIds: [...this.selectedIds] };
  }

  /** 在任何改变图形/选区的操作前调用，记录可撤销点。 */
  private commit(): void {
    this.undoStack.push(this.snapshot());
    if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
    this.redoStack = [];
  }

  private restore(state: EngineState): void {
    this.shapes = state.shapes.map((s) => ({ ...s }));
    this.selectedIds = new Set(state.selectedIds);
  }

  undo(): boolean {
    const prev = this.undoStack.pop();
    if (!prev) return false;
    this.redoStack.push(this.snapshot());
    this.restore(prev);
    this.emit();
    return true;
  }

  redo(): boolean {
    const next = this.redoStack.pop();
    if (!next) return false;
    this.undoStack.push(this.snapshot());
    this.restore(next);
    this.emit();
    return true;
  }

  // —— 创建 ——
  /** 新增一个图形。type 必填，其余走默认值；返回创建后的图形。 */
  add(type: ShapeType, props: Partial<Shape> = {}): Shape {
    this.commit();
    const shape = this.makeShape(type, props);
    this.shapes.push(shape);
    this.selectedIds = new Set([shape.id]); // 新建即选中，便于“再大一点”等后续指代
    this.emit();
    return shape;
  }

  /** 批量创建：一次提交历史，整组作为一个可撤销单元（用于“画三个圆”）。 */
  addMany(specs: Array<{ type: ShapeType; props?: Partial<Shape> }>): Shape[] {
    if (!specs.length) return [];
    this.commit();
    const created = specs.map(({ type, props }) => {
      const shape = this.makeShape(type, props ?? {});
      this.shapes.push(shape);
      return shape;
    });
    this.selectedIds = new Set(created.map((s) => s.id));
    this.emit();
    return created;
  }

  private makeShape(type: ShapeType, props: Partial<Shape>): Shape {
    const base: Shape = {
      id: nextShapeId(),
      type,
      x: props.x ?? this.canvas.width / 2,
      y: props.y ?? this.canvas.height / 2,
      color: props.color ?? SHAPE_DEFAULTS.color,
      fill: props.fill ?? SHAPE_DEFAULTS.fill,
      strokeWidth: props.strokeWidth ?? SHAPE_DEFAULTS.strokeWidth,
      rotation: props.rotation ?? SHAPE_DEFAULTS.rotation,
    };
    switch (type) {
      case 'circle':
        base.r = props.r ?? SHAPE_DEFAULTS.circleR;
        break;
      case 'rect':
        base.w = props.w ?? SHAPE_DEFAULTS.rectW;
        base.h = props.h ?? SHAPE_DEFAULTS.rectH;
        break;
      case 'triangle':
        base.size = props.size ?? SHAPE_DEFAULTS.triangleSize;
        break;
      case 'text':
        base.text = props.text ?? '文字';
        base.fontSize = props.fontSize ?? SHAPE_DEFAULTS.fontSize;
        base.fill = true;
        break;
      case 'line':
      case 'arrow':
        base.x2 = props.x2 ?? base.x + SHAPE_DEFAULTS.lineLen;
        base.y2 = props.y2 ?? base.y;
        break;
    }
    return base;
  }

  // —— 选区 ——
  /** 解析目标 id 列表：未传则用当前选区。 */
  private resolveIds(ids?: string[]): string[] {
    if (ids && ids.length) return ids;
    return [...this.selectedIds];
  }

  select(ids: string[]): void {
    this.selectedIds = new Set(ids);
    this.emit();
  }

  selectAll(): void {
    this.selectedIds = new Set(this.shapes.map((s) => s.id));
    this.emit();
  }

  clearSelection(): void {
    this.selectedIds = new Set();
    this.emit();
  }

  /** 最近创建（数组末尾）的图形 id，找不到返回 []。 */
  lastShapeId(): string[] {
    const last = this.shapes[this.shapes.length - 1];
    return last ? [last.id] : [];
  }

  // —— 变换 / 修改 ——
  move(dx: number, dy: number, ids?: string[]): void {
    const targets = this.resolveIds(ids);
    if (!targets.length) return;
    this.commit();
    this.applyTo(targets, (s) => {
      s.x += dx;
      s.y += dy;
      if (s.x2 != null) s.x2 += dx;
      if (s.y2 != null) s.y2 += dy;
    });
    this.emit();
  }

  scale(factor: number, ids?: string[]): void {
    const targets = this.resolveIds(ids);
    if (!targets.length || factor <= 0) return;
    this.commit();
    this.applyTo(targets, (s) => {
      if (s.r != null) s.r *= factor;
      if (s.w != null) s.w *= factor;
      if (s.h != null) s.h *= factor;
      if (s.size != null) s.size *= factor;
      if (s.fontSize != null) s.fontSize *= factor;
      if (s.x2 != null && s.y2 != null) {
        s.x2 = s.x + (s.x2 - s.x) * factor;
        s.y2 = s.y + (s.y2 - s.y) * factor;
      }
    });
    this.emit();
  }

  rotate(deg: number, ids?: string[]): void {
    const targets = this.resolveIds(ids);
    if (!targets.length) return;
    this.commit();
    this.applyTo(targets, (s) => {
      s.rotation = (s.rotation + deg) % 360;
    });
    this.emit();
  }

  recolor(color: string, ids?: string[]): void {
    const targets = this.resolveIds(ids);
    if (!targets.length) return;
    this.commit();
    this.applyTo(targets, (s) => {
      s.color = color;
    });
    this.emit();
  }

  /** 通用属性更新（如填充、描边宽度、文字内容）。 */
  update(patch: Partial<Shape>, ids?: string[]): void {
    const targets = this.resolveIds(ids);
    if (!targets.length) return;
    this.commit();
    this.applyTo(targets, (s) => Object.assign(s, patch, { id: s.id, type: s.type }));
    this.emit();
  }

  remove(ids?: string[]): void {
    const targets = new Set(this.resolveIds(ids));
    if (!targets.size) return;
    this.commit();
    this.shapes = this.shapes.filter((s) => !targets.has(s.id));
    targets.forEach((id) => this.selectedIds.delete(id));
    this.emit();
  }

  clear(): void {
    if (!this.shapes.length) return;
    this.commit();
    this.shapes = [];
    this.selectedIds = new Set();
    this.emit();
  }

  private applyTo(ids: string[], fn: (s: Shape) => void): void {
    const set = new Set(ids);
    this.shapes.forEach((s) => {
      if (set.has(s.id)) fn(s);
    });
  }

  /** 命中坐标的最上层图形 id（用于未来鼠标无关的指代，如“点中的那个”）。 */
  pickAt(px: number, py: number): string | null {
    for (let i = this.shapes.length - 1; i >= 0; i--) {
      if (hitTest(this.shapes[i], px, py)) return this.shapes[i].id;
    }
    return null;
  }

  /** 导出当前画布为 PNG dataURL。 */
  toDataURL(): string {
    return this.canvas.toDataURL('image/png');
  }

  // —— 渲染 ——
  render(): void {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const s of this.shapes) this.drawShape(s);
    for (const id of this.selectedIds) {
      const s = this.shapes.find((x) => x.id === id);
      if (s) this.drawSelection(s);
    }
  }

  private drawShape(s: Shape): void {
    const { ctx } = this;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate((s.rotation * Math.PI) / 180);
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineWidth = s.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (s.type) {
      case 'circle': {
        const r = s.r ?? SHAPE_DEFAULTS.circleR;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        s.fill ? ctx.fill() : ctx.stroke();
        break;
      }
      case 'rect': {
        const w = s.w ?? SHAPE_DEFAULTS.rectW;
        const h = s.h ?? SHAPE_DEFAULTS.rectH;
        ctx.beginPath();
        ctx.rect(-w / 2, -h / 2, w, h);
        s.fill ? ctx.fill() : ctx.stroke();
        break;
      }
      case 'triangle': {
        const sz = s.size ?? SHAPE_DEFAULTS.triangleSize;
        ctx.beginPath();
        ctx.moveTo(0, -sz / 2);
        ctx.lineTo(sz / 2, sz / 2);
        ctx.lineTo(-sz / 2, sz / 2);
        ctx.closePath();
        s.fill ? ctx.fill() : ctx.stroke();
        break;
      }
      case 'text': {
        const fs = s.fontSize ?? SHAPE_DEFAULTS.fontSize;
        ctx.font = `${fs}px system-ui, 'Microsoft YaHei', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(s.text ?? '', 0, 0);
        break;
      }
      case 'line':
      case 'arrow': {
        // 线/箭头以锚点为原点重新计算端点的相对坐标
        const ex = (s.x2 ?? s.x + SHAPE_DEFAULTS.lineLen) - s.x;
        const ey = (s.y2 ?? s.y) - s.y;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        if (s.type === 'arrow') {
          const ang = Math.atan2(ey, ex);
          const head = 14 + s.strokeWidth * 2;
          ctx.beginPath();
          ctx.moveTo(ex, ey);
          ctx.lineTo(ex - head * Math.cos(ang - Math.PI / 6), ey - head * Math.sin(ang - Math.PI / 6));
          ctx.moveTo(ex, ey);
          ctx.lineTo(ex - head * Math.cos(ang + Math.PI / 6), ey - head * Math.sin(ang + Math.PI / 6));
          ctx.stroke();
        }
        break;
      }
    }
    ctx.restore();
  }

  private drawSelection(s: Shape): void {
    const { ctx } = this;
    const b = getBounds(s);
    ctx.save();
    ctx.strokeStyle = '#4f8cff';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(b.minX - 6, b.minY - 6, b.maxX - b.minX + 12, b.maxY - b.minY + 12);
    ctx.restore();
  }
}
