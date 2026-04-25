# Script2Video

将文字脚本转化为分镜视频的 AI 工具。输入剧本，Gemini 自动拆分分镜并生成 Veo prompt，Veo 逐镜生成视频，最终拼接为完整影片。

---

## 功能概览

| 功能 | 说明 |
|------|------|
| **AI 分镜拆解** | 粘贴脚本，Gemini 自动按镜头时长拆分并输出结构化分镜（镜头、构图、氛围、对话、SFX） |
| **Veo 视频生成** | 每个分镜生成对应视频片段，支持 Veo 2 / Veo 3 全系列模型 |
| **分镜衔接** | 可选启用 Nano Banana（Gemini Flash Image）抽取前镜尾帧作为后镜首帧，保证视觉连贯性 |
| **软字幕** | 生成 WebVTT / SRT 字幕文件，不烧录到视频中，可单独导出 |
| **整片导出** | 拼接所有完成镜头为一个视频文件（mp4 / webm），并嵌入字幕轨道 |
| **多会话管理** | 使用 IndexedDB 本地保存多个对话会话，随时切换继续 |
| **参考图上传** | 上传最多 3 张参考图，AI 按图分配到对应分镜 |
| **多语言 UI** | 界面支持中文 / English，自动检测系统语言，可在导航栏手动切换 |

---

## 快速开始

### 前置要求

- Node.js 20+
- pnpm（推荐）或 npm / yarn
- Google Gemini API Key（需要开通 Veo 视频生成权限）

### 安装与运行

```bash
pnpm install
pnpm dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000)。

### 配置 API Key

1. 前往 [aistudio.google.com/apikey](https://aistudio.google.com/apikey) 获取 Gemini API Key
2. 打开设置页 `/settings`，粘贴 API Key 并点击"保存并验证"
3. 保存成功后点击"拉取模型列表"确认权限

> API Key 通过 **AES-256-GCM** 加密后写入 HttpOnly cookie，不落浏览器存储。

---

## 参数说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| **对话模型** | 用于拆分分镜的 Gemini 模型（如 gemini-2.5-pro） | 自动选最新可用 |
| **视频模型** | 用于生成视频的 Veo 模型（如 veo-3.1-generate-preview） | 自动选最新可用 |
| **图像模型** | 用于合成首尾参考帧的图像模型（如 gemini-flash-image） | 自动选最新可用 |
| **画幅** | 横屏 16:9 / 竖屏 9:16 | 16:9 |
| **最大单镜头时长** | 单个分镜最长时长（秒）；Veo lite 支持 5/6/8s，Veo 3.0 仅 8s | 8s |
| **字幕/对话语言** | AI 生成字幕和对话的目标语言 | en-US |
| **字幕（软字幕 WebVTT）** | 是否生成字幕轨道 | 开启 |
| **首帧合成（Nano Banana）** | 用图像模型生成分镜首帧以增强视觉衔接 | 开启 |
| **分镜衔接（串行抽尾帧）** | 将前一镜头最后一帧作为后一镜头输入，强制串行执行 | 开启 |
| **完成后自动继续** | 生成完成后自动触发下一轮（暂未完整实现） | 开启 |

---

## 架构与开发说明

```
app/
  api/
    chat/route.ts          # 调用 Gemini 拆分脚本为分镜 JSON
    image/generate/route.ts # 生成参考帧图像（Nano Banana）
    models/route.ts        # 拉取可用模型列表
    settings/route.ts      # 保存 / 读取 / 删除 API Key（加密 cookie）
    video/
      start/route.ts       # 提交 Veo 视频生成任务
      status/route.ts      # 查询生成任务状态
      proxy/route.ts       # 代理下载 Veo 视频（绕过 CORS）
components/
  ChatWorkspace.tsx        # 主工作区：参数面板 + 聊天 + 分镜展示
  JobsPanel.tsx            # 生成进度抽屉：视频播放、导出
  SessionsPanel.tsx        # 会话历史抽屉
  Navbar.tsx               # 导航栏（主题 / 语言切换）
  WelcomeCard.tsx          # 未配置时的引导卡片
  Providers.tsx            # 全局 Provider（主题 / i18n）
lib/
  i18n.tsx                 # i18n 上下文、翻译词条、useI18n() hook
  types.ts                 # 核心类型（Shot、Storyboard、GeminiModel 等）
  client/
    exportVideo.ts         # 客户端视频拼接（FFmpeg WASM 或原生 API）
    media.ts               # 图片压缩
  db/
    idb.ts                 # IndexedDB 封装
    videoCache.ts          # 视频 blob 缓存
  prompts/storyboard.ts    # 分镜拆分的 system prompt
  providers/gemini.ts      # Gemini API 封装
  server/session.ts        # 服务端读取加密 cookie
  stores/
    jobs.ts                # Zustand：生成任务状态
    sessions.ts            # Zustand：会话列表
  utils/vtt.ts             # WebVTT / SRT 工具函数
```

### 技术栈

- **框架**：Next.js 16 (App Router)
- **UI**：HeroUI v3 + Tailwind CSS v4
- **状态**：Zustand + IndexedDB（本地持久化）
- **AI**：Google Gemini API（chat + image + video）
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
