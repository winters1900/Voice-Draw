// 七牛云 AI 服务配置（OpenAI 兼容）。密钥与基址只在后端读取，前端永不接触。

export interface QiniuConfig {
  apiKey: string;
  baseUrl: string;
  llmModel: string;
  voiceWs: string;
  ttsVoice: string;
}

export function getQiniuConfig(): QiniuConfig {
  return {
    apiKey: process.env.QINIU_API_KEY ?? '',
    baseUrl: process.env.QINIU_BASE_URL ?? 'https://api.qnaigc.com/v1',
    llmModel: process.env.QINIU_LLM_MODEL ?? 'deepseek-v3',
    voiceWs: process.env.QINIU_VOICE_WS ?? 'wss://api.qnaigc.com/v1/voice',
    ttsVoice: process.env.QINIU_TTS_VOICE ?? 'qiniu_zh_female_wwxkjx',
  };
}

export function hasQiniuKey(): boolean {
  return Boolean(process.env.QINIU_API_KEY);
}
