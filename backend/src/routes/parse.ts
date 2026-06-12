import { Router } from 'express';
import { llmParse } from '../parser/llmParse.js';

// POST /api/parse  { text: string }  → { source:'llm', model, commands, ms }
// 把自然语言交给七牛 LLM 解析为结构化绘图命令。CommandRouter 仅在规则未命中时调用。
export const parseRouter = Router();

parseRouter.post('/parse', async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!text) {
    res.status(400).json({ error: '缺少 text 字段' });
    return;
  }
  const started = Date.now();
  const { commands, model } = await llmParse(text);
  res.json({ source: 'llm', model, commands, ms: Date.now() - started });
});
