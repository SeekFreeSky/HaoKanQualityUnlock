# 🚀 好看视频画质自动解锁 (HaoKan Quality Unlock)

<p align="center">
  <a href="https://github.com/SeekFreeSky/HaoKanQualityUnlock/raw/refs/heads/main/HaoKanQualityUnlock.user.js">
  <img src="https://img.shields.io/badge/Install-v2.1.0-success?style=for-the-badge&logo=tampermonkey" alt="Install">
  </a>
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="license">
  <img src="https://img.shields.io/badge/Platform-Browser-orange?style=for-the-badge" alt="platform">
</p>

> **解锁百度好看视频 (haokan.baidu.com) 的画质限制，移除“App扫码”诱导按钮，自动锁定 4K/2K/1080P 最高清晰度。**

## 📖 简介 | Introduction

在电脑端浏览好看视频时，未登录用户通常被限制在 **360P/480P** 低画质，且点击切换清晰度时会弹出“扫码下载App”的限制框。

本脚本通过直接解析后台元数据，**绕过 UI 限制**，自动寻找并切换至视频支持的最高画质（4K/1080P），同时**暴力移除**播放器内所有诱导扫码的按钮，还原纯净的播放体验。

## ✨ 核心功能 | Features

*   **🔓 画质全解锁**：自动检测并锁定 **4K / 2K / 1080P / 720P** 最高画质，无需登录。
*   **🗑️ 移除流氓UI**：精准猎杀播放器内的 **“App扫码”**、**“自动”**、**“标清 360P”** 等诱导按钮。
*   **🛡️ 安全不误伤**：采用白名单机制，保留 **倍速、音量、全屏、弹幕** 等常用功能，不误伤视频标题或评论。
*   **⚡ 智能检测**：若视频源本身只有单画质，脚本自动休眠，避免错误操作。
*   **🎨 视觉反馈**：切换成功后，右上角弹出荧光绿 Toast 提示 (`🚀 已解锁最高画质: 1080P蓝光`)。

## 🛠️ 安装方法 | Installation

1.  安装浏览器扩展插件 **Tampermonkey (油猴)**:
    *   [Chrome](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
    *   [Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)
    *   [Firefox](https://addons.mozilla.org/zh-CN/firefox/addon/tampermonkey/)
2.  **[点击此处安装脚本](https://github.com/SeekFreeSky/HaoKanQualityUnlock/raw/refs/heads/main/HaoKanQualityUnlock.user.js)** (链接指向你的 GitHub Raw 文件)。
3.  打开任意 [好看视频](https://haokan.baidu.com/) 播放页即可生效。

## ⚙️ 工作原理 | How it works

1.  **能力检测**：脚本启动时读取 `window.__PRELOADED_STATE__` 获取视频真实的流媒体地址列表。
2.  **画质锁定**：根据优先级 (`4K > 2K > 1080P > 720P`) 自动替换 `<video>` 标签的 `src` 源。
3.  **视觉清洗**：通过关键词 (`App`, `扫码`, `360`) 扫描播放器 DOM 节点，隐藏多余的诱导元素。

## 📸 预览 | Preview

*('None')*

*   **处理前**：清晰度显示“标清360P”，点击弹出“请扫码下载客户端”。
*   **处理后**：右下角无多余按钮，画质自动变为高清，右上角提示“已解锁最高画质”。

## 📝 更新日志 | Changelog

### v2.1.0 (Latest)
*   [重构] 内核升级为 Pro 2.0 事件驱动架构，放弃传统的 setInterval 轮询，采用 Object.defineProperty 数据劫持 + MutationObserver DOM 监听，实现零延迟、零 CPU 占用。
*   [新增] 支持 SPA 路由监听（自动播放/切集支持），解决切换视频后画质解锁失效的问题。
*   [优化] 猎杀名单大幅增强，精准移除"标清 / 360P" 等顽固的诱导按钮，修复了旧版本底栏留白的视觉缺陷。
*   [修复] 解决了部分场景下按钮移除不彻底的问题。

### v2.0.0
*   [架构] 引入 Pro 版内核，首次尝试无轮询机制，实现数据流瞬间捕获。
*   [性能] 极大幅度降低浏览器性能消耗。

### v1.0.5
*   [调整] 回滚至 v1.0.3 的稳定架构（死循环轮询模式）。
*   [优化] 将扫描频率从 500ms 提升至 250ms，在保证稳定性的前提下实现视觉上的"秒开"体验。

### v1.0.4
*   [尝试] 引入动态变速引擎（Turbo/Idle 模式），尝试在空闲时降低频率。
*   [修复] 移除 @grant 权限（设为 none），解决沙盒模式下无法读取 window 数据的核心 Bug。
*   [安全] 优化 CSS 注入逻辑，自动检测 DOM 状态，防止脚本报错。

### v1.0.3
*   [修复] 修复 v1.0.2 版本因在 document-start 阶段注入 CSS 导致脚本崩溃的严重 Bug。
*   [稳定] 逻辑回滚至验证过的 V11 版本，确保基础功能的可用性。

### v1.0.2
*   [修复] 彻底移除沙盒隔离，通过原生 JS 注入样式，解决数据读取失败问题。
*   [优化] 引入智能频率逻辑，未获取数据时保持极速扫描。

### v1.0.0
*   [新增] 核心画质解锁逻辑，支持锁定 4K / 1080P。
*   [重构] 采用"视觉猎杀"算法，移除播放器内的"App扫码"诱导按钮。
*   [优化] 增加单画质视频检测，防止脚本在低画质视频上报错。
*   [UI] 新增荧光绿操作成功提示框 (🚀 已解锁最高画质)。


## ⚖️ 免责声明 | Disclaimer

*   本脚本仅供学习与技术交流使用，请勿用于商业用途。
*   脚本仅在前端运行，不修改任何后端数据，不破坏网站完整性。

---
<p align="center">Made with ❤️ by SeekFreeSky</p>
