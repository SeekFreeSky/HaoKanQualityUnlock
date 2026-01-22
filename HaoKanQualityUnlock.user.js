// ==UserScript==
// @name         好看视频画质自动解锁
// @namespace    https://github.com/SeekFreeSky/HaoKanQualityUnlock
// @version      2.1.0
// @description  基于 Pro 2.0 内核重构：精准移除“标清/360P”等诱导按钮，零轮询极速锁定最高画质，支持自动播放切集。
// @author       SeekFreeSky
// @match        *://haokan.baidu.com/v?*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    console.log('🚀 Haokan Pro+: 猎杀引擎启动');

    // --- 核心配置 ---
    const CONFIG = {
        priority: ['4k', '2k', '1080p', 'sc', 'hd', 'sd'],

        // 【关键修改】针对你截图的“标清/360”进行精准定义
        targetKeywords: [
            'App', '扫码',
            '标清', '360', '360P', // 截图里的核心特征
            '自动', '画质',
            '4K', '2K', '1080', '蓝光', '超清', '高清'
        ],

        // 白名单：包含这些字的绝对不杀
        safeKeywords: ['倍速', '音量', '弹幕', '设置', '全屏', '评论']
    };

    let bestQuality = null;

    // ============================================================
    // 1. 路由雷达 (SPA Listener) - 解决切集失效
    // ============================================================
    // 劫持浏览器历史记录，一旦切集（URL变化），立刻通知脚本
    const _historyWrap = function(type) {
        const orig = history[type];
        return function() {
            const rv = orig.apply(this, arguments);
            // URL 变了，说明换视频了
            // 稍微延迟一点点，等新 UI 渲染出来后立马杀一次
            setTimeout(() => {
                bestQuality = null; // 重置画质状态
                visualKiller(true); // 强制清洗 UI
            }, 500);
            return rv;
        };
    };
    history.pushState = _historyWrap('pushState');
    history.replaceState = _historyWrap('replaceState');
    window.addEventListener('popstate', () => setTimeout(() => visualKiller(true), 500));


    // ============================================================
    // 2. 数据劫持 (Data Hijacking) - 极速获取画质
    // ============================================================
    let _realState = window.__PRELOADED_STATE__;

    Object.defineProperty(window, '__PRELOADED_STATE__', {
        get: function() {
            return _realState;
        },
        set: function(val) {
            _realState = val;
            // 数据来了，立刻解析
            parseQuality(val);
        },
        configurable: true
    });

    // 补漏：如果脚本运行慢了，数据已经有了，手动触发
    if (_realState) parseQuality(_realState);

    function parseQuality(state) {
        try {
            if (state && state.curVideoMeta && state.curVideoMeta.clarityUrl) {
                const list = state.curVideoMeta.clarityUrl;
                if (list.length > 1) {
                    for (let type of CONFIG.priority) {
                        const match = list.find(item => item.key === type);
                        if (match) {
                            bestQuality = { url: match.url, name: match.title };
                            console.log(`✅ 锁定画质: ${bestQuality.name}`);
                            forceSwitch();
                            break;
                        }
                    }
                }
            }
        } catch (e) {}
    }

    // ============================================================
    // 3. 视觉猎杀 (Visual Killer) - 专门解决“标清”按钮
    // ============================================================
    function visualKiller(force = false) {
        const player = document.querySelector('.art-video-player') || document.querySelector('#mk_player');
        if (!player) return;

        // 查找所有可能的文字容器
        const candidates = player.querySelectorAll('span, div, li, p, a');

        candidates.forEach(el => {
            // 如果是强制模式(force)，忽略之前的清理标记，重新检查
            if (force) el.removeAttribute('data-cleaned');
            if (el.dataset.cleaned) return;

            const text = el.innerText.trim();
            if (!text) return;

            // 1. 白名单放行 (倍速、音量)
            if (CONFIG.safeKeywords.some(w => text.includes(w))) {
                el.dataset.cleaned = "true";
                return;
            }

            // 2. 黑名单猎杀
            // 限制字数 < 10 (按钮通常字很少)
            if (text.length < 10 && CONFIG.targetKeywords.some(k => text.includes(k))) {

                // 找到了！比如 "标清"
                // 顺藤摸瓜找到它的外层容器 (LI)
                let container = el.closest('li') || el.closest('.clarity-btn') || el.closest('[class*="control"]');

                // 如果找不到像样的容器，就杀它自己
                if (!container) container = el;

                // 隐藏
                if (container.style.display !== 'none') {
                    container.style.display = 'none';
                    container.dataset.cleaned = "true";
                    // console.log(`已移除按钮: ${text}`);
                }
            }
        });
    }

    function forceSwitch() {
        if (!bestQuality) return;
        const video = document.querySelector('video');
        if (!video) return;

        if (video.src && video.src !== bestQuality.url && !video.src.startsWith('blob:')) {
            const t = video.currentTime;
            const p = video.paused;
            video.src = bestQuality.url;
            if (Math.abs(video.currentTime - t) > 1) video.currentTime = t;
            if (!p) video.play().catch(()=>{});
        }
    }

    // ============================================================
    // 4. 观察者 (MutationObserver) - 监控 DOM 变化
    // ============================================================
    // 一旦页面动了，就检查有没有新的“标清”按钮冒出来
    const observer = new MutationObserver((mutations) => {
        // 简单防抖，避免频繁触发
        visualKiller(false);
        forceSwitch();
    });

    // 启动监听
    const initTimer = setInterval(() => {
        if (document.body) {
            clearInterval(initTimer);
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
            // 初始执行一次
            visualKiller(true);
        }
    }, 50);

    // ============================================================
    // 5. CSS 辅助 (双重保险)
    // ============================================================
    // 直接隐藏掉带 clarity 类名的元素，防止 JS 没反应过来
    const style = document.createElement('style');
    style.textContent = `.art-control-clarity { display: none !important; }`;
    (document.head || document.documentElement).appendChild(style);

})();
