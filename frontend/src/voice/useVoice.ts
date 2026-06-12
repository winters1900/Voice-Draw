import { useCallback, useMemo, useRef, useState } from 'react';
import type { EngineKind, VoiceEngine } from './types';
import { WebSpeechEngine } from './WebSpeechEngine';
import { QiniuAsrEngine } from './QiniuAsrEngine';

interface UseVoiceOptions {
  /** 后端是否已配置七牛密钥（决定默认引擎）。 */
  qiniuConfigured: boolean;
  /** 一段最终识别文本就绪时回调（交给绘图控制器执行）。 */
  onFinal: (text: string) => void;
}

/**
 * 语音输入管理：封装引擎选择(七牛/浏览器)、监听开关、实时字幕与错误。
 * 默认：后端配置了七牛密钥则用七牛 ASR，否则回退浏览器原生(保证无 key 也能演示)。
 */
export function useVoice({ qiniuConfigured, onFinal }: UseVoiceOptions) {
  const engines = useMemo(
    () => ({ qiniu: new QiniuAsrEngine(), webspeech: new WebSpeechEngine() }) as Record<EngineKind, VoiceEngine>,
    [],
  );

  const defaultKind: EngineKind =
    qiniuConfigured && engines.qiniu.isAvailable() ? 'qiniu' : 'webspeech';
  const [kind, setKind] = useState<EngineKind>(defaultKind);
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const [error, setError] = useState('');
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  const engine = engines[kind];

  const start = useCallback(async () => {
    setError('');
    setPartial('');
    await engine.start({
      onPartial: setPartial,
      onFinal: (text) => {
        setPartial('');
        onFinalRef.current(text);
      },
      onError: (msg) => {
        setError(msg);
        setListening(false);
      },
      onStateChange: setListening,
    });
  }, [engine]);

  const stop = useCallback(() => engine.stop(), [engine]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else void start();
  }, [listening, start, stop]);

  const switchEngine = useCallback(
    (next: EngineKind) => {
      if (listening) stop();
      setKind(next);
      setPartial('');
      setError('');
    },
    [listening, stop],
  );

  return {
    kind,
    listening,
    partial,
    error,
    available: engine.isAvailable(),
    toggle,
    switchEngine,
  };
}
