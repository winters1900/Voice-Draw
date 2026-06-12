// LLM 解析器：把任意自然语言交给七牛 LLM，输出结构化 DrawCommand[]。
// 用强约束的 system prompt + few-shot 让模型只产出 JSON；失败/超时降级为 unknown。

import { getQiniuConfig } from '../qiniu.js';
import { isValidCommand, type DrawCommand } from '../../../shared/commands.js';

const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS ?? 9000);

const SYSTEM_PROMPT = `你是「语音绘图工具」的指令解析器。把用户的中文绘图口令翻译成严格的 JSON，
只输出一个对象：{"commands": DrawCommand[]}，不要任何多余文字或解释。

DrawCommand 取值（op 必填）：
- 创建: {"op":"create","shape":"circle|rect|line|arrow|triangle|text","count":数量?,"layout":"row|col|grid"?,"props":{"color":颜色?,"fill":布尔?,"strokeWidth":数字?,"sizeScale":相对默认尺寸倍数?,"text":文字内容?,"position":"center|top|bottom|left|right|top-left|top-right|bottom-left|bottom-right"?}}
- 选择: {"op":"select","target":Target}
- 移动: {"op":"move","target":Target?,"direction":"up|down|left|right"?,"distance":数字?}
- 缩放: {"op":"scale","target":Target?,"factor":倍数}   (放大>1，缩小<1)
- 旋转: {"op":"rotate","target":Target?,"deg":角度}
- 改色: {"op":"recolor","target":Target?,"color":颜色}
- 样式: {"op":"style","target":Target?,"fill":布尔?,"strokeWidth":数字?}
- 删除: {"op":"delete","target":Target?}
- 撤销/重做/清空/导出: {"op":"undo"} {"op":"redo"} {"op":"clear"} {"op":"export"}
- 无法理解: {"op":"unknown","raw":"原话","reason":"原因"}

Target（指代）取值：
{"kind":"last"} 最近一个 | {"kind":"all"} 全部 | {"kind":"byType","shape":"circle..."} 按类型 |
{"kind":"byColor","color":"红色"} 按颜色 | {"kind":"byIndex","index":从1开始的序号}

规则：
1. 颜色用中文词或 #hex，sizeScale 用相对倍数（“大一点”≈1.3，“小”≈0.6）。
2. 一句话含多个动作时拆成多条命令，按先后顺序排列。
3. 省略 target 时表示作用于“当前选中/最近创建”的图形。
4. 完全无绘图意图时返回一条 unknown。

示例：
输入：画一个红色的大圆
输出：{"commands":[{"op":"create","shape":"circle","props":{"color":"红色","sizeScale":1.5}}]}
输入：在右边画三个蓝色方块排成一列，然后把它们变成绿色
输出：{"commands":[{"op":"create","shape":"rect","count":3,"layout":"col","props":{"color":"蓝色","position":"right"}},{"op":"recolor","target":{"kind":"all"},"color":"绿色"}]}
输入：太丑了撤销吧
输出：{"commands":[{"op":"undo"}]}`;

interface LlmResult {
  commands: DrawCommand[];
  model: string;
}

export async function llmParse(text: string): Promise<LlmResult> {
  const cfg = getQiniuConfig();
  if (!cfg.apiKey) {
    return { commands: [{ op: 'unknown', raw: text, reason: '后端未配置 QINIU_API_KEY' }], model: 'none' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.llmModel,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text },
        ],
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      throw new Error(`LLM HTTP ${resp.status} ${detail.slice(0, 200)}`);
    }

    const data = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content ?? '';
    const commands = extractCommands(content);
    if (!commands.length) {
      return { commands: [{ op: 'unknown', raw: text, reason: 'LLM 未产出有效命令' }], model: cfg.llmModel };
    }
    return { commands, model: cfg.llmModel };
  } catch (err) {
    const reason = err instanceof Error && err.name === 'AbortError' ? 'LLM 超时' : `LLM 调用失败`;
    return { commands: [{ op: 'unknown', raw: text, reason }], model: cfg.llmModel };
  } finally {
    clearTimeout(timer);
  }
}

/** 从模型输出中稳健地抽取并校验命令数组（容忍包裹文本/代码块）。 */
function extractCommands(content: string): DrawCommand[] {
  const json = tryParseJsonObject(content);
  if (!json) return [];
  const arr = Array.isArray(json) ? json : (json as { commands?: unknown }).commands;
  if (!Array.isArray(arr)) return [];
  return arr.filter(isValidCommand);
}

function tryParseJsonObject(content: string): unknown {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // 容错：从文本中截取第一个 { 到最后一个 } 之间的 JSON
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}
