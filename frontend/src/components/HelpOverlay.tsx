// 指令能力帮助卡：演示时一目了然地展示“能说什么”，也方便评审了解功能范围。

interface Props {
  onClose: () => void;
}

const GROUPS: { title: string; items: string[] }[] = [
  {
    title: '创建图形',
    items: ['画一个红色的圆', '画三个蓝色的方块排成一行', '在左上角画个大三角形', '画一条箭头', '写标题「你好」'],
  },
  {
    title: '调整样式',
    items: ['把它变成绿色', '改成实心', '把所有圆变成黄色'],
  },
  {
    title: '变换图形',
    items: ['放大一点', '缩小', '向右移动100像素', '旋转45度', '选中所有三角形'],
  },
  {
    title: '画布管理',
    items: ['删除最后一个', '撤销', '重做', '清空画布', '保存图片'],
  },
  {
    title: '语音控制',
    items: ['停止聆听', '（说错了）不对，改成蓝色'],
  },
];

export function HelpOverlay({ onClose }: Props) {
  return (
    <div className="help" onClick={onClose}>
      <div className="help__panel" onClick={(e) => e.stopPropagation()}>
        <div className="help__head">
          <h2>你可以这样说</h2>
          <button onClick={onClose}>✕</button>
        </div>
        <p className="help__sub">
          支持自然口语：高频指令本地秒级响应，复杂/模糊指令自动交由七牛大模型理解。
        </p>
        <div className="help__grid">
          {GROUPS.map((g) => (
            <div key={g.title} className="help__group">
              <h3>{g.title}</h3>
              <ul>
                {g.items.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
