import type { EngineKind, VoiceEngine, VoiceHandlers } from './types';

// 七牛云 ASR 引擎（经后端 /api/asr 代理）。
// 录音-发送型：start() 开始录音，stop() 结束并把音频发往后端识别，结果经 onFinal 返回。
// 适合短指令场景；密钥隔离在后端，前端只上传音频。
export class QiniuAsrEngine implements VoiceEngine {
  readonly kind: EngineKind = 'qiniu';
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private handlers: VoiceHandlers | null = null;

  isAvailable(): boolean {
    return typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  }

  async start(handlers: VoiceHandlers): Promise<void> {
    this.handlers = handlers;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      handlers.onError?.('无法访问麦克风，请检查权限');
      return;
    }
    this.chunks = [];
    this.recorder = new MediaRecorder(this.stream);
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.onstop = () => void this.flush();
    this.recorder.start();
    handlers.onStateChange?.(true);
    handlers.onPartial?.('（录音中，再次点击结束并识别）');
  }

  stop(): void {
    try {
      this.recorder?.state !== 'inactive' && this.recorder?.stop();
    } catch {
      /* ignore */
    }
    this.handlers?.onStateChange?.(false);
  }

  /** 录音结束后把音频转 base64 发往后端识别。 */
  private async flush(): Promise<void> {
    this.stream?.getTracks().forEach((t) => t.stop());
    const h = this.handlers;
    if (!h || !this.chunks.length) return;
    const blob = new Blob(this.chunks, { type: this.recorder?.mimeType || 'audio/webm' });
    const format = blob.type.includes('webm') ? 'webm' : blob.type.includes('ogg') ? 'ogg' : 'wav';
    try {
      const base64 = await blobToBase64(blob);
      const resp = await fetch('/api/asr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: base64, format }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        h.onError?.(data?.error ?? `识别失败(${resp.status})`);
        return;
      }
      const { text } = (await resp.json()) as { text?: string };
      if (text && text.trim()) h.onFinal(text.trim());
      else h.onError?.('没有识别到语音内容');
    } catch {
      h.onError?.('语音识别请求失败');
    }
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result);
      // dataURL: "data:...;base64,XXXX" → 取逗号后的纯 base64
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
