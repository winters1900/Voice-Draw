// 语音识别引擎抽象 —— 让上层(VoiceController)与具体后端解耦。
// 目前有两种实现：QiniuAsrEngine(七牛 REST 代理) 与 WebSpeechEngine(浏览器原生，兜底)。

export type EngineKind = 'qiniu' | 'webspeech';

export interface VoiceHandlers {
  /** 中间(非最终)识别结果，用于实时字幕。部分引擎可能不支持。 */
  onPartial?: (text: string) => void;
  /** 一段最终识别结果。 */
  onFinal: (text: string) => void;
  /** 错误信息（面向用户的中文提示）。 */
  onError?: (msg: string) => void;
  /** 监听状态变化（true=正在听）。 */
  onStateChange?: (listening: boolean) => void;
}

export interface VoiceEngine {
  readonly kind: EngineKind;
  /** 当前环境是否可用（浏览器支持/后端是否配置密钥等）。 */
  isAvailable(): boolean;
  /** 开始监听/录音。 */
  start(handlers: VoiceHandlers): Promise<void>;
  /** 停止监听；record-then-send 型引擎在此触发识别并回调 onFinal。 */
  stop(): void;
}
