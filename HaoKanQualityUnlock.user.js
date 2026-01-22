// ==UserScript==
// @name         好看视频画质自动解锁222222222
// @namespace    https://github.com/SeekFreeSky/HaoKanQualityUnlock
// @version      1.0.4
// @description  [画质重构] 自动锁定 4K/2K/1080P/720P 最高画质；通过“App扫码”特征精准移除播放器内的多余按钮；采用动态心跳机制（刚加载时高频扫描，后续低频守护），既快又不卡。
// @author       SeekFreeSky
// @downloadURL  https://github.com/SeekFreeSky/HaoKanQualityUnlock/raw/refs/heads/main/HaoKanQualityUnlock.user.js
// @updateURL    https://github.com/SeekFreeSky/HaoKanQualityUnlock/raw/refs/heads/main/HaoKanQualityUnlock.user.js
// @match        *://haokan.baidu.com/v?*
// @grant        none
// @run-at       document-start
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // ================= 配置区 =================
    const CONFIG = {
        // 画质优先级
        priority: ['4k', '2k', '1080p', 'sc', 'hd', 'sd'],

        // 视觉猎杀名单：包含这些关键词的按钮将被移除
        targetKeywords: [
            'App', '扫码',          // 核心特征
            '4K', '2K', '1080',     // 高端画质
            '蓝光', '超清', '高清', '标清',
            '360', '480', '720',    // 分辨率
            '自动', '画质'          // 兜底
        ],

        // 白名单：绝对安全的关键词
        safeKeywords: ['倍速', '音量', '弹幕', '设置', '全屏', '退出', ':', 'X', 'x', '评论']
    };

    // ================= 样式注入 (无沙盒安全版) =================
    const cssContent = `
        .hk-unlock-toast {
            position: absolute; top: 20px; right: 20px;
            background: rgba(0, 0, 0, 0.85); color: #00ff9d;
            padding: 8px 16px; border-radius: 4px; z-index: 999999;
            font-weight: 600; font-size: 13px; pointer-events: none;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-family: system-ui, sans-serif;
            border-left: 3px solid #00ff9d;
            animation: hkSlideIn 0.3s ease-out forwards;
        }
        @keyframes hkSlideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes hkFadeOut { to { opacity: 0; transform: translateY(-10px); } }
        /* 辅助隐藏 */
        .art-control-clarity { display: none !important; }
    `;

    function injectStyle() {
        // 防止重复注入
        if (document.getElementById('hk-style-injected')) return;
        // 确保 DOM 根节点已存在
        const root = document.head || document.documentElement;
        if (root) {
            const style = document.createElement('style');
            style.id = 'hk-style-injected';
            style.textContent = cssContent;
            root.appendChild(style);
        }
    }

    // ================= 核心逻辑 =================

    let bestQuality = null;
    let isSingleQuality = false;
    let lastUrl = location.href;

    // 计时器变量：用于动态调整频率
    let startTime = Date.now();

    /**
     * 模块一：数据加载
     */
    function tryLoadVideoData() {
        if (bestQuality || isSingleQuality) return;
        try {
            // @grant none 模式下，直接读取页面 window 对象
            const state = window.__PRELOADED_STATE__;

            if (state && state.curVideoMeta && state.curVideoMeta.clarityUrl) {
                const list = state.curVideoMeta.clarityUrl;

                // 单画质判定
                if (list.length <= 1) {
                    isSingleQuality = true;
                    return;
                }

                // 多画质匹配
                for (let type of CONFIG.priority) {
                    const match = list.find(item => item.key === type);
                    if (match) {
                        bestQuality = { url: match.url, name: match.title };
                        // console.log(`[Unlock] Target: ${bestQuality.name}`);
                        break;
                    }
                }
            }
        } catch (e) {
            // ignore
        }
    }

    /**
     * 模块二：视觉猎杀
     */
    function visualKiller() {
        const player = document.querySelector('.art-video-player') || document.querySelector('#mk_player');
        if (!player) return;

        const candidates = player.querySelectorAll('span, div, li, p, a');

        candidates.forEach(el => {
            if (el.dataset.hkChecked) return;
            const text = el.innerText.trim();
            if (!text) return;

            // 安全检查
            if (text.length > 15 || CONFIG.safeKeywords.some(w => text.includes(w))) {
                el.dataset.hkChecked = "true";
                return;
            }

            // 特征匹配
            if (CONFIG.targetKeywords.some(w => text.includes(w))) {
                let isTarget = false;
                if (text.includes('App') || text.includes('360') || text.includes('扫码') || text.includes('自动')) {
                    isTarget = true;
                } else {
                    let parent = el.parentElement;
                    if (el.tagName === 'LI' || (parent && parent.tagName === 'LI')) isTarget = true;
                    if (parent && parent.className && parent.className.includes('control')) isTarget = true;
                }

                if (isTarget) {
                    const container = el.closest('li') || el.closest('.clarity-btn') || el;
                    if (container && container.style.display !== 'none') {
                        container.style.display = 'none';
                        container.setAttribute('data-cleaned', 'true');
                    }
                }
            }
            el.dataset.hkChecked = "true";
        });
    }

    /**
     * 模块三：画质锁定
     */
    function forceSwitch() {
        if (!bestQuality || isSingleQuality) return;
        const video = document.querySelector('video');
        if (!video) return;

        if (video.src && video.src !== bestQuality.url && !video.src.startsWith('blob:')) {
            const currentTime = video.currentTime;
            const isPaused = video.paused;
            video.src = bestQuality.url;

            if (Math.abs(video.currentTime - currentTime) > 1) {
                video。currentTime = currentTime;
            }

            if (!isPaused) video.play().catch(() => {});
            showToast(`🚀 已解锁最高画质: ${bestQuality.name}`);
        }
    }

    function showToast(text) {
        if (document.getElementById('hk-unlock-toast')) return;
        const div = document.createElement('div');
        div.id = 'hk-unlock-toast';
        div.className = 'hk-unlock-toast';
        div.innerText = text;
        const player = document.querySelector('.art-video-player') || document.body;
        if (player) player.appendChild(div);
        setTimeout(() => {
            div.style.animation = 'hkFadeOut 0.5s forwards';
            setTimeout(() => div.remove(), 500);
        }, 3500);
    }

    // ================= 动态变速引擎 (Turbo Engine) =================

    function engineLoop() {
        // 0. 安全注入样式
        injectStyle();

        // 1. 自动播放检测 (切集重置)
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            // 重置所有状态，包括计时器，触发新一轮 Turbo 模式
            bestQuality = null;
            isSingleQuality = false;
            startTime = Date.当前();
        }

        // 2. 执行核心任务
        tryLoadVideoData();
        visualKiller();
        forceSwitch();

        // 3. 计算下一次频率 (Dynamic Interval)
        const now = Date.当前();
        const elapsed = now - startTime;
        let nextInterval = 2000;

        if (!bestQuality && !isSingleQuality) {
            // [阶段0] 还没拿到数据？ -> 100ms 极速狂奔
            nextInterval = 100;
        } else if (elapsed < 5000) {
            // [阶段1] 刚锁定画质 (0-5秒) -> 200ms 高频守护 (防止UI反弹)
            nextInterval = 200;
        } else if (elapsed < 15000) {
            // [阶段2] 稳定期 (5-15秒) -> 500ms 正常巡航
            nextInterval = 500;
        } else {
            // [阶段3] 待机期 (15秒+) -> 2000ms 省电模式
            nextInterval = 2000;
        }

        setTimeout(engineLoop, nextInterval);
    }

    // 启动引擎
    engineLoop();

})();
