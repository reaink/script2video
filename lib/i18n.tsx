"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type Locale = "en" | "zh";

const LS_KEY = "s2v_locale_v1";

export type Messages = {
  // Navbar
  navHome: string;
  navSettings: string;
  navThemeSystem: string;
  navThemeDark: string;
  navThemeLight: string;
  navThemeLoading: string;
  navLangToggle: string;

  // Welcome page
  welcomeTitle: string;
  welcomeDesc: string;
  welcomeGoSettings: string;

  // Settings page
  settingsTitle: string;
  settingsTabProvider: string;
  settingsTabAbout: string;
  settingsApiKeySaved: string;
  settingsApiKeyPlaceholderNew: string;
  settingsApiKeyPlaceholderEmpty: string;
  settingsApiKeyHint: string;
  settingsShow: string;
  settingsHide: string;
  settingsSave: string;
  settingsFetchModels: string;
  settingsClear: string;
  settingsToastEmptyKey: string;
  settingsToastSaveFailed: string;
  settingsToastSaved: string;
  settingsToastFetchFailed: string;
  settingsToastCleared: string;
  settingsModelsChatTitle: string;
  settingsModelsVideoTitle: string;
  settingsModelsImageTitle: string;
  settingsAboutLine1: string;
  settingsAboutLine2: string;
  settingsAboutLine3: string;

  // ChatWorkspace params panel
  paramsTitle: string;
  paramsRefreshModels: string;
  paramsChatModel: string;
  paramsChatModelPlaceholder: string;
  paramsVideoModel: string;
  paramsVideoModelPlaceholder: string;
  paramsImageModel: string;
  paramsImageModelPlaceholder: string;
  paramsAspectRatio: string;
  paramsLandscape: string;
  paramsPortrait: string;
  paramsDuration: string;
  paramsDurationSec: string;
  paramsSubtitleLang: string;
  paramsSubtitle: string;
  paramsRefFrames: string;
  paramsChainFrames: string;
  paramsAutoContinue: string;

  // ChatWorkspace chat area
  chatEmpty: string;
  chatUpload: string;
  chatPlaceholder: string;
  chatSubmit: string;
  chatSplitting: string;
  chatInterrupted: string;
  chatRetry: string;
  chatCopied: string;
  chatClickCopy: string;
  chatGenSuccess: (n: number) => string;

  // Storyboard view
  sbStyle: string;
  sbLanguage: string;
  sbTotalDuration: string;
  sbShots: string;
  sbRefImage: string;
  sbCamera: string;
  sbComposition: string;
  sbAmbiance: string;
  sbDialogue: string;
  sbSubtitle: string;
  sbContinuity: string;
  sbVeoPrompt: string;
  sbGenerate: string;

  // Jobs panel
  jobsTrigger: string;
  jobsTitle: string;
  jobsTotalLabel: string;
  jobsDoneLabel: string;
  jobsFailedLabel: string;
  jobsExport: string;
  jobsExportSrt: string;
  jobsExportVtt: string;
  jobsCacheLabel: string;
  jobsVideosLabel: string;
  jobsStatusQueued: string;
  jobsStatusRunning: string;
  jobsStatusDone: string;
  jobsStatusFailed: string;
  jobsError: string;
  jobsRetry: string;
  jobsCancel: string;
  jobsReset: string;
  jobsExportPreparing: string;
  jobsExportEncoding: string;
  jobsExportDone: string;
  jobsLoadingCache: string;
  jobsDownloadMp4: string;
  jobsDownloadVtt: string;
  jobsCached: string;
  jobsNotCached: string;
  jobsRegenerate: string;
  jobsRegenerateConfirm: string;
  jobsCancelEdit: string;

  // Sessions panel
  sessionsLabel: string;
  sessionsTitle: string;
  sessionsEmpty: string;
  sessionsMessages: string;
  sessionsVideos: string;
  sessionsDelete: string;
  sessionsNew: string;

  // Toasts
  toastNoChatModel: string;
  toastNoVideoModel: string;
  toastSplitFailed: string;
  toastNetworkError: string;
  toastNoModels: string;
  toastMaxRefImages: (n: number) => string;
  toastCompressFailed: string;

  // Misc
  newSessionTitle: string;
};

const en: Messages = {
  navHome: "Home",
  navSettings: "Settings",
  navThemeSystem: "🖥️ System",
  navThemeDark: "🌙 Dark",
  navThemeLight: "☀️ Light",
  navThemeLoading: "🎨",
  navLangToggle: "中文",

  welcomeTitle: "Welcome to Script2Video",
  welcomeDesc:
    "First, configure your providers in Settings. Supported chat models: Gemini, GPT-4o/o3, Claude. Video: Veo, Runway, MiniMax Hailuo, Luma Ray. At minimum, add a Gemini key to get started.",
  welcomeGoSettings: "Go to Settings",

  settingsTitle: "Settings",
  settingsTabProvider: "Provider",
  settingsTabAbout: "About",
  settingsApiKeySaved: "Saved:",
  settingsApiKeyPlaceholderNew: "Enter new key to replace",
  settingsApiKeyPlaceholderEmpty: "Paste your Gemini API Key",
  settingsApiKeyHint:
    "Get it at: aistudio.google.com/apikey. Key is AES-256-GCM encrypted and stored in an HttpOnly cookie, not in browser storage.",
  settingsShow: "Show",
  settingsHide: "Hide",
  settingsSave: "Save & Verify",
  settingsFetchModels: "Fetch Models",
  settingsClear: "Clear",
  settingsToastEmptyKey: "Please enter an API Key",
  settingsToastSaveFailed: "Save failed",
  settingsToastSaved: "Saved",
  settingsToastFetchFailed: "Failed to fetch models",
  settingsToastCleared: "Cleared",
  settingsModelsChatTitle: "Chat Models",
  settingsModelsVideoTitle: "Video Models",
  settingsModelsImageTitle: "Image Models",
  settingsAboutLine1: "Script2Video — Split scripts into shots with Gemini, generate videos with Veo.",
  settingsAboutLine2:
    "Shot continuity: optionally enable Nano Banana to generate first/last reference frames.",
  settingsAboutLine3: "Subtitles: soft subtitles (WebVTT), not burned into video.",

  paramsTitle: "Parameters",
  paramsRefreshModels: "Refresh Models",
  paramsChatModel: "Chat Model",
  paramsChatModelPlaceholder: "Select chat model",
  paramsVideoModel: "Video Model (Veo)",
  paramsVideoModelPlaceholder: "Select video model",
  paramsImageModel: "Image Model (Frame synthesis)",
  paramsImageModelPlaceholder: "Select image model",
  paramsAspectRatio: "Aspect Ratio",
  paramsLandscape: "Landscape 16:9",
  paramsPortrait: "Portrait 9:16",
  paramsDuration: "Max Shot Duration",
  paramsDurationSec: "s",
  paramsSubtitleLang: "Subtitle / Dialogue Language",
  paramsSubtitle: "Subtitles (soft WebVTT)",
  paramsRefFrames: "First-frame synthesis (Nano Banana)",
  paramsChainFrames: "Shot chaining (serial tail-frame)",
  paramsAutoContinue: "Auto-continue when done",

  chatEmpty:
    "Enter your script and AI will split it into shots based on the selected model duration, generating English prompts for Veo.",
  chatUpload: "Upload Ref",
  chatPlaceholder: "Paste or enter a script, Ctrl+Enter to send",
  chatSubmit: "Submit",
  chatSplitting: "Model is splitting shots...",
  chatInterrupted: "Generation interrupted",
  chatRetry: "Re-split shots",
  chatCopied: "Copied",
  chatClickCopy: "Click to copy",
  chatGenSuccess: (n) => `✅ Generation successful — ${n} shot${n === 1 ? "" : "s"}\n\nReview the storyboard below, then click **Confirm & Generate Video** to start rendering.`,

  sbStyle: "Style:",
  sbLanguage: "Language:",
  sbTotalDuration: "Total:",
  sbShots: "Shots:",
  sbRefImage: "Ref Image #",
  sbCamera: "Camera:",
  sbComposition: "Composition:",
  sbAmbiance: "Ambiance:",
  sbDialogue: "Dialogue",
  sbSubtitle: "Subtitle:",
  sbContinuity: "Continuity:",
  sbVeoPrompt: "Veo Prompt",
  sbGenerate: "Confirm & Generate Video",

  jobsTrigger: "View Generation Progress",
  jobsTitle: "Generation Progress",
  jobsTotalLabel: "Total",
  jobsDoneLabel: "Done",
  jobsFailedLabel: "Failed",
  jobsExport: "Export Film",
  jobsExportSrt: "Export SRT",
  jobsExportVtt: "Export VTT",
  jobsCacheLabel: "Cache:",
  jobsVideosLabel: "videos /",
  jobsStatusQueued: "Queued",
  jobsStatusRunning: "Running",
  jobsStatusDone: "Done",
  jobsStatusFailed: "Failed",
  jobsError: "Error:",
  jobsRetry: "Retry",
  jobsCancel: "Cancel",
  jobsReset: "Reset",
  jobsExportPreparing: "Preparing",
  jobsExportEncoding: "Encoding",
  jobsExportDone: "Done",
  jobsLoadingCache: "Loading cache...",
  jobsDownloadMp4: "Download mp4",
  jobsDownloadVtt: "Download vtt",
  jobsCached: "Cached",
  jobsNotCached: "Not cached (live proxy)",
  jobsRegenerate: "Regenerate Shot",
  jobsRegenerateConfirm: "Regenerate",
  jobsCancelEdit: "Cancel",

  sessionsLabel: "Sessions",
  sessionsTitle: "Session History",
  sessionsEmpty: "No sessions",
  sessionsMessages: "messages",
  sessionsVideos: "videos",
  sessionsDelete: "Delete",
  sessionsNew: "New Session",

  toastNoChatModel: "Please select a chat model first",
  toastNoVideoModel: "Please select a video model",
  toastSplitFailed: "Split failed",
  toastNetworkError: "Network error",
  toastNoModels: "Cannot fetch models, check your API Key",
  toastMaxRefImages: (n) => `Max ${n} reference images`,
  toastCompressFailed: "Compress failed:",

  newSessionTitle: "New Session",
};

const zh: Messages = {
  navHome: "首页",
  navSettings: "设置",
  navThemeSystem: "🖥️ 跟随",
  navThemeDark: "🌙 暗",
  navThemeLight: "☀️ 亮",
  navThemeLoading: "🎨",
  navLangToggle: "English",

  welcomeTitle: "欢迎使用 Script2Video",
  welcomeDesc:
    "首次使用需在设置页配置各 Provider 的 API Key。支持对话：Gemini / GPT-4o / Claude；视频：Veo / Runway / MiniMax Hailuo / Luma Ray。最少配置一个 Gemini Key 即可开始。",
  welcomeGoSettings: "去设置",

  settingsTitle: "设置",
  settingsTabProvider: "Provider",
  settingsTabAbout: "关于",
  settingsApiKeySaved: "已保存：",
  settingsApiKeyPlaceholderNew: "输入新 key 以替换",
  settingsApiKeyPlaceholderEmpty: "粘贴你的 Gemini API Key",
  settingsApiKeyHint:
    "获取地址：aistudio.google.com/apikey。Key 通过 AES-256-GCM 加密后写入 HttpOnly cookie，不落浏览器存储。",
  settingsShow: "显示",
  settingsHide: "隐藏",
  settingsSave: "保存并验证",
  settingsFetchModels: "拉取模型列表",
  settingsClear: "清除",
  settingsToastEmptyKey: "请填写 API Key",
  settingsToastSaveFailed: "保存失败",
  settingsToastSaved: "已保存",
  settingsToastFetchFailed: "拉取模型失败",
  settingsToastCleared: "已清除",
  settingsModelsChatTitle: "对话模型",
  settingsModelsVideoTitle: "视频模型",
  settingsModelsImageTitle: "图像模型",
  settingsAboutLine1: "Script2Video — 用 Gemini 拆分镜，用 Veo 生成视频。",
  settingsAboutLine2: "分镜衔接：可选启用 Nano Banana 生成首尾参考帧。",
  settingsAboutLine3: "字幕：软字幕（WebVTT），不烧录到视频中。",

  paramsTitle: "参数",
  paramsRefreshModels: "刷新模型",
  paramsChatModel: "对话模型",
  paramsChatModelPlaceholder: "选择对话模型",
  paramsVideoModel: "视频模型 (Veo)",
  paramsVideoModelPlaceholder: "选择视频模型",
  paramsImageModel: "图像模型 (帧合成)",
  paramsImageModelPlaceholder: "选择图像模型",
  paramsAspectRatio: "画幅",
  paramsLandscape: "横屏 16:9",
  paramsPortrait: "竖屏 9:16",
  paramsDuration: "最大单镜头时长",
  paramsDurationSec: "秒",
  paramsSubtitleLang: "字幕 / 对话语言",
  paramsSubtitle: "字幕（软字幕 WebVTT）",
  paramsRefFrames: "首帧合成 (Nano Banana)",
  paramsChainFrames: "分镜衔接（串行抽尾帧）",
  paramsAutoContinue: "完成后自动继续",

  chatEmpty: "输入你的脚本，AI 会按所选视频模型时长拆分分镜，并生成可直接喂给 Veo 的英文 prompt。",
  chatUpload: "上传参考",
  chatPlaceholder: "粘贴或输入脚本，Ctrl+Enter 发送",
  chatSubmit: "提交",
  chatSplitting: "模型正在拆分镜...",
  chatInterrupted: "生成被中断",
  chatRetry: "重新生成分镜",
  chatCopied: "已复制",
  chatClickCopy: "点击复制",
  chatGenSuccess: (n) => `✅ 生成成功，共 ${n} 个镜头\n\n请检查下方分镜表，确认无误后点击**确认并生成视频**开始渲染。`,

  sbStyle: "风格：",
  sbLanguage: "语言：",
  sbTotalDuration: "总时长：",
  sbShots: "分镜数：",
  sbRefImage: "参考图 #",
  sbCamera: "镜头：",
  sbComposition: "构图：",
  sbAmbiance: "氛围：",
  sbDialogue: "对话",
  sbSubtitle: "字幕：",
  sbContinuity: "衔接：",
  sbVeoPrompt: "Veo Prompt",
  sbGenerate: "确认并生成视频",

  jobsTrigger: "查看生成进度",
  jobsTitle: "生成进度",
  jobsTotalLabel: "总数",
  jobsDoneLabel: "完成",
  jobsFailedLabel: "失败",
  jobsExport: "导出整片",
  jobsExportSrt: "导出 SRT",
  jobsExportVtt: "导出 VTT",
  jobsCacheLabel: "缓存：",
  jobsVideosLabel: "个视频 /",
  jobsStatusQueued: "排队中",
  jobsStatusRunning: "生成中",
  jobsStatusDone: "完成",
  jobsStatusFailed: "失败",
  jobsError: "错误：",
  jobsRetry: "重试",
  jobsCancel: "取消",
  jobsReset: "清空",
  jobsExportPreparing: "准备",
  jobsExportEncoding: "编码",
  jobsExportDone: "完成",
  jobsLoadingCache: "加载缓存…",
  jobsDownloadMp4: "下载 mp4",
  jobsDownloadVtt: "下载 vtt",
  jobsCached: "已缓存",
  jobsNotCached: "未缓存（实时代理）",
  jobsRegenerate: "重生镜头",
  jobsRegenerateConfirm: "重新生成",
  jobsCancelEdit: "取消",

  sessionsLabel: "会话",
  sessionsTitle: "会话历史",
  sessionsEmpty: "暂无会话",
  sessionsMessages: "条",
  sessionsVideos: "视频",
  sessionsDelete: "删除",
  sessionsNew: "新建会话",

  toastNoChatModel: "请先选择对话模型",
  toastNoVideoModel: "请选择视频模型",
  toastSplitFailed: "拆分失败",
  toastNetworkError: "网络错误",
  toastNoModels: "无法拉取模型，请检查 Key",
  toastMaxRefImages: (n) => `最多上传 ${n} 张参考图`,
  toastCompressFailed: "压缩失败:",

  newSessionTitle: "新会话",
};

const messages: Record<Locale, Messages> = { en, zh };

function detectLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const stored = localStorage.getItem(LS_KEY) as Locale | null;
  if (stored === "en" || stored === "zh") return stored;
  return navigator.language.startsWith("zh") ? "zh" : "en";
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Messages;
}

const I18nContext = createContext<I18nContextValue>({
  locale: "en",
  setLocale: () => { },
  t: en,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const detected = detectLocale();
    setLocaleState(detected);
  }, []);

  // Keep html[lang] in sync with UI locale
  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  const setLocale = (l: Locale) => {
    localStorage.setItem(LS_KEY, l);
    setLocaleState(l);
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t: messages[locale] }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
