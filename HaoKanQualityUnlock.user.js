// ==UserScript==
// @name         好看视频画质自动解锁
// @namespace    https://github.com/SeekFreeSky/HaoKanQualityUnlock
// @version      1.0.0
// @description  [画质重构] 自动锁定 4K/2K/1080P/720P 最高画质；通过“App扫码”特征精准移除播放器内的多余按钮；保留倍速/音量，不误伤弹幕。
// @author       SeekFreeSky
// @downloadURL  https://github.com/SeekFreeSky/HaoKanQualityUnlock/raw/refs/heads/main/HaoKanQualityUnlock.user.js
// @updateURL    https://github.com/SeekFreeSky/HaoKanQualityUnlock/raw/refs/heads/main/HaoKanQualityUnlock.user.js
// @match        *://haokan.baidu.com/v?*
// @grant        GM_addStyle
// @run-at       document-start
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // ================= 配置区 =================
    const CONFIG = {
        // 画质优先级：从高到低
        priority: ['4k', '2k', '1080p', 'sc', 'hd', 'sd'],
        
        // 视觉猎杀名单：包含这些关键词的按钮将被移除
        targetKeywords: [
            'App', '扫码',          // 核心特征
            '4K', '2K', '1080',     // 高端画质标识
            '蓝光', '超清', '高清', '标清', 
            '360', '480', '720',    // 分辨率
            '自动', '画质'          // 兜底
        ],

        // 白名单：绝对安全的关键词
        safeKeywords: ['倍速', '音量', '弹幕', '设置', '全屏', '退出', ':', 'X', 'x', '评论'],
        
        // 扫描频率 (ms)
        interval: 500
    };

    // ================= 样式区 =================
    const css = `
        .hk-unlock-toast {
            position: absolute;
            top: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.85);
            color: #00ff9d;
            padding: 8px 16px;
            border-radius: 4px;
            z-index: 999999;
            font-weight: 600;
            font-size: 13px;
            pointer-events: none;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            border-left: 3px solid #00ff9d;
            animation: hkSlideIn 0.3s ease-out forwards;
        }
        @keyframes hkSlideIn {
            from { opacity: 0; transform: translateX(20px); }
            to { opacity: 1; transform: translateX(0); }
        }
        @keyframes hkFadeOut {
            to { opacity: 0; transform: translateY(-10px); }
        }
        /* 辅助隐藏 */
        .art-control-clarity { display: none !important; }
    `;
    GM_addStyle(css);

    // ================= 核心逻辑 =================

    let bestQuality = null;
    let isSingleQuality = false; // 标记是否为单画质视频
    let timerId = null;

    /**
     * 模块一：数据加载与画质获取
     * 持续尝试获取视频数据，直到成功或确认为单画质
     */
    function tryLoadVideoData() {
        // 如果已经找到最高画质，或者确定是单画质，就不再重复解析
        if (bestQuality || isSingleQuality) return;

        try {
            const state = window.__PRELOADED_STATE__;
            // 必须等待 curVideoMeta 和 clarityUrl 加载完成
            if (state && state.curVideoMeta && state.curVideoMeta.clarityUrl) {
                const list = state.curVideoMeta.clarityUrl;
                
                // 情况A: 列表只有1个或更少，说明无需解锁
                if (list.length <= 1) {
                    // console.log('[HaoKan Unlock] 检测到单画质视频，脚本保持静默。');
                    isSingleQuality = true;
                    return;
                }

                // 情况B: 寻找最高画质
                for (let type of CONFIG.priority) {
                    const match = list.find(item => item.key === type);
                    if (match) {
                        bestQuality = { url: match.url, name: match.title };
                        console.log(`[HaoKan Unlock] 成功获取画质: ${bestQuality.name}`);
                        break;
                    }
                }
            }
        } catch (e) {
            // 数据还没准备好，等待下一次循环
        }
    }

    /**
     * 模块二：视觉猎杀 (UI Cleaner)
     * 移除诱导按钮
     */
    function visualKiller() {
        const player = document.querySelector('.art-video-player') || document.querySelector('#mk_player');
        if (!player) return;

        const candidates = player.querySelectorAll('span, div, li, p, a');

        candidates.forEach(el => {
            if (el.dataset.hkChecked) return;
            const text = el.innerText.trim();
            if (!text) return;

            if (text.length > 15) { el.dataset.hkChecked = "true"; return; }
            if (CONFIG.safeKeywords.some(w => text.includes(w))) { el.dataset.hkChecked = "true"; return; }

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
                    if (container.style.display !== 'none') {
                        container.style.display = 'none';
                        container.setAttribute('data-cleaned-by-script', 'true');
                    }
                }
            }
            el.dataset.hkChecked = "true";
        });
    }

    /**
     * 模块三：画质锁定
     * 强制切换视频源
     */
    function forceSwitch() {
        // 如果还没找到画质，或者确定是单画质，则不执行切换
        if (!bestQuality || isSingleQuality) return;

        const video = document.querySelector('video');
        if (!video) return;

        // 核心逻辑：地址不一致且非 Blob 流时切换
        if (video.src && video.src !== bestQuality.url && !video.src.startsWith('blob:')) {
            const currentTime = video.currentTime;
            const isPaused = video.paused;
            
            video.src = bestQuality.url;
            video.currentTime = currentTime;
            
            if (!isPaused) video.play().catch(() => {});
            
            showToast(`🚀 已解锁最高画质: ${bestQuality.name}`);
        }
    }

    /**
     * 模块四：消息提示
     */
    function showToast(text) {
        if (document.getElementById('hk-unlock-toast')) return;
        const div = document.createElement('div');
        div.id = 'hk-unlock-toast';
        div.className = 'hk-unlock-toast';
        div.innerText = text;
        const player = document.querySelector('.art-video-player') || document.body;
        player.appendChild(div);
        setTimeout(() => { 
            div.style.animation = 'hkFadeOut 0.5s forwards';
            setTimeout(() => div.remove(), 500); 
        }, 3500);
    }

    // ================= 引擎启动 =================
    
    function engineLoop() {
        // 1. 持续尝试加载数据 (直到成功)
        tryLoadVideoData();
        
        // 2. 持续清理 UI
        visualKiller();
        
        // 3. 锁定画质 (数据加载成功后才会执行)
        forceSwitch();
    }

    // 启动定时器
    timerId = setInterval(engineLoop, CONFIG.interval);

})();
