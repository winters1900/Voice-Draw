// 语音元控制：识别“停止聆听”等控制麦克风本身的口令，
// 与绘图指令区分开，避免被当成绘图内容执行。

export type VoiceControl = 'stop';

const STOP_RE = /^(停(止|下)?|结束|别|暂停)?\s*(聆听|监听|识别|录音|说话|听写)$|^(别听了|停一下|够了|结束聆听)$/;

/** 命中麦克风控制口令返回控制类型，否则返回 null（即普通绘图指令）。 */
export function matchVoiceControl(text: string): VoiceControl | null {
  const t = text.trim().replace(/[。.!！，,]/g, '');
  if (STOP_RE.test(t)) return 'stop';
  return null;
}
