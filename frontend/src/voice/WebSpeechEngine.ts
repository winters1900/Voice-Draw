import type { EngineKind, VoiceEngine, VoiceHandlers } from './types';

// 浏览器原生语音识别（Web Speech API）。
// 优点：实时流式、零延迟、无需密钥；用作兜底与本地演示，保证“没有七牛 key 也能跑”。
// 连续模式下每段最终结果触发一次 onFinal，便于逐条执行指令。

/* eslint-disable @typescript-eslint/no-explicit-any */
type SR = any;

function getRecognitionCtor(): SR | null {
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export class WebSpeechEngine implements VoiceEngine {
  readonly kind: EngineKind = 'webspeech';
  private recognition: SR | null = null;
  private active = false;
  private handlers: VoiceHandlers | null = null;

  isAvailable(): boolean {
    return getRecognitionCtor() != null;
  }

  async start(handlers: VoiceHandlers): Promise<void> {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      handlers.onError?.('当前浏览器不支持语音识别，请使用 Chrome/Edge');
      return;
    }
    this.handlers = handlers;
    const rec: SR = new Ctor();
    rec.lang = 'zh-CN';
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const text = res[0]?.transcript ?? '';
        if (res.isFinal) {
          const finalText = text.trim();
          if (finalText) handlers.onFinal(finalText);
        } else {
          interim += text;
        }
      }
      if (interim) handlers.onPartial?.(interim);
    };

    rec.onerror = (e: any) => {
      if (e?.error === 'no-speech' || e?.error === 'aborted') return; // 静默忽略常见噪声
      handlers.onError?.(`语音识别错误：${e?.error ?? '未知'}`);
    };

    rec.onend = () => {
      // 连续监听：仍处于激活态则自动重启（部分浏览器会自动停止）
      if (this.active) {
        try {
          rec.start();
        } catch {
          /* 重复 start 抛错可忽略 */
        }
      } else {
        handlers.onStateChange?.(false);
      }
    };

    this.recognition = rec;
    this.active = true;
    try {
      rec.start();
      handlers.onStateChange?.(true);
    } catch (err) {
      handlers.onError?.('无法启动麦克风');
      this.active = false;
    }
  }

  stop(): void {
    this.active = false;
    try {
      this.recognition?.stop();
    } catch {
      /* ignore */
    }
    this.handlers?.onStateChange?.(false);
  }
}
