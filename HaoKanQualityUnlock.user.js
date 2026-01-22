// ==UserScript==
// @name         好看视频画质自动解锁
// @namespace    https://github.com/SeekFreeSky/HaoKanQualityUnlock
// @version      1.0.2
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
        
        // 视觉猎杀名单
        targetKeywords: [
            'App', '扫码', '4K', '2K', '1080', 
            '蓝光', '超清', '高清', '标清', 
            '360', '480', '720', '自动', '画质'
        ],

        // 白名单
        safeKeywords: ['倍速', '音量', '弹幕', '设置', '全屏', '退出', ':', 'X', 'x', '评论']
    };

    // ================= 样式注入 (原生无沙盒版) =================
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
    
    // 手动注入样式，不依赖 GM_addStyle
    const style = document.createElement('style');
    style.textContent = cssContent;
    (document.head || document.documentElement).appendChild(style);

    // ================= 核心逻辑 =================

    let bestQuality = null;
    let isSingleQuality = false;
    let lastUrl = location.href;
    const startTime = Date.now();

    /**
     * 模块一：数据加载
     * 直接访问 window 对象 (非沙盒模式下有效)
     */
    function tryLoadVideoData() {
        if (bestQuality || isSingleQuality) return;
        try {
            // 这里是关键：@grant none 模式下，这个 window 就是网页原本的 window
            const state = window.__PRELOADED_STATE__;
            
            if (state && state.curVideoMeta && state.curVideoMeta.clarityUrl) {
                const list = state.curVideoMeta.clarityUrl;
                if (list.length <= 1) {
                    isSingleQuality = true;
                    // console.log('单画质视频，跳过处理');
                    return;
                }
                for (let type of CONFIG.priority) {
                    const match = list.find(item => item.key === type);
                    if (match) {
                        bestQuality = { url: match.url, name: match.title };
                        // console.log(`[HaoKan Unlock] 锁定画质: ${bestQuality.name}`);
                        break;
                    }
                }
            }
        } catch (e) {
            // console.error(e);
        }
    }

    /**
     * 模块二：视觉猎杀
     */
    function visualKiller() {
        const player = document.querySelector('.art-video-player') || document.querySelector('#mk_player');
        if (!player) return;

        // 仅查找可能的文本容器
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
                // 强匹配
                if (text.includes('App') || text.includes('360') || text.includes('扫码') || text.includes('自动')) {
                    isTarget = true;
                } else {
                    // 弱匹配：检查结构
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

        // 只有当 src 真的不一样时才切换，避免鬼畜
        if (video.src && video.src !== bestQuality.url && !video.src.startsWith('blob:')) {
            const currentTime = video.currentTime;
            const isPaused = video.paused;
            
            video.src = bestQuality.url;
            
            // 只有当时间差较大时才同步时间，防止微小抖动
            if (Math.abs(video.currentTime - currentTime) > 1) {
                video.currentTime = currentTime;
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
        player.appendChild(div);
        setTimeout(() => { 
            div.style.animation = 'hkFadeOut 0.5s forwards';
            setTimeout(() => div.remove(), 500); 
        }, 3500);
    }

    // ================= 动态变速引擎 =================
    
    function engineLoop() {
        // 自动播放切集检测
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            bestQuality = null;
            isSingleQuality = false;
            // 切集后立即重置状态，等待下一次循环抓取新数据
        }

        tryLoadVideoData();
        visualKiller();
        forceSwitch();

        // 动态频率计算
        const now = Date.当前();
        const elapsed = now - startTime;
        let nextInterval = 2000;

        // 逻辑：
        // 1. 如果还没拿到画质数据，说明页面正在加载，必须暴力快刷 (100ms)
        // 2. 如果已经拿到画质了，前5秒继续快刷以处理自动播放的DOM变化
        // 3. 5秒后进入巡航模式
        
        if (!bestQuality && !isSingleQuality) {
            nextInterval = 100; // 还没拿到数据？全力冲刺！
        } else if (elapsed < 5000) {
            nextInterval = 200; // 刚拿到数据，维持高频防止UI反弹
        } else {
            nextInterval = 1000; // 稳定后，每秒检查一次即可
        }

        setTimeout(engineLoop, nextInterval);
    }

    // 启动引擎
    engineLoop();

})();
