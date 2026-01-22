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
        // 针对 "标清 360P" 以及未来可能出现的 "自动/画质"
        targetKeywords: [
            'App', '扫码',          // 核心特征：扫码引流
            '4K', '2K', '1080',     // 高端画质标识
            '蓝光', '超清', '高清', '标清', // 中文描述
            '360', '480', '720',    // 分辨率数字 (覆盖默认的 360P)
            '自动', '画质'          // 兜底：防止未来百度改版为默认显示“自动”
        ],

        // 白名单：绝对安全的关键词（包含这些词的元素不处理）
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
            color: #00ff9d; /* 荧光绿，代表成功/解锁 */
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
        
        /* 辅助隐藏：针对部分顽固CSS类名预埋 */
        .art-control-clarity { display: none !important; }
    `;
    GM_addStyle(css);

    // ================= 核心逻辑 =================

    let bestQuality = null;
    let hasCheckedCapability = false;
    let timerId = null;

    /**
     * 模块一：能力检测
     * 检查当前视频是否支持多画质，如果只有一种画质则停止脚本运行，避免误操作。
     */
    function checkVideoCapability() {
        try {
            const state = window.__PRELOADED_STATE__;
            if (state && state.curVideoMeta && state.curVideoMeta.clarityUrl) {
                const list = state.curVideoMeta.clarityUrl;
                
                // 如果只有1种画质，说明视频本身资源有限，脚本休眠
                if (list.length <= 1) {
                    console.log('[HaoKan Unlock] 单画质视频，脚本自动休眠。');
                    return false;
                }

                // 寻找最高画质
                for (let type of CONFIG.priority) {
                    const match = list.find(item => item.key === type);
                    if (match) {
                        bestQuality = { url: match.url, name: match.title };
                        break;
                    }
                }
                return true;
            }
        } catch (e) {
            console.error('[HaoKan Unlock] 元数据解析异常', e);
        }
        // 如果获取失败，默认允许运行（盲狙模式）
        return true; 
    }

    /**
     * 模块二：视觉猎杀 (UI Cleaner)
     * 基于文本特征移除“App扫码”、“360P”等无法点击或诱导性的按钮
     */
    function visualKiller() {
        const player = document.querySelector('.art-video-player') || document.querySelector('#mk_player');
        if (!player) return;

        // 查找可能的按钮容器 (span, div, li, p)
        // 增加 'a' 标签以防万一
        const candidates = player.querySelectorAll('span, div, li, p, a');

        candidates.forEach(el => {
            // 避免重复检查
            if (el.dataset.hkChecked) return;

            // 仅获取直接文本，避免获取到子元素文本
            const text = el.innerText.trim();
            if (!text) return;

            // [安全阀 1] 字数限制：按钮文字通常较短，超过15字可能是弹幕或标题
            if (text.length > 15) {
                el.dataset.hkChecked = "true";
                return;
            }

            // [安全阀 2] 白名单检查
            if (CONFIG.safeKeywords.some(w => text.includes(w))) {
                el.dataset.hkChecked = "true";
                return;
            }

            // [目标锁定] 命中关键词
            if (CONFIG.targetKeywords.some(w => text.includes(w))) {
                let isTarget = false;

                // 强特征匹配 (App/扫码/360) - 针对你提到的默认 "标清 360P"
                if (text.includes('App') || text.includes('360') || text.includes('扫码') || text.includes('自动')) {
                    isTarget = true;
                } else {
                    // 弱特征匹配：检查父级结构是否像控制栏
                    let parent = el.parentElement;
                    if (el.tagName === 'LI' || (parent && parent.tagName === 'LI')) isTarget = true;
                    if (parent && parent.className && parent.className.includes('control')) isTarget = true;
                }

                if (isTarget) {
                    // 向上查找最外层的容器进行隐藏
                    const container = el.closest('li') || el.closest('.clarity-btn') || el;
                    
                    if (container.style.display !== 'none') {
                        container.style.display = 'none';
                        container.setAttribute('data-cleaned-by-script', 'true');
                        // console.log(`[HaoKan Unlock] Removed UI: ${text}`);
                    }
                }
            }
            el.dataset.hkChecked = "true";
        });
    }

    /**
     * 模块三：画质锁定
     * 强制将视频源替换为最高画质
     */
    function forceSwitch() {
        if (!bestQuality) return;

        const video = document.querySelector('video');
        if (!video) return;

        // 核心逻辑：地址不一致且非 Blob 流时切换
        if (video.src && video.src !== bestQuality.url && !video.src.startsWith('blob:')) {
            const currentTime = video.currentTime;
            const isPaused = video.paused;
            
            video.src = bestQuality.url;
            video.currentTime = currentTime;
            
            if (!isPaused) video.play().catch(() => { /* 忽略自动播放拦截错误 */ });
            
            showToast(`🚀 已解锁最高画质: ${bestQuality.name}`);
        }
    }

    /**
     * 模块四：消息提示
     */
    function showToast(text) {
        // 防止重复显示
        if (document.getElementById('hk-unlock-toast')) return;
        
        const div = document.createElement('div');
        div.id = 'hk-unlock-toast';
        div.className = 'hk-unlock-toast';
        div.innerText = text;
        
        const player = document.querySelector('.art-video-player') || document.body;
        player.appendChild(div);
        
        // 3.5秒后自动移除
        setTimeout(() => { 
            div.style.animation = 'hkFadeOut 0.5s forwards';
            setTimeout(() => div.remove(), 500); 
        }, 3500);
    }

    // ================= 引擎启动 =================
    
    function engineLoop() {
        // 首次运行：环境检查
        if (!hasCheckedCapability) {
            const shouldRun = checkVideoCapability();
            hasCheckedCapability = true;
            if (!shouldRun) {
                clearInterval(timerId); // 环境不满足，停止脚本
                return;
            }
        }
        
        // 循环执行任务
        visualKiller();
        forceSwitch();
    }

    // 启动定时器
    timerId = setInterval(engineLoop, CONFIG.interval);

})();
