// 颜色归一化 —— 前端规则解析、后端 LLM 输出与执行器共用一份色表。
// 支持中文色词、英文色名与直接的 #hex / rgb() 透传。

const COLOR_MAP: Record<string, string> = {
  红: '#e23b3b', 红色: '#e23b3b', 大红: '#e23b3b', 朱红: '#e23b3b',
  蓝: '#2f7be2', 蓝色: '#2f7be2', 天蓝: '#4aa3ff', 深蓝: '#1f4fa8',
  绿: '#2fae5a', 绿色: '#2fae5a', 草绿: '#5cb85c', 深绿: '#1f7a3f',
  黄: '#e2b32f', 黄色: '#e2b32f', 金色: '#d4af37',
  橙: '#e2812f', 橙色: '#e2812f', 橘色: '#e2812f', 橘黄: '#e2812f',
  紫: '#8a4fd4', 紫色: '#8a4fd4',
  黑: '#222222', 黑色: '#222222',
  白: '#ffffff', 白色: '#ffffff',
  灰: '#888888', 灰色: '#888888',
  粉: '#ed74b0', 粉色: '#ed74b0', 粉红: '#ed74b0', 粉红色: '#ed74b0',
  青: '#27c4c4', 青色: '#27c4c4',
  棕: '#9b6a3a', 棕色: '#9b6a3a', 褐色: '#9b6a3a', 咖啡色: '#6f4e37',
  red: '#e23b3b', blue: '#2f7be2', green: '#2fae5a', yellow: '#e2b32f',
  orange: '#e2812f', purple: '#8a4fd4', black: '#222222', white: '#ffffff',
  gray: '#888888', grey: '#888888', pink: '#ed74b0', cyan: '#27c4c4', brown: '#9b6a3a',
};

/** 把任意颜色描述归一化为 CSS 颜色字符串；无法识别返回 undefined。 */
export function resolveColor(input?: string): string | undefined {
  if (!input) return undefined;
  const raw = input.trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) return raw;
  if (/^rgba?\(/i.test(raw)) return raw;
  if (COLOR_MAP[raw]) return COLOR_MAP[raw];
  const lower = raw.toLowerCase();
  if (COLOR_MAP[lower]) return COLOR_MAP[lower];
  return undefined;
}

/** 已知颜色中文名清单，供规则解析器做关键词匹配。 */
export const COLOR_KEYWORDS = Object.keys(COLOR_MAP).filter((k) => /[一-龥]/.test(k));
