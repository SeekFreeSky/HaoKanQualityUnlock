// ==UserScript==
// @name         好看视频画质自动解锁
// @namespace    https://github.com/SeekFreeSky/HaoKanQualityUnlock
// @version      2.0.0
// @description  利用 MutationObserver 和 Object.defineProperty 实现的零轮询、事件驱动型解锁脚本。
// @match        *://haokan.baidu.com/v?*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    console.log('🚀 Haokan Unlock Pro: 引擎启动');

    // 配置
    const CONFIG = {
        priority: ['4k', '2k', '1080p', 'sc', 'hd', 'sd'],
        targetKeywords: ['App', '扫码', '4K', '2K', '1080', '360', '自动', '画质']
    };

    let bestQuality = null;

    // -----------------------------------------------------------
    // 1. 数据劫持 (Data Hijacking)
    // 当百度写入 __PRELOADED_STATE__ 时，瞬间获取画质数据
    // -----------------------------------------------------------
    let _realState = window.__PRELOADED_STATE__;

    Object.defineProperty(window, '__PRELOADED_STATE__', {
        get: function() {
            return _realState;
        },
        set: function(val) {
            _realState = val;
            // 数据被写入了！立刻解析画质
            console.log('⚡ 数据劫持: 捕获到视频数据');
            parseQuality(val);
        },
        configurable: true
    });

    // 如果脚本运行晚了，数据已经存在了，手动触发一次
    if (_realState) parseQuality(_realState);

    function parseQuality(state) {
        if (state && state.curVideoMeta && state.curVideoMeta.clarityUrl) {
            const list = state.curVideoMeta.clarityUrl;
            if (list.length > 1) {
                for (let type of CONFIG.priority) {
                    const match = list.find(item => item.key === type);
                    if (match) {
                        bestQuality = { url: match.url, name: match.title };
                        console.log(`✅ 锁定目标画质: ${bestQuality.name}`);
                        // 尝试切一次
                        forceSwitch();
                        break;
                    }
                }
            }
        }
    }

    // -----------------------------------------------------------
    // 2. DOM 监听 (MutationObserver)
    // 监控页面元素变化，只在必要时执行 UI 清洗
    // -----------------------------------------------------------
    const observer = new MutationObserver((mutations) => {
        let shouldClean = false;

        // 简单粗暴：只要有节点被添加，就尝试清洗
        // 为了性能，可以检查 mutation.target 是否在播放器范围内
        for (const mutation of mutations) {
            if (mutation.addedNodes.length > 0) {
                shouldClean = true;
                break;
            }
        }

        if (shouldClean) {
            visualKiller();
            forceSwitch(); // DOM 变动通常意味着可能切集或加载了新播放器
        }
    });

    // 等待 body 出现后再开始监听
    const waitBody = setInterval(() => {
        if (document.body) {
            clearInterval(waitBody);
            // 监听 body 的子孙节点变化
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
            console.log('👀 DOM 监听器已挂载');
        }
    }, 50);

    // -----------------------------------------------------------
    // 3. 执行逻辑 (业务层)
    // -----------------------------------------------------------

    function visualKiller() {
        const player = document.querySelector('.art-video-player') || document.querySelector('#mk_player');
        if (!player) return;

        // 这里逻辑不变，依然是查找并隐藏
        const candidates = player.querySelectorAll('span, div, li');
        candidates.forEach(el => {
            if (el.dataset.cleaned) return;
            const text = el.innerText || "";
            if (text.length < 15 && CONFIG.targetKeywords.some(k => text.includes(k))) {
                // 排除白名单逻辑省略...为了演示简洁
                if (!text.includes('倍速') && !text.includes('全屏')) {
                     const container = el.closest('li') || el;
                     container.style.display = 'none';
                     container.setAttribute('data-cleaned', 'true');
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

    // -----------------------------------------------------------
    // 4. 样式注入
    // -----------------------------------------------------------
    const style = document.createElement('style');
    style.textContent = `.art-control-clarity { display: none !important; }`;
    (document.head || document.documentElement).appendChild(style);

})();
