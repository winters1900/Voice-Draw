import { useVoice } from '../voice/useVoice';
import type { EngineKind } from '../voice/types';

interface Props {
  run: (text: string, via?: 'text' | 'voice') => Promise<string>;
  qiniuConfigured: boolean;
}

const ENGINE_LABEL: Record<EngineKind, string> = {
  qiniu: '七牛 ASR',
  webspeech: '浏览器',
};

// 语音输入面板：麦克风开关、实时字幕、识别引擎切换。语音是本工具的主交互方式。
export function VoicePanel({ run, qiniuConfigured }: Props) {
  const voice = useVoice({ qiniuConfigured, onFinal: (t) => void run(t, 'voice') });

  return (
    <div className="voice">
      <button
        className={`voice__mic ${voice.listening ? 'is-listening' : ''}`}
        onClick={voice.toggle}
        disabled={!voice.available}
        title={voice.available ? '点击开始/停止' : '当前环境不可用'}
      >
        <span className="voice__dot" />
        {voice.listening ? '停止聆听' : '点击说话'}
      </button>

      <div className="voice__engines">
        {(['qiniu', 'webspeech'] as EngineKind[]).map((k) => (
          <button
            key={k}
            className={voice.kind === k ? 'is-active' : ''}
            onClick={() => voice.switchEngine(k)}
          >
            {ENGINE_LABEL[k]}
          </button>
        ))}
      </div>

      <div className="voice__transcript">
        {voice.error ? (
          <span className="voice__error">{voice.error}</span>
        ) : voice.partial ? (
          <span className="voice__partial">{voice.partial}</span>
        ) : (
          <span className="voice__idle">
            {voice.listening ? '正在聆听…试试「画一个红色的圆」' : '点击麦克风，开口画图'}
          </span>
        )}
      </div>
    </div>
  );
}
