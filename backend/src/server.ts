import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { parseRouter } from './routes/parse.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const PORT = Number(process.env.PORT ?? 8787);

app.use('/api', parseRouter);

// 健康检查：前端用它判断后端是否在线，并提示是否已配置七牛密钥。
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'voice-draw-backend',
    qiniuConfigured: Boolean(process.env.QINIU_API_KEY),
    time: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`[voice-draw] backend listening on http://localhost:${PORT}`);
  if (!process.env.QINIU_API_KEY) {
    console.warn('[voice-draw] 未检测到 QINIU_API_KEY，LLM/语音功能将不可用（规则解析仍可运行）。');
  }
});
