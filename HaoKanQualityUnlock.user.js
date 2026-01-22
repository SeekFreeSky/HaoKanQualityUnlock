// ==UserScript==
// @name         好看视频画质自动解锁
// @namespace    https://github.com/SeekFreeSky/HaoKanQualityUnlock
// @version      1.0.5
// @description  [画质重构] 自动锁定 4K/2K/1080P/720P 最高画质；通过“App扫码”特征精准移除播放器内的多余按钮；保留倍速/音量，不误伤弹幕。（基于 V11 架构，250ms 极速响应）
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
        priority: ['4k', '2k', '1080p', 'sc', 'hd', 'sd'],
        targetKeywords: ['App', '扫码', '4K', '2K', '1080', '蓝光', '超清', '高清', '标清', '360', '480', '720', '自动', '画质'],
        safeKeywords: ['倍速', '音量', '弹幕', '设置', '全屏', '退出', ':', 'X', 'x', '评论']
    };

    // ================= 样式注入 (Safe Mode) =================
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
        .art-control-clarity { display: none !important; }
    `;

    function safeInjectStyle() {
        if (document.getElementById('hk-injected-style')) return;
        const target = document.head || document.documentElement;
        if (!target) return; 
        try {
            const style = document.createElement('style');
            style.id = 'hk-injected-style';
            style.textContent = cssContent;
            target.appendChild(style);
        } catch(e) {}
    }

    // ================= 核心逻辑 (V11 原版复刻) =================

    let bestQuality = null;
    let lastUrl = location.href;

    // 1. 获取数据
    function tryGetQuality() {
        if (bestQuality) return; 
        try {
            const state = window.__PRELOADED_STATE__;
            if (state && state.curVideoMeta && state.curVideoMeta.clarityUrl) {
                const list = state.curVideoMeta.clarityUrl;
                if (list.length <= 1) return; 

                for (let type of CONFIG.priority) {
                    const match = list.find(item => item.key === type);
                    if (match) {
                        bestQuality = { url: match.url, name: match.title };
                        break;
                    }
                }
            }
        } catch (e) {}
    }

    // 2. 视觉猎杀
    function visualKiller() {
        const player = document.querySelector('.art-video-player') || document.querySelector('#mk_player');
        if (!player) return;

        const candidates = player.querySelectorAll('span, div, li, p, a');
        candidates.forEach(el => {
            if (el.dataset.hkChecked) return;
            const text = el.innerText.trim();
            if (!text) return;

            if (text.length > 15 || CONFIG.safeKeywords.some(w => text.includes(w))) {
                el.dataset.hkChecked = "true";
                return;
            }

            if (CONFIG.targetKeywords.some(w => text.includes(w))) {
                let isTarget = false;
                if (text.includes('App') || text.includes('360') || text.includes('扫码') || text.includes('自动')) isTarget = true;
                else {
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

    // 3. 强制切换
    function forceSwitch() {
        if (!bestQuality) return;
        const video = document.querySelector('video');
        if (!video) return;

        if (video.src && video.src !== bestQuality.url && !video.src.startsWith('blob:')) {
            const currentTime = video.currentTime;
            const isPaused = video.paused;
            video.src = bestQuality.url;
            if (Math.abs(video.currentTime - currentTime) > 1) video.currentTime = currentTime;
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

    // ================= 引擎启动 =================
    
    // 250ms = 0.25秒，这个频率是“丝滑”与“性能”的最佳平衡点
    setInterval(() => {
        try {
            safeInjectStyle();
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                bestQuality = null;
            }
            tryGetQuality();
            visualKiller();
            forceSwitch();
        } catch (e) {}
    }, 250);

})();
