# 🎙️ AI 语音绘图工具 (Voice Draw)

> 七牛云暑期比赛作品 · **纯语音控制的 Canvas 绘图工具**——不用鼠标键盘，开口即画。

完整闭环：**语音输入 (七牛 ASR) → 指令理解 (本地规则 + 七牛 LLM 拆解) → Canvas 绘图执行 → 语音反馈 (七牛 TTS)**。
高频指令本地秒级响应，复杂/口语化指令自动交由七牛大模型理解，全程不依赖鼠标键盘。

## ✨ 功能亮点

- **纯语音闭环**：说话 → 实时字幕 → 绘图 → 语音确认，免手操作。
- **混合解析**：本地正则快路径（<1ms）兼顾延迟，七牛 LLM 兜底兼顾理解力与容错。
- **复杂指令拆解**：「画三个红色的圆排成一行，然后在上面写标题」→ 自动拆成多步执行。
- **强容错**：口语填充词/纠错（“帮我…”“不对，改成…”）自动归一化；听不懂会语音追问。
- **指代消解**：支持“最后一个 / 全部 / 第 2 个 / 所有圆 / 红色的”等自然指代。
- **双引擎可切换 + 兜底**：ASR/TTS「七牛优先 + 浏览器原生兜底」，**无密钥也能完整演示**。

## 🎬 Demo 视频

> 待补充：上传至 bilibili / 云盘后填入可播放链接。

## 🚀 快速开始

```bash
# 1. 安装依赖（根 + 前端 + 后端）
npm run install:all

# 2. 配置七牛密钥（启用 LLM / 七牛语音；纯规则解析与浏览器语音无需密钥）
cp backend/.env.example backend/.env   # 填入 QINIU_API_KEY

# 3. 一键启动前后端
npm run dev
# 前端 http://localhost:5173 ，后端 http://localhost:8787
```

> 密钥获取：七牛开发者中心《获取 AI 大模型推理 API 密钥》（赛事赠送额度）。
> 未配置密钥时，应用自动使用浏览器原生语音识别 + 本地规则解析，仍可演示绘图全链路。

### 常用脚本
| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 同时启动前后端（concurrently） |
| `npm test` | 运行前端单元测试（37 项） |
| `npm run build` | 前端构建 + 后端类型检查 |

## 🗣️ 指令示例

| 类别 | 示例 |
| --- | --- |
| 创建 | 画一个红色的圆 / 画三个蓝色的方块排成一行 / 在左上角画个大三角形 / 写标题「你好」 |
| 样式 | 把它变成绿色 / 改成实心 / 把所有圆变成黄色 |
| 变换 | 放大一点 / 缩小 / 向右移动100像素 / 旋转45度 / 选中所有三角形 |
| 管理 | 删除最后一个 / 撤销 / 重做 / 清空画布 / 保存图片 |
| 语音控制 | 停止聆听 / （说错了）不对，改成蓝色 |

界面右上角「❓ 指令帮助」内有完整能力清单。

## 🧱 项目结构

```
qiniu/
├── frontend/   # React + TypeScript + Vite：引擎/解析/执行/语音/UI
│   └── src/{engine,parser,executor,voice,controller,components}
├── backend/    # Node + Express：七牛 LLM/ASR/TTS 代理（密钥隔离）
│   └── src/{routes,parser,qiniu.ts,server.ts}
├── shared/     # 前后端共享的 DrawCommand 指令类型(DSL) + 颜色归一化
└── docs/DESIGN.md   # 设计文档（能力清单/已实现/未完成原因/架构决策）
```

架构、设计决策与能力清单详见 **[docs/DESIGN.md](docs/DESIGN.md)**。

## 🛠️ 技术栈与依赖

| 部分 | 选型 |
| --- | --- |
| 前端 | React 18、TypeScript、Vite 6、Vitest |
| 后端 | Node、Express、ws、dotenv、cors |
| AI 能力 | 七牛云 AI 大模型推理（OpenAI 兼容）、七牛 ASR、七牛 TTS |
| 浏览器兜底 | Web Speech API（SpeechRecognition / SpeechSynthesis） |

**原创性说明**：业务逻辑（绘图引擎、指令 DSL、规则/混合解析、执行器、语音编排）均为本项目原创实现。
第三方依赖仅为上述通用框架/工具库，均在各 `package.json` 中列明；语音识别/合成与大模型推理调用七牛云官方服务。

## 👥 团队分工

> 多人组队时在此登记各自负责的 PR/模块；队员均使用各自 GitHub 账号提交 commit（见 [docs/DESIGN.md](docs/DESIGN.md) 分工章节）。
