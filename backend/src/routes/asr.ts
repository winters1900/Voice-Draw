import { Router } from 'express';
import { getQiniuConfig } from '../qiniu.js';

// POST /api/asr  { audio: base64, format: 'wav'|'mp3'|'webm' }  → { text }
// 语音识别代理：前端录制的短指令音频经此转发七牛 ASR，密钥隔离在后端。
// 说明：七牛实时流式 ASR 为二进制/gzip 协议，短指令场景用非流式 REST 更稳；
//      若线上联调发现入参字段差异，仅需调整下方 payload（已集中于此）。
export const asrRouter = Router();

const ASR_TIMEOUT_MS = Number(process.env.ASR_TIMEOUT_MS ?? 12000);

asrRouter.post('/asr', async (req, res) => {
  const cfg = getQiniuConfig();
  if (!cfg.apiKey) {
    res.status(503).json({ error: '后端未配置 QINIU_API_KEY，请改用浏览器语音识别' });
    return;
  }
  const audio: unknown = req.body?.audio;
  const format: string = typeof req.body?.format === 'string' ? req.body.format : 'wav';
  if (typeof audio !== 'string' || !audio) {
    res.status(400).json({ error: '缺少 audio(base64) 字段' });
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ASR_TIMEOUT_MS);
  try {
    const resp = await fetch(`${cfg.baseUrl}/voice/asr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({ model: 'asr', audio: { format, data: audio } }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      res.status(502).json({ error: `七牛 ASR HTTP ${resp.status}`, detail: detail.slice(0, 300) });
      return;
    }
    const data = await resp.json();
    res.json({ text: extractText(data) });
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    res.status(aborted ? 504 : 502).json({ error: aborted ? '七牛 ASR 超时' : '七牛 ASR 调用失败' });
  } finally {
    clearTimeout(timer);
  }
});

/** 防御式提取识别文本，兼容不同响应包裹形态。 */
function extractText(data: unknown): string {
  if (typeof data === 'string') return data;
  const o = data as Record<string, any>;
  return (
    o?.text ??
    o?.data?.text ??
    o?.result?.text ??
    o?.data?.result ??
    (Array.isArray(o?.results) ? o.results.map((r: any) => r?.text).join('') : '') ??
    ''
  );
}
