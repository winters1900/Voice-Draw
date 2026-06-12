import { describe, expect, it } from 'vitest';
import { normalizeInput, parseWithRules } from './RuleParser';
import { matchVoiceControl } from '../voice/voiceControl';

describe('输入归一化（容错）', () => {
  it('剥离口语填充前缀', () => {
    expect(normalizeInput('帮我画一个圆')).toBe('画一个圆');
    expect(normalizeInput('那个，请给我来三个圆')).toBe('三个圆');
    expect(normalizeInput('嗯嗯我要画方块')).toBe('画方块');
  });

  it('剥离纠错标记', () => {
    expect(normalizeInput('不对，改成蓝色')).toBe('改成蓝色');
    expect(normalizeInput('说错了重新画个三角形')).toBe('画个三角形');
  });

  it('归一化后仍能正确解析', () => {
    const c = parseWithRules('帮我画一个红色的圆').commands[0];
    expect(c).toMatchObject({ op: 'create', shape: 'circle' });
    const c2 = parseWithRules('不对，改成蓝色').commands[0];
    expect(c2.op).toBe('recolor');
  });
});

describe('语音元控制口令', () => {
  it('识别停止类口令', () => {
    expect(matchVoiceControl('停止聆听')).toBe('stop');
    expect(matchVoiceControl('暂停识别')).toBe('stop');
    expect(matchVoiceControl('别听了')).toBe('stop');
    expect(matchVoiceControl('结束聆听')).toBe('stop');
  });

  it('普通绘图指令不误判为控制', () => {
    expect(matchVoiceControl('画一个圆')).toBeNull();
    expect(matchVoiceControl('停在右边')).toBeNull();
  });
});
