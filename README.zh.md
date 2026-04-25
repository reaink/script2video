# Script2Video

[English](README.md) · **中文**

将文字脚本转化为分镜视频的 AI 工具。输入剧本，AI 自动拆分分镜并生成 prompt，逐镜生成视频，最终拼接为完整影片。

---

## 功能概览

| 功能 | 说明 |
|------|------|
| **AI 分镜拆解** | 粘贴脚本，AI 自动按镜头时长拆分并输出结构化分镜（镜头、构图、氛围、对话、SFX） |
| **多模型视频生成** | 每个分镜生成对应视频片段，支持 Veo / Runway / MiniMax Hailuo / Luma Ray 全系列模型 |
| **分镜衔接** | 可选启用：用图像模型合成每个分镜的首帧，保证视觉连贯性 |
| **软字幕** | 生成 WebVTT / SRT 字幕文件，不烧录到视频中，可单独导出 |
| **整片导出** | 拼接所有完成镜头为一个视频文件（mp4 / webm），并嵌入字幕轨道 |
| **多会话管理** | 使用 IndexedDB 本地保存多个对话会话，随时切换继续，删除会话同步清除视频缓存 |
| **参考图上传** | 上传最多 3 张参考图，AI 按图分配到对应分镜 |
| **多语言 UI** | 界面支持中文 / English，自动检测系统语言，可在导航栏手动切换 |

---

## 支持的模型

### 对话模型（分镜拆解）

| 提供商 | 模型 |
|--------|------|
| **Google Gemini** | gemini-2.5-pro、gemini-2.0-flash 等（动态拉取） |
| **OpenAI** | gpt-4.1、gpt-4o、gpt-4o-mini、o4-mini、o3 |
| **Anthropic** | claude-opus-4-5、claude-sonnet-4-5、claude-haiku-3-5 |

### 视频模型

| 提供商 | 模型 |
|--------|------|
| **Google Veo** | veo-3.1、veo-3.0、veo-2.0 等（动态拉取，需 Gemini Key） |
| **Runway** | gen4.5、gen4_turbo（5s / 10s） |
| **MiniMax** | Hailuo-2.3、Hailuo-2.3Fast、Hailuo-02（6s / 10s） |
| **Luma** | ray-2、ray-flash-2（5–9s） |

### 图像模型（分镜首帧合成）

| 提供商 | 模型 | 能力 |
|--------|------|------|
| **Google Gemini** | Imagen 4、Flash Image 等（动态拉取） | 文生图 / 图生图 |
| **OpenAI** | gpt-image-1 | 图生图（edits API） |
| **fal.ai** | FLUX Kontext Pro | 图生图（最适合帧连贯性） |
| **fal.ai** | FLUX Pro | 文生图 |
| **Stability AI** | Stable Image Ultra | 文生图 |
| **Stability AI** | Stable Image Core | 文生图（低成本） |
| **Stability AI** | SD3 Large (img2img) | 图生图 |

未配置任何图像提供商时，"首帧合成"开关自动禁用。

> **分镜衔接说明**：Runway 和 MiniMax 完整支持首帧输入（base64）；Luma 仅支持公开 URL，当前版本首帧功能对 Luma 静默跳过。

---

## 快速开始

### 前置要求

- Node.js 20+
- pnpm（推荐）或 npm / yarn
- 至少配置一个提供商的 API Key

### 安装与运行

```bash
pnpm install
pnpm dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000)。

### 配置 API Key

打开设置页 `/settings`，为需要的提供商填写 API Key 并保存：

| 提供商 | 获取地址 |
|--------|----------|
| Google Gemini | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| OpenAI | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| Anthropic | [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) |
| Runway | [app.runwayml.com/settings](https://app.runwayml.com/settings) |
| MiniMax | [platform.minimax.io](https://platform.minimax.io) |
| Luma | [lumalabs.ai/dream-machine/api](https://lumalabs.ai/dream-machine/api) |
| fal.ai | [fal.ai/dashboard/keys](https://fal.ai/dashboard/keys) |
| Stability AI | [platform.stability.ai/account/keys](https://platform.stability.ai/account/keys) |

> 所有 API Key 通过 **AES-256-GCM** 加密后写入 HttpOnly cookie，不落浏览器存储。

---

## 参数说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| **对话模型** | 用于拆分分镜的模型（Gemini / OpenAI / Anthropic） | 自动选最新可用 |
| **视频模型** | 用于生成视频的模型（Veo / Runway / MiniMax / Luma） | 自动选最新可用 |
| **图像模型** | 用于合成首帧的图像模型（Gemini / OpenAI / fal.ai / Stability AI） | 自动选最新可用 |
| **画幅** | 横屏 16:9 / 竖屏 9:16 | 16:9 |
| **最大单镜头时长** | 单个分镜最长时长（秒）；可选范围随视频模型自动调整 | 按模型决定 |
| **字幕/对话语言** | AI 生成字幕和对话的目标语言 | en-US |
| **字幕（软字幕 WebVTT）** | 是否生成字幕轨道 | 开启 |
| **首帧合成** | 用图像模型生成分镜首帧以增强视觉衔接（需配置任一图像提供商） | 开启 |
| **分镜衔接（串行抽尾帧）** | 将前一镜头最后一帧作为后一镜头输入，强制串行执行 | 开启 |
| **完成后自动继续** | 生成完成后自动触发下一轮（暂未完整实现） | 开启 |

---

## 架构与开发说明

```
app/
  api/
    chat/route.ts           # 调用 Gemini / OpenAI / Anthropic 拆分脚本
    image/generate/route.ts # 帧合成图像（Gemini / OpenAI / fal.ai / Stability AI）
    models/route.ts         # 聚合所有已配置提供商的可用模型
    settings/route.ts       # 多提供商 API Key 的保存 / 读取 / 删除
    video/
      start/route.ts        # 提交视频生成任务（Veo / Runway / MiniMax / Luma）
      status/route.ts       # 查询任务状态，统一响应格式
      proxy/route.ts        # 代理下载视频（CORS，支持多 CDN）
components/
  ChatWorkspace.tsx         # 主工作区：参数面板 + 聊天 + 分镜展示
  JobsPanel.tsx             # 生成进度抽屉：视频播放、导出
  SessionsPanel.tsx         # 会话历史抽屉（高亮当前会话、进度 XX/XX）
  Navbar.tsx                # 导航栏（主题 / 语言切换）
  WelcomeCard.tsx           # 未配置时的引导卡片
  Providers.tsx             # 全局 Provider（主题 / i18n）
lib/
  i18n.tsx                  # i18n 上下文、翻译词条、useI18n() hook
  types.ts                  # 核心类型（Shot、Storyboard、ModelInfo、Provider 等）
  client/
    exportVideo.ts          # 客户端视频拼接（FFmpeg WASM 或原生 API）
    media.ts                # 图片压缩
  db/
    idb.ts                  # IndexedDB 封装
    videoCache.ts           # 视频 blob 缓存
  prompts/storyboard.ts     # 分镜拆分的 system prompt
  providers/
    gemini.ts               # Gemini API（对话 / 图像 / Veo）
    openai.ts               # OpenAI Chat + Image API
    anthropic.ts            # Anthropic Messages API
    runway.ts               # Runway Gen API
    minimax.ts              # MiniMax Video API
    luma.ts                 # Luma Dream Machine API
    fal.ts                  # fal.ai Image API（FLUX Kontext）
    stability.ts            # Stability AI Image API
  server/session.ts         # 服务端读取加密 cookie（多提供商 Key 存储）
  stores/
    jobs.ts                 # Zustand：生成任务状态、会话进度、视频缓存
    sessions.ts             # Zustand：会话列表（按创建时间排序）
  utils/vtt.ts              # WebVTT / SRT 工具函数
```

### 技术栈

- **框架**：Next.js (App Router)
- **UI**：HeroUI v3 + Tailwind CSS v4
- **状态**：Zustand + IndexedDB（本地持久化）
- **语言**：TypeScript 5

### 添加新语言

编辑 [lib/i18n.tsx](lib/i18n.tsx)，在 `Messages` 类型中添加词条后，分别在 `en` 和 `zh` 对象中填写对应翻译，再扩展 `Locale` 类型和 `messages` 映射即可。

### 本地开发命令

```bash
pnpm dev      # 开发服务器（hot reload）
pnpm build    # 生产构建
pnpm start    # 启动生产服务
pnpm lint     # ESLint 检查
```

---

## 注意事项

- Veo 视频生成需要 **Google AI Studio 付费账户**，部分模型（veo-3.x）需申请访问权限
- 视频生成为异步轮询，通常需要 **30s～3min**（取决于模型和服务器负载）
- 导出整片功能在浏览器中完成，大量镜头可能消耗较多内存
- IndexedDB 视频缓存无上限，建议定期在进度面板中清理
