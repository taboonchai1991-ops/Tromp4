// ================================================================
//  image-editor.js – AI Image Studio (เวอร์ชันสมบูรณ์)
//  รวมฟังก์ชัน: พื้นฐาน, Undo/Redo, Slider, หมุน/พลิก, Crop, Download,
//  Resize, Text, Sharpen, Vignette, Grain, Selection, Preset,
//  Multi Upload, Share, Before/After, Opacity, Lens Flare,
//  Custom Filter Builder
//  ต้องเรียก initImageEditor() เมื่อ DOM พร้อม
// ================================================================

(function(global) {
    'use strict';

    // ---- ตรวจสอบและอ้างอิง DOM หลัก ----
    const container = document.getElementById('image-tab');
    if (!container) {
        console.error('❌ ไม่พบ element #image-tab');
        return;
    }

    // ฟังก์ชันช่วยค้นหา element และสร้างถ้าไม่มี
    function getEl(selector, context = container) {
        let el = context.querySelector(selector);
        if (!el) console.warn(`⚠️ ไม่พบ element: ${selector}`);
        return el;
    }

    function ensureEl(selector, html, context = container) {
        let el = context.querySelector(selector);
        if (!el) {
            el = document.createElement('div');
            el.id = selector.replace('#', '');
            el.innerHTML = html;
            context.appendChild(el);
        }
        return el;
    }

    // ---- อ้างอิงองค์ประกอบที่มีอยู่แล้ว ----
    const grid = getEl('#grid');
    const img = getEl('#canvasImg');
    const canvasWrap = getEl('#canvasWrap');
    const promptEl = getEl('#promptImage');
    const applyBtn = getEl('#applyBtn');
    const toast = getEl('#toast');
    const toastMsg = getEl('#toastMsg');
    const imgLabel = getEl('#imgLabel');
    const filterLabel = getEl('#filterLabel');
    const charCount = getEl('#charCount');
    const fileInput = getEl('#fileInput');

    // ---- สร้างองค์ประกอบ UI เพิ่มเติม (ถ้ายังไม่มี) ----
    // Toolbar
    const toolbarHTML = `
        <div id="toolbar" style="display:flex;flex-wrap:wrap;gap:8px;padding:8px;background:#f5f5f5;border-radius:8px;margin:8px 0;">
            <button id="undoBtn" title="ย้อนกลับ (Ctrl+Z)">↩️</button>
            <button id="redoBtn" title="ทำซ้ำ (Ctrl+Y)">↪️</button>
            <button id="rotateLeft">↺</button>
            <button id="rotateRight">↻</button>
            <button id="flipH">⇔</button>
            <button id="flipV">⇕</button>
            <button id="cropBtn">✂️</button>
            <button id="resetTransformBtn">⟲</button>
            <select id="formatSelect">
                <option value="png">PNG</option>
                <option value="jpeg">JPEG</option>
                <option value="webp">WebP</option>
            </select>
            <button id="downloadBtn">💾 Download</button>
        </div>
    `;
    ensureEl('#toolbar', toolbarHTML);

    // Slider Panel
    const sliderPanelHTML = `
        <div id="sliderPanel" style="display:flex;flex-wrap:wrap;gap:8px;padding:8px;background:#eee;border-radius:8px;margin:8px 0;">
            <label>Brightness <input type="range" id="sliderBrightness" min="0" max="200" step="1" value="100"></label>
            <label>Contrast <input type="range" id="sliderContrast" min="0" max="200" step="1" value="100"></label>
            <label>Saturate <input type="range" id="sliderSaturate" min="0" max="200" step="1" value="100"></label>
            <label>Hue <input type="range" id="sliderHue" min="0" max="360" step="1" value="0"></label>
            <label>Blur <input type="range" id="sliderBlur" min="0" max="100" step="1" value="0"></label>
            <label>Sepia <input type="range" id="sliderSepia" min="0" max="100" step="1" value="0"></label>
            <button id="resetSliders">รีเซ็ต Slider</button>
        </div>
    `;
    ensureEl('#sliderPanel', sliderPanelHTML);

    // Crop Overlay
    const cropOverlayHTML = `<div id="cropOverlay" style="display:none;position:absolute;border:2px dashed red;cursor:move;background:rgba(0,0,0,0.2);"></div>`;
    ensureEl('#cropOverlay', cropOverlayHTML);
    const cropOverlay = getEl('#cropOverlay');

    // Extra Tools (Accordion)
    const extraToolsHTML = `
        <details id="extraTools" open>
            <summary>🛠️ เครื่องมือเพิ่มเติม</summary>
            <div style="display:flex;flex-wrap:wrap;gap:12px;padding:8px;background:#f9f9f9;border-radius:8px;margin:6px 0;">
                <!-- Resize -->
                <div style="display:flex;align-items:center;gap:6px;">
                    <label>Width <input type="number" id="resizeW" value="800" style="width:70px;"></label>
                    <label>Height <input type="number" id="resizeH" value="600" style="width:70px;"></label>
                    <label><input type="checkbox" id="keepAspect" checked> รักษาสัดส่วน</label>
                    <button id="resizeBtn">ปรับขนาด</button>
                </div>
                <!-- Text -->
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                    <input type="text" id="textInput" placeholder="ข้อความ..." style="width:120px;">
                    <label>ขนาด <input type="number" id="textSize" value="40" style="width:50px;"></label>
                    <input type="color" id="textColor" value="#ffffff">
                    <label>X <input type="range" id="textX" min="0" max="100" value="50" style="width:60px;"></label>
                    <label>Y <input type="range" id="textY" min="0" max="100" value="50" style="width:60px;"></label>
                    <button id="addTextBtn">+ ข้อความ</button>
                    <button id="removeTextBtn">✖</button>
                </div>
                <!-- Sharpen -->
                <div style="display:flex;align-items:center;gap:6px;">
                    <label>Sharpen <input type="range" id="sharpenSlider" min="0" max="100" value="0" style="width:100px;"></label>
                    <span id="sharpenVal">0%</span>
                </div>
                <!-- Vignette -->
                <div style="display:flex;align-items:center;gap:6px;">
                    <label>Vignette <input type="range" id="vignetteSlider" min="0" max="100" value="0" style="width:100px;"></label>
                    <span id="vignetteVal">0%</span>
                </div>
                <!-- Grain -->
                <div style="display:flex;align-items:center;gap:6px;">
                    <label>Grain <input type="range" id="grainSlider" min="0" max="100" value="0" style="width:100px;"></label>
                    <span id="grainVal">0%</span>
                </div>
                <!-- Selection -->
                <div>
                    <button id="selectionBtn">🔲 เลือกพื้นที่</button>
                    <button id="applySelectionFilterBtn">✅ ใช้ Filter เฉพาะพื้นที่</button>
                </div>
                <!-- Preset -->
                <div style="display:flex;align-items:center;gap:6px;">
                    <input type="text" id="presetName" placeholder="ชื่อ preset" style="width:100px;">
                    <button id="savePresetBtn">💾 บันทึก Preset</button>
                    <select id="presetList"><option value="">-- โหลด Preset --</option></select>
                    <button id="deletePresetBtn">🗑️</button>
                </div>
                <!-- Multi Upload -->
                <div>
                    <input type="file" id="multiUpload" multiple accept="image/*">
                    <button id="nextImageBtn">▶ ถัดไป</button>
                    <button id="prevImageBtn">◀ ก่อนหน้า</button>
                    <span id="imageCounter">0/0</span>
                </div>
                <!-- Share -->
                <button id="shareBtn">📤 แชร์</button>
                <!-- Before/After, Opacity, Lens Flare -->
                <div style="display:flex;align-items:center;gap:6px;border-left:1px solid #ccc;padding-left:8px;">
                    <button id="beforeAfterBtn">🔄 Before</button>
                    <label>Opacity <input type="range" id="opacitySlider" min="0" max="100" value="100" style="width:80px;"></label>
                    <span id="opacityVal">100%</span>
                </div>
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;border-left:1px solid #ccc;padding-left:8px;">
                    <strong>Lens Flare</strong>
                    <label>Intensity <input type="range" id="flareIntensity" min="0" max="100" value="0" style="width:70px;"></label>
                    <label>X <input type="range" id="flareX" min="0" max="100" value="50" style="width:60px;"></label>
                    <label>Y <input type="range" id="flareY" min="0" max="100" value="50" style="width:60px;"></label>
                    <label>Size <input type="range" id="flareSize" min="0" max="100" value="30" style="width:60px;"></label>
                    <input type="color" id="flareColor" value="#ffffff">
                </div>
            </div>
            <!-- Custom Filter Builder -->
            <div style="border-top:1px solid #ddd;padding:8px 0;margin-top:4px;">
                <details>
                    <summary><strong>🔧 Custom Filter Builder (ปรับแต่งละเอียด)</strong></summary>
                    <div style="display:flex;flex-wrap:wrap;gap:8px;padding:6px 0;">
                        <label>Brightness <input type="range" id="builderBrightness" min="0" max="200" value="100" style="width:80px;"></label>
                        <label>Contrast <input type="range" id="builderContrast" min="0" max="200" value="100" style="width:80px;"></label>
                        <label>Saturate <input type="range" id="builderSaturate" min="0" max="200" value="100" style="width:80px;"></label>
                        <label>Hue <input type="range" id="builderHue" min="0" max="360" value="0" style="width:80px;"></label>
                        <label>Blur <input type="range" id="builderBlur" min="0" max="100" value="0" style="width:80px;"></label>
                        <label>Sepia <input type="range" id="builderSepia" min="0" max="100" value="0" style="width:80px;"></label>
                        <label>Sharpen <input type="range" id="builderSharpen" min="0" max="100" value="0" style="width:80px;"></label>
                        <label>Vignette <input type="range" id="builderVignette" min="0" max="100" value="0" style="width:80px;"></label>
                        <label>Grain <input type="range" id="builderGrain" min="0" max="100" value="0" style="width:80px;"></label>
                        <label>Opacity <input type="range" id="builderOpacity" min="0" max="100" value="100" style="width:80px;"></label>
                        <button id="builderApplyBtn" style="padding:4px 12px;">✅ ใช้ค่าทั้งหมด</button>
                        <button id="builderResetBtn" style="padding:4px 12px;">↺ รีเซ็ต</button>
                        <button id="builderRefreshBtn" style="padding:4px 12px;">🔄 รีเฟรชค่า</button>
                    </div>
                </details>
            </div>
        </details>
    `;
    ensureEl('#extraTools', extraToolsHTML);

    // ---- อ้างอิงองค์ประกอบที่สร้างใหม่ ----
    const undoBtn = getEl('#undoBtn');
    const redoBtn = getEl('#redoBtn');
    const rotateLeftBtn = getEl('#rotateLeft');
    const rotateRightBtn = getEl('#rotateRight');
    const flipHBtn = getEl('#flipH');
    const flipVBtn = getEl('#flipV');
    const cropBtn = getEl('#cropBtn');
    const resetTransformBtn = getEl('#resetTransformBtn');
    const formatSelect = getEl('#formatSelect');
    const downloadBtn = getEl('#downloadBtn');
    const sliderBrightness = getEl('#sliderBrightness');
    const sliderContrast = getEl('#sliderContrast');
    const sliderSaturate = getEl('#sliderSaturate');
    const sliderHue = getEl('#sliderHue');
    const sliderBlur = getEl('#sliderBlur');
    const sliderSepia = getEl('#sliderSepia');
    const resetSlidersBtn = getEl('#resetSliders');
    const resizeW = getEl('#resizeW');
    const resizeH = getEl('#resizeH');
    const keepAspect = getEl('#keepAspect');
    const resizeBtn = getEl('#resizeBtn');
    const textInput = getEl('#textInput');
    const textSize = getEl('#textSize');
    const textColor = getEl('#textColor');
    const textX = getEl('#textX');
    const textY = getEl('#textY');
    const addTextBtn = getEl('#addTextBtn');
    const removeTextBtn = getEl('#removeTextBtn');
    const sharpenSlider = getEl('#sharpenSlider');
    const sharpenVal = getEl('#sharpenVal');
    const vignetteSlider = getEl('#vignetteSlider');
    const vignetteVal = getEl('#vignetteVal');
    const grainSlider = getEl('#grainSlider');
    const grainVal = getEl('#grainVal');
    const selectionBtn = getEl('#selectionBtn');
    const applySelectionFilterBtn = getEl('#applySelectionFilterBtn');
    const presetName = getEl('#presetName');
    const savePresetBtn = getEl('#savePresetBtn');
    const presetList = getEl('#presetList');
    const deletePresetBtn = getEl('#deletePresetBtn');
    const multiUpload = getEl('#multiUpload');
    const nextImageBtn = getEl('#nextImageBtn');
    const prevImageBtn = getEl('#prevImageBtn');
    const imageCounter = getEl('#imageCounter');
    const shareBtn = getEl('#shareBtn');
    const beforeAfterBtn = getEl('#beforeAfterBtn');
    const opacitySlider = getEl('#opacitySlider');
    const opacityVal = getEl('#opacityVal');
    const flareIntensity = getEl('#flareIntensity');
    const flareX = getEl('#flareX');
    const flareY = getEl('#flareY');
    const flareSize = getEl('#flareSize');
    const flareColor = getEl('#flareColor');
    const builderBrightness = getEl('#builderBrightness');
    const builderContrast = getEl('#builderContrast');
    const builderSaturate = getEl('#builderSaturate');
    const builderHue = getEl('#builderHue');
    const builderBlur = getEl('#builderBlur');
    const builderSepia = getEl('#builderSepia');
    const builderSharpen = getEl('#builderSharpen');
    const builderVignette = getEl('#builderVignette');
    const builderGrain = getEl('#builderGrain');
    const builderOpacity = getEl('#builderOpacity');
    const builderApplyBtn = getEl('#builderApplyBtn');
    const builderResetBtn = getEl('#builderResetBtn');
    const builderRefreshBtn = getEl('#builderRefreshBtn');

    // ---- Constants ----
    const ASSETS = [
        { url: 'https://od.lk/s/N18yODk4MDQ5MDJf/ChatGPT%20Image%2027%20%E0%B8%A1%E0%B8%B4.%E0%B8%A2.%202569%2021_23_15.png', label: 'Landscape' },
        { url: 'https://images.pexels.com/photos/414612/pexels-photo-414612.jpeg', label: 'City' },
        { url: 'https://images.pexels.com/photos/34950/pexels-photo.jpg', label: 'Bridge' },
        { url: 'https://images.pexels.com/photos/417173/pexels-photo-417173.jpeg', label: 'Forest' },
        { url: 'https://images.pexels.com/photos/326055/pexels-photo-326055.jpeg', label: 'Beach' },
        { url: 'https://images.pexels.com/photos/248797/pexels-photo-248797.jpeg', label: 'Mountain' },
    ];

    const FILTER_STYLES = {
        'cinematic': 'contrast(1.15) saturate(1.3) brightness(1.05)',
        'vintage': 'sepia(0.55) contrast(1.1) saturate(0.9) brightness(0.95)',
        'cyberpunk': 'hue-rotate(280deg) saturate(1.6) contrast(1.2) brightness(0.9)',
        'bw': 'grayscale(1) contrast(1.3) brightness(0.95)',
        'pastel': 'brightness(1.1) saturate(0.7) contrast(0.9) blur(0.3px)',
        'dark': 'brightness(0.5) contrast(1.2) saturate(1.1)',
        'bright': 'brightness(1.4) contrast(0.9) saturate(1.1)',
        'warm': 'sepia(0.3) saturate(1.2) brightness(1.05) hue-rotate(-10deg)',
        'cool': 'hue-rotate(10deg) saturate(1.1) brightness(1.02)',
        'contrast': 'contrast(1.6) brightness(1.0) saturate(1.1)',
        'blur': 'blur(1.8px) brightness(1.02)',
        'dramatic': 'contrast(1.5) brightness(0.7) saturate(1.2)',
    };

    const FILTER_MAP = new Map([
        ['cinematic', { filter: 'cinematic', label: 'Cinematic', emoji: '🎬' }],
        ['movie', { filter: 'cinematic', label: 'Cinematic', emoji: '🎬' }],
        ['film', { filter: 'cinematic', label: 'Cinematic', emoji: '🎬' }],
        ['vintage', { filter: 'vintage', label: 'Vintage', emoji: '📻' }],
        ['retro', { filter: 'vintage', label: 'Vintage', emoji: '📻' }],
        ['old', { filter: 'vintage', label: 'Vintage', emoji: '📻' }],
        ['cyber', { filter: 'cyberpunk', label: 'Cyberpunk', emoji: '💜' }],
        ['neon', { filter: 'cyberpunk', label: 'Cyberpunk', emoji: '💜' }],
        ['punk', { filter: 'cyberpunk', label: 'Cyberpunk', emoji: '💜' }],
        ['black', { filter: 'bw', label: 'B&W', emoji: '🖤' }],
        ['b&w', { filter: 'bw', label: 'B&W', emoji: '🖤' }],
        ['grayscale', { filter: 'bw', label: 'B&W', emoji: '🖤' }],
        ['pastel', { filter: 'pastel', label: 'Pastel Dream', emoji: '🌸' }],
        ['dreamy', { filter: 'pastel', label: 'Pastel Dream', emoji: '🌸' }],
        ['dark', { filter: 'dark', label: 'Dark Mood', emoji: '🌙' }],
        ['night', { filter: 'dark', label: 'Dark Mood', emoji: '🌙' }],
        ['shadow', { filter: 'dark', label: 'Dark Mood', emoji: '🌙' }],
        ['bright', { filter: 'bright', label: 'Bright', emoji: '☀️' }],
        ['sunny', { filter: 'bright', label: 'Bright', emoji: '☀️' }],
        ['light', { filter: 'bright', label: 'Bright', emoji: '☀️' }],
        ['warm', { filter: 'warm', label: 'Warm Tone', emoji: '🔥' }],
        ['golden', { filter: 'warm', label: 'Warm Tone', emoji: '🔥' }],
        ['cool', { filter: 'cool', label: 'Cool Tone', emoji: '❄️' }],
        ['cold', { filter: 'cool', label: 'Cool Tone', emoji: '❄️' }],
        ['icy', { filter: 'cool', label: 'Cool Tone', emoji: '❄️' }],
        ['contrast', { filter: 'contrast', label: 'High Contrast', emoji: '⚡' }],
        ['sharp', { filter: 'contrast', label: 'High Contrast', emoji: '⚡' }],
        ['blur', { filter: 'blur', label: 'Soft Blur', emoji: '🌫️' }],
        ['soft focus', { filter: 'blur', label: 'Soft Blur', emoji: '🌫️' }],
        ['dramatic', { filter: 'dramatic', label: 'Dramatic', emoji: '🎭' }],
        ['intense', { filter: 'dramatic', label: 'Dramatic', emoji: '🎭' }],
    ]);
    const PROMPT_KEYS = Array.from(FILTER_MAP.keys()).sort((a, b) => b.length - a.length);

    // ---- State ----
    const state = {
        // ภาพต้นฉบับ (dataURL)
        originalImage: null,
        // Filter slider values (0-2, hue 0-360, blur 0-10, sepia 0-1)
        filters: { brightness: 1, contrast: 1, saturate: 1, hue: 0, blur: 0, sepia: 0 },
        // Transform
        rotation: 0,
        flipH: false,
        flipV: false,
        // Crop (x,y,w,h ในหน่วย 0-1)
        crop: null,
        // Selection (x,y,w,h 0-1)
        selection: null,
        // Selection filter values
        selectionFilter: { brightness: 1, contrast: 1, saturate: 1, hue: 0, blur: 0, sepia: 0 },
        // Text overlay
        textOverlay: null, // { text, x, y, size, color, font }
        // Extra effects
        sharpen: 0,      // 0-1
        vignette: 0,     // 0-1
        grain: 0,        // 0-1
        opacity: 1,      // 0-1
        beforeAfter: false,
        lensFlare: { intensity: 0, x: 0.5, y: 0.5, size: 0.3, color: '#ffffff' },
        // History (undo/redo)
        history: [],
        historyIndex: -1,
        // Uploaded images (multi)
        uploadedImages: [],
        currentImageIndex: 0,
        // Selection mode flag
        isSelecting: false,
        // Crop/Selection drag state
        dragStart: null,
        dragEnd: null,
        isDragging: false,
    };

    // ---- ฟังก์ชันช่วย ----
    function showToast(msg, emoji = '✨') {
        if (!toast || !toastMsg) { console.log(`[Toast] ${emoji} ${msg}`); return; }
        toastMsg.textContent = msg;
        const emojiEl = toast.querySelector('.emoji');
        if (emojiEl) emojiEl.textContent = emoji;
        toast.classList.add('visible');
        clearTimeout(window._toastTimer);
        window._toastTimer = setTimeout(() => toast.classList.remove('visible'), 2200);
    }

    function updateCharCount() {
        if (promptEl && charCount) {
            charCount.textContent = `${promptEl.value.length} / 200`;
        }
    }

    function buildFilterString(filters) {
        const { brightness, contrast, saturate, hue, blur, sepia } = filters;
        const parts = [];
        if (brightness !== 1) parts.push(`brightness(${brightness})`);
        if (contrast !== 1) parts.push(`contrast(${contrast})`);
        if (saturate !== 1) parts.push(`saturate(${saturate})`);
        if (hue !== 0) parts.push(`hue-rotate(${hue}deg)`);
        if (blur !== 0) parts.push(`blur(${blur}px)`);
        if (sepia !== 0) parts.push(`sepia(${sepia})`);
        return parts.length ? parts.join(' ') : 'none';
    }

    // ---- การวาด Lens Flare ----
    function drawLensFlare(ctx, w, h, flare) {
        if (!flare || flare.intensity <= 0) return;
        const cx = flare.x * w;
        const cy = flare.y * h;
        const radius = flare.size * Math.max(w, h) * 0.6;
        const intensity = flare.intensity;
        const color = flare.color;
        // Main glow
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        grad.addColorStop(0, color);
        grad.addColorStop(0.4, color + '80');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalAlpha = intensity * 0.7;
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
        // Rays
        ctx.globalAlpha = intensity * 0.4;
        ctx.fillStyle = color;
        for (let i = 0; i < 6; i++) {
            const angle = i * Math.PI / 3;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.ellipse(radius * 0.7, 0, radius * 0.5, radius * 0.04, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        // Center dot
        ctx.globalAlpha = intensity * 0.9;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.08, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    // ---- ฟังก์ชันหลัก renderImage (รวมทุกอย่าง) ----
    function renderImage() {
        if (!state.originalImage) {
            // ถ้ายังไม่มีต้นฉบับ ให้ลองใช้ img.src ปัจจุบัน (ถ้าเป็น dataURL)
            if (img && img.src && img.src.startsWith('data:image')) {
                state.originalImage = img.src;
            } else {
                return;
            }
        }

        const imgObj = new Image();
        imgObj.onload = function() {
            const w = imgObj.width;
            const h = imgObj.height;
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');

            // ตั้ง opacity ทั่วไป
            ctx.globalAlpha = state.opacity;

            if (state.beforeAfter) {
                // โหมด Before: แสดงต้นฉบับเท่านั้น
                ctx.drawImage(imgObj, 0, 0, w, h);
            } else {
                // ---- 1. วาดภาพต้นฉบับพร้อม Filter + Transform ----
                const filterStr = buildFilterString(state.filters);
                ctx.filter = filterStr;
                ctx.save();
                ctx.translate(w/2, h/2);
                ctx.rotate(state.rotation * Math.PI / 180);
                ctx.scale(state.flipH ? -1 : 1, state.flipV ? -1 : 1);
                ctx.drawImage(imgObj, -w/2, -h/2, w, h);
                ctx.restore();

                // ---- 2. Selection (ถ้ามี) ----
                if (state.selection) {
                    const sel = state.selection;
                    const sx = sel.x * w, sy = sel.y * h, sw = sel.w * w, sh = sel.h * h;
                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(sx, sy, sw, sh);
                    ctx.clip();
                    const selFilter = buildFilterString(state.selectionFilter);
                    ctx.filter = selFilter;
                    ctx.drawImage(imgObj, 0, 0, w, h);
                    ctx.restore();
                }

                // ---- 3. Sharpen (Convolution) ----
                if (state.sharpen > 0) {
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = w;
                    tempCanvas.height = h;
                    const tempCtx = tempCanvas.getContext('2d');
                    tempCtx.drawImage(canvas, 0, 0);
                    const imageData = tempCtx.getImageData(0, 0, w, h);
                    const data = imageData.data;
                    const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
                    const half = 1;
                    const output = new Uint8ClampedArray(data);
                    for (let y = half; y < h - half; y++) {
                        for (let x = half; x < w - half; x++) {
                            let r=0,g=0,b=0;
                            for (let ky=0; ky<3; ky++) {
                                for (let kx=0; kx<3; kx++) {
                                    const idx = ((y+ky-half)*w + (x+kx-half))*4;
                                    const k = kernel[ky*3+kx];
                                    r += data[idx]*k;
                                    g += data[idx+1]*k;
                                    b += data[idx+2]*k;
                                }
                            }
                            const idx = (y*w+x)*4;
                            output[idx] = Math.min(255, Math.max(0, r));
                            output[idx+1] = Math.min(255, Math.max(0, g));
                            output[idx+2] = Math.min(255, Math.max(0, b));
                        }
                    }
                    const newImageData = new ImageData(output, w, h);
                    tempCtx.putImageData(newImageData, 0, 0);
                    ctx.globalAlpha = state.sharpen;
                    ctx.drawImage(tempCanvas, 0, 0);
                    ctx.globalAlpha = state.opacity;
                }

                // ---- 4. Vignette ----
                if (state.vignette > 0) {
                    const gradient = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, Math.max(w, h)/2);
                    gradient.addColorStop(0, 'rgba(0,0,0,0)');
                    gradient.addColorStop(1, `rgba(0,0,0,${state.vignette})`);
                    ctx.fillStyle = gradient;
                    ctx.fillRect(0, 0, w, h);
                }

                // ---- 5. Grain ----
                if (state.grain > 0) {
                    const grainCanvas = document.createElement('canvas');
                    grainCanvas.width = w;
                    grainCanvas.height = h;
                    const gCtx = grainCanvas.getContext('2d');
                    const imageData = gCtx.createImageData(w, h);
                    const data = imageData.data;
                    for (let i=0; i<data.length; i+=4) {
                        const noise = (Math.random()-0.5)*255*state.grain;
                        data[i] = Math.min(255, Math.max(0, data[i]+noise));
                        data[i+1] = Math.min(255, Math.max(0, data[i+1]+noise));
                        data[i+2] = Math.min(255, Math.max(0, data[i+2]+noise));
                    }
                    gCtx.putImageData(imageData, 0, 0);
                    ctx.drawImage(grainCanvas, 0, 0);
                }

                // ---- 6. Text Overlay ----
                if (state.textOverlay) {
                    const txt = state.textOverlay;
                    ctx.font = `${txt.size}px ${txt.font || 'Arial'}`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = txt.color;
                    ctx.shadowColor = 'rgba(0,0,0,0.5)';
                    ctx.shadowBlur = 4;
                    ctx.fillText(txt.text, txt.x * w, txt.y * h);
                    ctx.shadowBlur = 0;
                }

                // ---- 7. Lens Flare ----
                if (state.lensFlare && state.lensFlare.intensity > 0) {
                    drawLensFlare(ctx, w, h, state.lensFlare);
                }
            }

            ctx.globalAlpha = 1;

            // นำภาพไปแสดง
            if (img) {
                img.src = canvas.toDataURL('image/png');
            }
        };
        imgObj.src = state.originalImage;
    }

    // ---- History Management ----
    function pushHistory() {
        // บันทึก state ทั้งหมด (ยกเว้น history, uploadedImages, currentImageIndex, isSelecting, drag state)
        const snapshot = {
            filters: { ...state.filters },
            rotation: state.rotation,
            flipH: state.flipH,
            flipV: state.flipV,
            crop: state.crop ? { ...state.crop } : null,
            selection: state.selection ? { ...state.selection } : null,
            selectionFilter: { ...state.selectionFilter },
            textOverlay: state.textOverlay ? { ...state.textOverlay } : null,
            sharpen: state.sharpen,
            vignette: state.vignette,
            grain: state.grain,
            opacity: state.opacity,
            beforeAfter: state.beforeAfter,
            lensFlare: { ...state.lensFlare },
            originalImage: state.originalImage, // อาจใช้หน่วยความจำเยอะ แต่จำเป็น
        };
        // ตัด history หลัง index ปัจจุบัน
        state.history = state.history.slice(0, state.historyIndex + 1);
        state.history.push(snapshot);
        if (state.history.length > 50) state.history.shift();
        state.historyIndex = state.history.length - 1;
        updateUndoRedoButtons();
    }

    function restoreHistory(index) {
        if (index < 0 || index >= state.history.length) return;
        const snap = state.history[index];
        state.historyIndex = index;
        // กู้คืนค่า
        Object.assign(state.filters, snap.filters);
        state.rotation = snap.rotation;
        state.flipH = snap.flipH;
        state.flipV = snap.flipV;
        state.crop = snap.crop ? { ...snap.crop } : null;
        state.selection = snap.selection ? { ...snap.selection } : null;
        Object.assign(state.selectionFilter, snap.selectionFilter);
        state.textOverlay = snap.textOverlay ? { ...snap.textOverlay } : null;
        state.sharpen = snap.sharpen;
        state.vignette = snap.vignette;
        state.grain = snap.grain;
        state.opacity = snap.opacity;
        state.beforeAfter = snap.beforeAfter;
        Object.assign(state.lensFlare, snap.lensFlare);
        state.originalImage = snap.originalImage;
        // อัปเดต UI
        syncUIFromState();
        renderImage();
        updateUndoRedoButtons();
        showToast(state.historyIndex === 0 ? 'ย้อนกลับต้น' : (state.historyIndex === state.history.length-1 ? 'ล่าสุด' : `ประวัติ ${state.historyIndex+1}/${state.history.length}`), '⏪');
    }

    function undo() {
        if (state.historyIndex > 0) restoreHistory(state.historyIndex - 1);
        else showToast('ไม่มีประวัติให้ย้อน', '⚠️');
    }

    function redo() {
        if (state.historyIndex < state.history.length - 1) restoreHistory(state.historyIndex + 1);
        else showToast('ไม่มีประวัติให้ทำซ้ำ', '⚠️');
    }

    function updateUndoRedoButtons() {
        if (undoBtn) undoBtn.disabled = (state.historyIndex <= 0);
        if (redoBtn) redoBtn.disabled = (state.historyIndex >= state.history.length - 1);
    }

    // ---- ซิงค์ UI จาก State ----
    function syncUIFromState() {
        // Slider หลัก
        if (sliderBrightness) sliderBrightness.value = state.filters.brightness * 100;
        if (sliderContrast) sliderContrast.value = state.filters.contrast * 100;
        if (sliderSaturate) sliderSaturate.value = state.filters.saturate * 100;
        if (sliderHue) sliderHue.value = state.filters.hue;
        if (sliderBlur) sliderBlur.value = state.filters.blur;
        if (sliderSepia) sliderSepia.value = state.filters.sepia * 100;
        // Extra
        if (sharpenSlider) sharpenSlider.value = state.sharpen * 100;
        if (sharpenVal) sharpenVal.textContent = Math.round(state.sharpen * 100) + '%';
        if (vignetteSlider) vignetteSlider.value = state.vignette * 100;
        if (vignetteVal) vignetteVal.textContent = Math.round(state.vignette * 100) + '%';
        if (grainSlider) grainSlider.value = state.grain * 100;
        if (grainVal) grainVal.textContent = Math.round(state.grain * 100) + '%';
        if (opacitySlider) opacitySlider.value = state.opacity * 100;
        if (opacityVal) opacityVal.textContent = Math.round(state.opacity * 100) + '%';
        // Before/After button
        if (beforeAfterBtn) beforeAfterBtn.textContent = state.beforeAfter ? '🔄 After' : '🔄 Before';
        // Lens Flare
        if (flareIntensity) flareIntensity.value = state.lensFlare.intensity * 100;
        if (flareX) flareX.value = state.lensFlare.x * 100;
        if (flareY) flareY.value = state.lensFlare.y * 100;
        if (flareSize) flareSize.value = state.lensFlare.size * 100;
        if (flareColor) flareColor.value = state.lensFlare.color;
        // Text UI
        if (state.textOverlay) {
            if (textInput) textInput.value = state.textOverlay.text;
            if (textSize) textSize.value = state.textOverlay.size;
            if (textColor) textColor.value = state.textOverlay.color;
            if (textX) textX.value = state.textOverlay.x * 100;
            if (textY) textY.value = state.textOverlay.y * 100;
        } else {
            if (textInput) textInput.value = '';
            if (textSize) textSize.value = 40;
            if (textColor) textColor.value = '#ffffff';
            if (textX) textX.value = 50;
            if (textY) textY.value = 50;
        }
        // Crop overlay
        if (state.crop && cropOverlay) {
            cropOverlay.style.display = 'block';
            updateCropOverlay();
        } else if (cropOverlay) {
            cropOverlay.style.display = 'none';
        }
        // Selection overlay (ถ้ามี)
        if (state.selection) {
            updateSelectionOverlay();
        }
        // Builder sync
        syncBuilderFromState();
    }

    // ---- Crop Overlay ----
    function updateCropOverlay() {
        if (!state.crop || !cropOverlay || !img) return;
        const rect = img.getBoundingClientRect();
        const parentRect = canvasWrap ? canvasWrap.getBoundingClientRect() : rect;
        const scaleX = rect.width / (img.naturalWidth || img.width || 800);
        const scaleY = rect.height / (img.naturalHeight || img.height || 600);
        const x = state.crop.x * (img.naturalWidth || img.width) * scaleX;
        const y = state.crop.y * (img.naturalHeight || img.height) * scaleY;
        const w = state.crop.w * (img.naturalWidth || img.width) * scaleX;
        const h = state.crop.h * (img.naturalHeight || img.height) * scaleY;
        cropOverlay.style.left = x + 'px';
        cropOverlay.style.top = y + 'px';
        cropOverlay.style.width = w + 'px';
        cropOverlay.style.height = h + 'px';
    }

    // ---- Selection Overlay (ใช้ cropOverlay ชั่วคราว) ----
    function updateSelectionOverlay() {
        // เราใช้ cropOverlay เดียวกัน แต่เปลี่ยนสีเป็นน้ำเงิน
        if (!state.selection || !cropOverlay || !img) return;
        cropOverlay.style.border = '2px dashed blue';
        cropOverlay.style.background = 'rgba(0,0,255,0.1)';
        const rect = img.getBoundingClientRect();
        const scaleX = rect.width / (img.naturalWidth || img.width || 800);
        const scaleY = rect.height / (img.naturalHeight || img.height || 600);
        const x = state.selection.x * (img.naturalWidth || img.width) * scaleX;
        const y = state.selection.y * (img.naturalHeight || img.height) * scaleY;
        const w = state.selection.w * (img.naturalWidth || img.width) * scaleX;
        const h = state.selection.h * (img.naturalHeight || img.height) * scaleY;
        cropOverlay.style.left = x + 'px';
        cropOverlay.style.top = y + 'px';
        cropOverlay.style.width = w + 'px';
        cropOverlay.style.height = h + 'px';
        cropOverlay.style.display = 'block';
    }

    // ---- Builder Sync ----
    function syncBuilderFromState() {
        const f = state.filters;
        if (builderBrightness) builderBrightness.value = f.brightness * 100;
        if (builderContrast) builderContrast.value = f.contrast * 100;
        if (builderSaturate) builderSaturate.value = f.saturate * 100;
        if (builderHue) builderHue.value = f.hue;
        if (builderBlur) builderBlur.value = f.blur;
        if (builderSepia) builderSepia.value = f.sepia * 100;
        if (builderSharpen) builderSharpen.value = state.sharpen * 100;
        if (builderVignette) builderVignette.value = state.vignette * 100;
        if (builderGrain) builderGrain.value = state.grain * 100;
        if (builderOpacity) builderOpacity.value = state.opacity * 100;
    }

    // ---- ฟังก์ชันสำหรับ AI ----
    function processPrompt(text) {
        const t = text.toLowerCase();
        for (const key of PROMPT_KEYS) {
            if (t.includes(key)) return FILTER_MAP.get(key);
        }
        return { filter: 'cinematic', label: 'Enhanced', emoji: '✨' };
    }

    // ---- ฟังก์ชัน Reset ----
    function resetAll() {
        // รีเซ็ต state ทั้งหมด (ยกเว้น originalImage, uploadedImages, currentImageIndex)
        state.filters = { brightness: 1, contrast: 1, saturate: 1, hue: 0, blur: 0, sepia: 0 };
        state.rotation = 0;
        state.flipH = false;
        state.flipV = false;
        state.crop = null;
        state.selection = null;
        state.selectionFilter = { brightness: 1, contrast: 1, saturate: 1, hue: 0, blur: 0, sepia: 0 };
        state.textOverlay = null;
        state.sharpen = 0;
        state.vignette = 0;
        state.grain = 0;
        state.opacity = 1;
        state.beforeAfter = false;
        state.lensFlare = { intensity: 0, x: 0.5, y: 0.5, size: 0.3, color: '#ffffff' };
        state.isSelecting = false;
        if (selectionBtn) selectionBtn.textContent = '🔲 เลือกพื้นที่';
        if (cropOverlay) cropOverlay.style.display = 'none';
        // ซิงค์ UI
        syncUIFromState();
        renderImage();
        // ล้าง history
        state.history = [];
        state.historyIndex = -1;
        updateUndoRedoButtons();
        showToast('รีเซ็ตทุกอย่างแล้ว', '↺');
    }

    // ---- ฟังก์ชันสำหรับ Grid ----
    function initGrid() {
        if (!grid) return;
        grid.innerHTML = '';
        ASSETS.forEach((asset, idx) => {
            const div = document.createElement('div');
            div.className = 'item';
            div.style.backgroundImage = `url(${asset.url})`;
            div.dataset.index = idx;
            const check = document.createElement('span');
            check.className = 'check';
            check.textContent = '✓';
            div.appendChild(check);
            div.addEventListener('click', () => {
                selectAsset(idx);
            });
            grid.appendChild(div);
        });
        const countEl = container.querySelector('#assetCount');
        if (countEl) countEl.textContent = ASSETS.length;
    }

    function selectAsset(index) {
        if (index < 0 || index >= ASSETS.length) return;
        const asset = ASSETS[index];
        state.originalImage = asset.url;
        if (img) img.src = asset.url;
        if (imgLabel) imgLabel.textContent = asset.label;
        const items = container.querySelectorAll('.item');
        if (items) items.forEach((el, i) => el.classList.toggle('active', i === index));
        if (fileInput) fileInput.value = '';
        resetAll();
        // แต่ resetAll ล้าง history และตั้ง originalImage เป็น asset url แล้ว
        // เราต้องตั้ง originalImage และ render
        state.originalImage = asset.url;
        renderImage();
        pushHistory();
        showToast(`เปลี่ยนเป็น ${asset.label}`, '🖼️');
    }

    // ---- อัปโหลด ----
    function handleUpload(file) {
        if (!file || !file.type.startsWith('image/')) {
            showToast('กรุณาเลือกไฟล์รูปภาพ', '❌');
            return;
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            const dataURL = e.target.result;
            state.originalImage = dataURL;
            if (img) img.src = dataURL;
            if (imgLabel) imgLabel.textContent = `📸 ${file.name}`;
            const items = container.querySelectorAll('.item');
            if (items) items.forEach(el => el.classList.remove('active'));
            resetAll();
            state.originalImage = dataURL;
            renderImage();
            pushHistory();
            showToast(`อัปโหลด "${file.name}" สำเร็จ`, '📤');
        };
        reader.readAsDataURL(file);
    }

    // ---- Multi Upload ----
    function handleMultiUpload(files) {
        const list = [];
        const promises = [];
        for (const file of files) {
            if (!file.type.startsWith('image/')) continue;
            const p = new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    list.push({ name: file.name, dataURL: e.target.result });
                    resolve();
                };
                reader.readAsDataURL(file);
            });
            promises.push(p);
        }
        Promise.all(promises).then(() => {
            state.uploadedImages = list;
            state.currentImageIndex = 0;
            if (list.length > 0) {
                state.originalImage = list[0].dataURL;
                renderImage();
                pushHistory();
                updateImageCounter();
                showToast(`โหลด ${list.length} รูป`, '📂');
            }
        });
    }

    function updateImageCounter() {
        const total = state.uploadedImages.length;
        const idx = state.currentImageIndex;
        if (imageCounter) imageCounter.textContent = total ? `${idx+1}/${total}` : '0/0';
    }

    function navigateImage(direction) {
        const total = state.uploadedImages.length;
        if (total === 0) return;
        let newIdx = state.currentImageIndex + direction;
        if (newIdx < 0) newIdx = total - 1;
        if (newIdx >= total) newIdx = 0;
        state.currentImageIndex = newIdx;
        state.originalImage = state.uploadedImages[newIdx].dataURL;
        renderImage();
        pushHistory();
        updateImageCounter();
    }

    // ---- Preset ----
    function savePreset() {
        const name = presetName.value.trim();
        if (!name) { showToast('กรุณาใส่ชื่อ Preset', '⚠️'); return; }
        const snap = {
            filters: { ...state.filters },
            rotation: state.rotation,
            flipH: state.flipH,
            flipV: state.flipV,
            textOverlay: state.textOverlay ? { ...state.textOverlay } : null,
            sharpen: state.sharpen,
            vignette: state.vignette,
            grain: state.grain,
            opacity: state.opacity,
            lensFlare: { ...state.lensFlare },
            selectionFilter: { ...state.selectionFilter },
        };
        let presets = JSON.parse(localStorage.getItem('imageEditorPresets') || '[]');
        const idx = presets.findIndex(p => p.name === name);
        if (idx >= 0) presets[idx].state = snap;
        else presets.push({ name, state: snap });
        localStorage.setItem('imageEditorPresets', JSON.stringify(presets));
        loadPresetList();
        showToast(`บันทึก Preset "${name}"`, '💾');
    }

    function loadPresetList() {
        const presets = JSON.parse(localStorage.getItem('imageEditorPresets') || '[]');
        if (presetList) {
            presetList.innerHTML = '<option value="">-- โหลด Preset --</option>';
            presets.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.name;
                opt.textContent = p.name;
                presetList.appendChild(opt);
            });
        }
    }

    function loadPreset(name) {
        const presets = JSON.parse(localStorage.getItem('imageEditorPresets') || '[]');
        const found = presets.find(p => p.name === name);
        if (!found) return;
        const snap = found.state;
        Object.assign(state.filters, snap.filters);
        state.rotation = snap.rotation || 0;
        state.flipH = snap.flipH || false;
        state.flipV = snap.flipV || false;
        state.textOverlay = snap.textOverlay ? { ...snap.textOverlay } : null;
        state.sharpen = snap.sharpen || 0;
        state.vignette = snap.vignette || 0;
        state.grain = snap.grain || 0;
        state.opacity = snap.opacity || 1;
        if (snap.lensFlare) Object.assign(state.lensFlare, snap.lensFlare);
        if (snap.selectionFilter) Object.assign(state.selectionFilter, snap.selectionFilter);
        syncUIFromState();
        renderImage();
        pushHistory();
        showToast(`โหลด Preset "${name}"`, '✅');
    }

    function deletePreset() {
        const name = presetList.value;
        if (!name) return;
        if (!confirm(`ลบ Preset "${name}"?`)) return;
        let presets = JSON.parse(localStorage.getItem('imageEditorPresets') || '[]');
        presets = presets.filter(p => p.name !== name);
        localStorage.setItem('imageEditorPresets', JSON.stringify(presets));
        loadPresetList();
        showToast(`ลบ Preset "${name}"`, '🗑️');
    }

    // ---- Resize ----
    function resizeImage() {
        let w = parseInt(resizeW.value) || 0;
        let h = parseInt(resizeH.value) || 0;
        if (w < 1 || h < 1) { showToast('กรุณากรอกขนาดที่ถูกต้อง', '⚠️'); return; }
        if (keepAspect.checked && state.originalImage) {
            const imgObj = new Image();
            imgObj.onload = function() {
                const ratio = imgObj.width / imgObj.height;
                if (w / h > ratio) w = Math.round(h * ratio);
                else h = Math.round(w / ratio);
                resizeW.value = w;
                resizeH.value = h;
                doResize(w, h);
            };
            imgObj.src = state.originalImage;
        } else {
            doResize(w, h);
        }
    }

    function doResize(w, h) {
        if (!state.originalImage) return;
        const imgObj = new Image();
        imgObj.onload = function() {
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(imgObj, 0, 0, w, h);
            state.originalImage = canvas.toDataURL('image/png');
            renderImage();
            pushHistory();
            showToast(`ปรับขนาดเป็น ${w}x${h}`, '📐');
        };
        imgObj.src = state.originalImage;
    }

    // ---- Text ----
    function addText() {
        const text = textInput.value.trim();
        if (!text) { showToast('กรุณาพิมพ์ข้อความ', '✏️'); return; }
        state.textOverlay = {
            text: text,
            x: parseFloat(textX.value) / 100,
            y: parseFloat(textY.value) / 100,
            size: parseInt(textSize.value) || 40,
            color: textColor.value,
            font: 'Arial',
        };
        renderImage();
        pushHistory();
        showToast('เพิ่มข้อความแล้ว', '📝');
    }

    function removeText() {
        state.textOverlay = null;
        renderImage();
        pushHistory();
        showToast('ลบข้อความแล้ว', '✖');
    }

    // ---- Selection Mode ----
    let selectionDrag = { startX:0, startY:0, endX:0, endY:0, active:false };

    function startSelectionMode() {
        state.isSelecting = !state.isSelecting;
        if (state.isSelecting) {
            selectionBtn.textContent = '✅ เลือกเสร็จ';
            showToast('คลิกและลากบนภาพเพื่อเลือกพื้นที่', '🔲');
            // เปิดใช้งาน event
            if (canvasWrap) {
                canvasWrap.addEventListener('mousedown', selectionMouseDown);
                canvasWrap.addEventListener('mousemove', selectionMouseMove);
                canvasWrap.addEventListener('mouseup', selectionMouseUp);
                canvasWrap.addEventListener('touchstart', selectionTouchStart);
                canvasWrap.addEventListener('touchmove', selectionTouchMove);
                canvasWrap.addEventListener('touchend', selectionTouchEnd);
            }
        } else {
            selectionBtn.textContent = '🔲 เลือกพื้นที่';
            if (canvasWrap) {
                canvasWrap.removeEventListener('mousedown', selectionMouseDown);
                canvasWrap.removeEventListener('mousemove', selectionMouseMove);
                canvasWrap.removeEventListener('mouseup', selectionMouseUp);
                canvasWrap.removeEventListener('touchstart', selectionTouchStart);
                canvasWrap.removeEventListener('touchmove', selectionTouchMove);
                canvasWrap.removeEventListener('touchend', selectionTouchEnd);
            }
            if (cropOverlay) cropOverlay.style.display = 'none';
            selectionDrag.active = false;
            // ไม่ลบ selection state
        }
    }

    function getCanvasCoords(e) {
        if (!canvasWrap) return { x:0, y:0 };
        const rect = canvasWrap.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
    }

    function selectionMouseDown(e) {
        if (!state.isSelecting) return;
        const pos = getCanvasCoords(e);
        selectionDrag.startX = pos.x;
        selectionDrag.startY = pos.y;
        selectionDrag.active = true;
        cropOverlay.style.border = '2px dashed blue';
        cropOverlay.style.background = 'rgba(0,0,255,0.1)';
        cropOverlay.style.display = 'block';
    }

    function selectionMouseMove(e) {
        if (!selectionDrag.active || !state.isSelecting) return;
        const pos = getCanvasCoords(e);
        selectionDrag.endX = pos.x;
        selectionDrag.endY = pos.y;
        updateSelectionOverlayDrag();
    }

    function selectionMouseUp(e) {
        if (!state.isSelecting) return;
        if (selectionDrag.active) {
            selectionDrag.active = false;
            const x = Math.min(selectionDrag.startX, selectionDrag.endX);
            const y = Math.min(selectionDrag.startY, selectionDrag.endY);
            const w = Math.abs(selectionDrag.endX - selectionDrag.startX);
            const h = Math.abs(selectionDrag.endY - selectionDrag.startY);
            if (w > 0.01 && h > 0.01) {
                state.selection = { x, y, w, h };
                showToast('เลือกพื้นที่แล้ว ใช้ปุ่ม "ใช้ Filter เฉพาะพื้นที่"', '✅');
            } else {
                state.selection = null;
                cropOverlay.style.display = 'none';
                showToast('เลือกพื้นที่ไม่ถูกต้อง', '⚠️');
            }
        }
    }

    function selectionTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const pos = getCanvasCoords({ clientX: touch.clientX, clientY: touch.clientY });
        selectionDrag.startX = pos.x;
        selectionDrag.startY = pos.y;
        selectionDrag.active = true;
        cropOverlay.style.border = '2px dashed blue';
        cropOverlay.style.background = 'rgba(0,0,255,0.1)';
        cropOverlay.style.display = 'block';
    }

    function selectionTouchMove(e) {
        e.preventDefault();
        if (!selectionDrag.active || !state.isSelecting) return;
        const touch = e.touches[0];
        const pos = getCanvasCoords({ clientX: touch.clientX, clientY: touch.clientY });
        selectionDrag.endX = pos.x;
        selectionDrag.endY = pos.y;
        updateSelectionOverlayDrag();
    }

    function selectionTouchEnd(e) {
        if (!state.isSelecting) return;
        if (selectionDrag.active) {
            selectionDrag.active = false;
            const x = Math.min(selectionDrag.startX, selectionDrag.endX);
            const y = Math.min(selectionDrag.startY, selectionDrag.endY);
            const w = Math.abs(selectionDrag.endX - selectionDrag.startX);
            const h = Math.abs(selectionDrag.endY - selectionDrag.startY);
            if (w > 0.01 && h > 0.01) {
                state.selection = { x, y, w, h };
                showToast('เลือกพื้นที่แล้ว ใช้ปุ่ม "ใช้ Filter เฉพาะพื้นที่"', '✅');
            } else {
                state.selection = null;
                cropOverlay.style.display = 'none';
                showToast('เลือกพื้นที่ไม่ถูกต้อง', '⚠️');
            }
        }
    }

    function updateSelectionOverlayDrag() {
        if (!cropOverlay || !canvasWrap) return;
        const rect = canvasWrap.getBoundingClientRect();
        const x = Math.min(selectionDrag.startX, selectionDrag.endX) * rect.width;
        const y = Math.min(selectionDrag.startY, selectionDrag.endY) * rect.height;
        const w = Math.abs(selectionDrag.endX - selectionDrag.startX) * rect.width;
        const h = Math.abs(selectionDrag.endY - selectionDrag.startY) * rect.height;
        cropOverlay.style.left = x + 'px';
        cropOverlay.style.top = y + 'px';
        cropOverlay.style.width = w + 'px';
        cropOverlay.style.height = h + 'px';
        cropOverlay.style.display = 'block';
    }

    // ---- Apply Selection Filter ----
    function applySelectionFilter() {
        if (!state.selection) {
            showToast('กรุณาเลือกพื้นที่ก่อน', '⚠️');
            return;
        }
        // ใช้ค่า filter ปัจจุบัน (จาก state.filters) ไปเป็น selectionFilter
        Object.assign(state.selectionFilter, state.filters);
        renderImage();
        pushHistory();
        showToast('ใช้ Filter เฉพาะพื้นที่แล้ว', '✅');
    }

    // ---- Crop (คล้าย selection แต่ใช้ crop state) ----
    // ฟังก์ชัน crop จะถูกเปิดจากปุ่ม cropBtn ซึ่งจะสลับโหมดคล้าย selection
    let cropDrag = { startX:0, startY:0, endX:0, endY:0, active:false };

    function toggleCropMode() {
        if (state.isSelecting) {
            // ถ้ากำลังเลือกพื้นที่อยู่ ให้ยกเลิกก่อน
            state.isSelecting = false;
            selectionBtn.textContent = '🔲 เลือกพื้นที่';
            if (canvasWrap) {
                canvasWrap.removeEventListener('mousedown', selectionMouseDown);
                canvasWrap.removeEventListener('mousemove', selectionMouseMove);
                canvasWrap.removeEventListener('mouseup', selectionMouseUp);
                canvasWrap.removeEventListener('touchstart', selectionTouchStart);
                canvasWrap.removeEventListener('touchmove', selectionTouchMove);
                canvasWrap.removeEventListener('touchend', selectionTouchEnd);
            }
        }
        // สลับโหมด crop
        const isCropActive = cropBtn.dataset.active === 'true';
        if (isCropActive) {
            // ปิดโหมด crop
            cropBtn.dataset.active = 'false';
            cropBtn.textContent = '✂️';
            if (canvasWrap) {
                canvasWrap.removeEventListener('mousedown', cropMouseDown);
                canvasWrap.removeEventListener('mousemove', cropMouseMove);
                canvasWrap.removeEventListener('mouseup', cropMouseUp);
                canvasWrap.removeEventListener('touchstart', cropTouchStart);
                canvasWrap.removeEventListener('touchmove', cropTouchMove);
                canvasWrap.removeEventListener('touchend', cropTouchEnd);
            }
            cropOverlay.style.border = '2px dashed red';
            cropOverlay.style.background = 'rgba(0,0,0,0.2)';
            // ถ้ามี crop ให้คงไว้
            if (state.crop) {
                showToast('ใช้ Crop แล้ว', '✅');
            } else {
                cropOverlay.style.display = 'none';
                showToast('ยกเลิกการครอบตัด', '❌');
            }
        } else {
            // เปิดโหมด crop
            cropBtn.dataset.active = 'true';
            cropBtn.textContent = '✅ Crop';
            showToast('คลิกและลากบนภาพเพื่อเลือกพื้นที่ครอบตัด', '✂️');
            if (canvasWrap) {
                canvasWrap.addEventListener('mousedown', cropMouseDown);
                canvasWrap.addEventListener('mousemove', cropMouseMove);
                canvasWrap.addEventListener('mouseup', cropMouseUp);
                canvasWrap.addEventListener('touchstart', cropTouchStart);
                canvasWrap.addEventListener('touchmove', cropTouchMove);
                canvasWrap.addEventListener('touchend', cropTouchEnd);
            }
            // ลบ crop เดิม
            state.crop = null;
            cropOverlay.style.display = 'none';
        }
    }

    function getCropCoords(e) {
        if (!canvasWrap) return { x:0, y:0 };
        const rect = canvasWrap.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
    }

    function cropMouseDown(e) {
        if (cropBtn.dataset.active !== 'true') return;
        const pos = getCropCoords(e);
        cropDrag.startX = pos.x;
        cropDrag.startY = pos.y;
        cropDrag.active = true;
        cropOverlay.style.border = '2px dashed red';
        cropOverlay.style.background = 'rgba(0,0,0,0.2)';
        cropOverlay.style.display = 'block';
    }

    function cropMouseMove(e) {
        if (!cropDrag.active || cropBtn.dataset.active !== 'true') return;
        const pos = getCropCoords(e);
        cropDrag.endX = pos.x;
        cropDrag.endY = pos.y;
        updateCropDrag();
    }

    function cropMouseUp(e) {
        if (cropBtn.dataset.active !== 'true') return;
        if (cropDrag.active) {
            cropDrag.active = false;
            const x = Math.min(cropDrag.startX, cropDrag.endX);
            const y = Math.min(cropDrag.startY, cropDrag.endY);
            const w = Math.abs(cropDrag.endX - cropDrag.startX);
            const h = Math.abs(cropDrag.endY - cropDrag.startY);
            if (w > 0.01 && h > 0.01) {
                state.crop = { x, y, w, h };
                // ทำการครอบตัดทันที (เพื่อให้ง่าย) หรือรอให้กด crop อีกครั้ง?
                // เราจะให้ครอบตัดทันที โดยใช้ canvas
                applyCrop();
                showToast('ครอบตัดแล้ว', '✂️');
                // ปิดโหมด crop
                cropBtn.dataset.active = 'false';
                cropBtn.textContent = '✂️';
                if (canvasWrap) {
                    canvasWrap.removeEventListener('mousedown', cropMouseDown);
                    canvasWrap.removeEventListener('mousemove', cropMouseMove);
                    canvasWrap.removeEventListener('mouseup', cropMouseUp);
                    canvasWrap.removeEventListener('touchstart', cropTouchStart);
                    canvasWrap.removeEventListener('touchmove', cropTouchMove);
                    canvasWrap.removeEventListener('touchend', cropTouchEnd);
                }
                cropOverlay.style.display = 'none';
            } else {
                state.crop = null;
                cropOverlay.style.display = 'none';
                showToast('เลือกพื้นที่ไม่ถูกต้อง', '⚠️');
            }
        }
    }

    function cropTouchStart(e) {
        e.preventDefault();
        if (cropBtn.dataset.active !== 'true') return;
        const touch = e.touches[0];
        const pos = getCropCoords({ clientX: touch.clientX, clientY: touch.clientY });
        cropDrag.startX = pos.x;
        cropDrag.startY = pos.y;
        cropDrag.active = true;
        cropOverlay.style.border = '2px dashed red';
        cropOverlay.style.background = 'rgba(0,0,0,0.2)';
        cropOverlay.style.display = 'block';
    }

    function cropTouchMove(e) {
        e.preventDefault();
        if (!cropDrag.active || cropBtn.dataset.active !== 'true') return;
        const touch = e.touches[0];
        const pos = getCropCoords({ clientX: touch.clientX, clientY: touch.clientY });
        cropDrag.endX = pos.x;
        cropDrag.endY = pos.y;
        updateCropDrag();
    }

    function cropTouchEnd(e) {
        if (cropBtn.dataset.active !== 'true') return;
        if (cropDrag.active) {
            cropDrag.active = false;
            const x = Math.min(cropDrag.startX, cropDrag.endX);
            const y = Math.min(cropDrag.startY, cropDrag.endY);
            const w = Math.abs(cropDrag.endX - cropDrag.startX);
            const h = Math.abs(cropDrag.endY - cropDrag.startY);
            if (w > 0.01 && h > 0.01) {
                state.crop = { x, y, w, h };
                applyCrop();
                showToast('ครอบตัดแล้ว', '✂️');
                cropBtn.dataset.active = 'false';
                cropBtn.textContent = '✂️';
                if (canvasWrap) {
                    canvasWrap.removeEventListener('mousedown', cropMouseDown);
                    canvasWrap.removeEventListener('mousemove', cropMouseMove);
                    canvasWrap.removeEventListener('mouseup', cropMouseUp);
                    canvasWrap.removeEventListener('touchstart', cropTouchStart);
                    canvasWrap.removeEventListener('touchmove', cropTouchMove);
                    canvasWrap.removeEventListener('touchend', cropTouchEnd);
                }
                cropOverlay.style.display = 'none';
            } else {
                state.crop = null;
                cropOverlay.style.display = 'none';
                showToast('เลือกพื้นที่ไม่ถูกต้อง', '⚠️');
            }
        }
    }

    function updateCropDrag() {
        if (!cropOverlay || !canvasWrap) return;
        const rect = canvasWrap.getBoundingClientRect();
        const x = Math.min(cropDrag.startX, cropDrag.endX) * rect.width;
        const y = Math.min(cropDrag.startY, cropDrag.endY) * rect.height;
        const w = Math.abs(cropDrag.endX - cropDrag.startX) * rect.width;
        const h = Math.abs(cropDrag.endY - cropDrag.startY) * rect.height;
        cropOverlay.style.left = x + 'px';
        cropOverlay.style.top = y + 'px';
        cropOverlay.style.width = w + 'px';
        cropOverlay.style.height = h + 'px';
        cropOverlay.style.display = 'block';
    }

    function applyCrop() {
        if (!state.crop || !state.originalImage) return;
        const imgObj = new Image();
        imgObj.onload = function() {
            const w = imgObj.width;
            const h = imgObj.height;
            const cx = state.crop.x * w;
            const cy = state.crop.y * h;
            const cw = state.crop.w * w;
            const ch = state.crop.h * h;
            const canvas = document.createElement('canvas');
            canvas.width = cw;
            canvas.height = ch;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(imgObj, cx, cy, cw, ch, 0, 0, cw, ch);
            state.originalImage = canvas.toDataURL('image/png');
            state.crop = null;
            renderImage();
            pushHistory();
        };
        imgObj.src = state.originalImage;
    }

    // ---- Share ----
    function shareImage() {
        if (!img) return;
        const canvas = document.createElement('canvas');
        const w = img.naturalWidth || img.width || 800;
        const h = img.naturalHeight || img.height || 600;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => {
            if (!blob) { showToast('ไม่สามารถสร้างไฟล์', '❌'); return; }
            const file = new File([blob], 'shared-image.png', { type: 'image/png' });
            if (navigator.share) {
                navigator.share({ title: 'ภาพที่แก้ไข', files: [file] })
                    .then(() => showToast('แชร์สำเร็จ', '📤'))
                    .catch((err) => { if (err.name !== 'AbortError') showToast('แชร์ล้มเหลว', '❌'); });
            } else {
                const link = document.createElement('a');
                link.download = 'shared-image.png';
                link.href = URL.createObjectURL(blob);
                link.click();
                URL.revokeObjectURL(link.href);
                showToast('ดาวน์โหลดแทน (ไม่รองรับแชร์)', '💾');
            }
        }, 'image/png');
    }

    // ---- Download ----
    function downloadImage() {
        if (!img) return;
        const w = img.naturalWidth || img.width || 800;
        const h = img.naturalHeight || img.height || 600;
        if (w === 0 || h === 0) { showToast('รูปภาพยังไม่โหลดเสร็จ', '⏳'); return; }
        const canvas = document.createElement('canvas');
        let drawX=0, drawY=0, drawW=w, drawH=h;
        if (state.crop) {
            drawX = state.crop.x * w;
            drawY = state.crop.y * h;
            drawW = state.crop.w * w;
            drawH = state.crop.h * h;
        }
        canvas.width = drawW;
        canvas.height = drawH;
        const ctx = canvas.getContext('2d');
        ctx.filter = buildFilterString(state.filters);
        ctx.save();
        ctx.translate(drawW/2, drawH/2);
        ctx.rotate(state.rotation * Math.PI / 180);
        ctx.scale(state.flipH ? -1 : 1, state.flipV ? -1 : 1);
        ctx.drawImage(img, drawX - drawW/2, drawY - drawH/2, drawW, drawH);
        ctx.restore();
        const format = formatSelect ? formatSelect.value : 'png';
        let mimeType = 'image/png', ext = 'png', quality = 1;
        if (format === 'jpeg') { mimeType = 'image/jpeg'; ext = 'jpg'; quality = 0.92; }
        else if (format === 'webp') { mimeType = 'image/webp'; ext = 'webp'; quality = 0.85; }
        const link = document.createElement('a');
        link.download = `edited-image-${Date.now()}.${ext}`;
        link.href = canvas.toDataURL(mimeType, quality);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast(`ดาวน์โหลด ${format.toUpperCase()} เรียบร้อย`, '💾');
    }

    // ---- ฟังก์ชันสาธารณะ ----
    global.initImageEditor = function() {
        if (!container) { console.error('❌ ไม่พบ #image-tab'); return; }
        initGrid();
        updateCharCount();
        selectAsset(0);
        syncUIFromState();
        renderImage();
        pushHistory();
        bindEvents();
        loadPresetList();
        showToast('✨ ยินดีต้อนรับสู่ Image Editor', '👋');
    };

    global.setTab = function(el, type) {
        if (!container) return;
        container.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        if (el) el.classList.add('active');
        const placeholders = {
            magic: 'พิมพ์สิ่งที่ต้องการ… เช่น "ทำให้เป็นแนวภาพยนตร์"',
            filter: 'ลอง: "vintage", "cyberpunk", "b&w", "pastel", "cinematic"',
            adjust: 'ลอง: "bright", "dark", "contrast", "warm", "cool"'
        };
        if (promptEl) promptEl.placeholder = placeholders[type] || placeholders.magic;
        showToast(`สลับเป็นโหมด ${type}`, '🔄');
    };

    global.resetImage = function() {
        // เลือก asset แรกหรือ asset ที่ active อยู่
        const activeItem = container.querySelector('.item.active');
        if (activeItem) {
            const idx = parseInt(activeItem.dataset.index, 10);
            if (!isNaN(idx) && idx >= 0 && idx < ASSETS.length) {
                selectAsset(idx);
                return;
            }
        }
        selectAsset(0);
        showToast('รีเซ็ตเรียบร้อย', '↺');
    };

    global.applyMagic = async function() {
        if (!promptEl || !applyBtn) return;
        const prompt = promptEl.value.trim();
        if (!prompt) { showToast('กรุณาพิมพ์คำสั่งก่อน', '✏️'); promptEl.focus(); return; }
        applyBtn.disabled = true;
        applyBtn.innerHTML = `<span class="spinner"></span> กำลังประมวลผล…`;
        await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 300));
        try {
            const result = processPrompt(prompt);
            // ใช้ filter จาก AI (ปรับค่า slider)
            const filterName = result.filter;
            const filterCSS = FILTER_STYLES[filterName] || 'none';
            // แปลง CSS filter เป็น slider values
            let b=1, c=1, s=1, h=0, bl=0, sep=0;
            const parts = filterCSS.split(' ');
            parts.forEach(p => {
                if (p.startsWith('brightness(')) b = parseFloat(p.match(/[\d.]+/)[0]) || 1;
                else if (p.startsWith('contrast(')) c = parseFloat(p.match(/[\d.]+/)[0]) || 1;
                else if (p.startsWith('saturate(')) s = parseFloat(p.match(/[\d.]+/)[0]) || 1;
                else if (p.startsWith('hue-rotate(')) h = parseFloat(p.match(/[\d.]+/)[0]) || 0;
                else if (p.startsWith('blur(')) bl = parseFloat(p.match(/[\d.]+/)[0]) || 0;
                else if (p.startsWith('sepia(')) sep = parseFloat(p.match(/[\d.]+/)[0]) || 0;
            });
            state.filters = { brightness: b, contrast: c, saturate: s, hue: h, blur: bl, sepia: sep };
            // รีเซ็ต extra effects (อาจจะไม่)
            state.sharpen = 0;
            state.vignette = 0;
            state.grain = 0;
            syncUIFromState();
            renderImage();
            pushHistory();
            showToast(result.label, result.emoji || '✨');
        } catch (err) {
            showToast('เกิดข้อผิดพลาด', '❌');
        } finally {
            applyBtn.disabled = false;
            applyBtn.innerHTML = `<span>✨</span> Apply`;
        }
    };

    global.downloadImage = downloadImage;

    // ---- Event Binding ----
    function bindEvents() {
        // Prompt input
        if (promptEl) promptEl.addEventListener('input', updateCharCount);
        // File input
        if (fileInput) {
            fileInput.addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (file) handleUpload(file);
            });
        }
        // Chips (ถ้ามี)
        container.querySelectorAll('.chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const val = chip.dataset.prompt;
                if (promptEl && val) {
                    promptEl.value = val;
                    promptEl.focus();
                    updateCharCount();
                    showToast(`Prompt: "${val}"`, '📝');
                }
            });
        });
        // Undo/Redo
        if (undoBtn) undoBtn.addEventListener('click', undo);
        if (redoBtn) redoBtn.addEventListener('click', redo);
        // Rotate/Flip
        if (rotateLeftBtn) rotateLeftBtn.addEventListener('click', () => {
            state.rotation = (state.rotation - 90) % 360;
            renderImage();
            pushHistory();
        });
        if (rotateRightBtn) rotateRightBtn.addEventListener('click', () => {
            state.rotation = (state.rotation + 90) % 360;
            renderImage();
            pushHistory();
        });
        if (flipHBtn) flipHBtn.addEventListener('click', () => {
            state.flipH = !state.flipH;
            renderImage();
            pushHistory();
        });
        if (flipVBtn) flipVBtn.addEventListener('click', () => {
            state.flipV = !state.flipV;
            renderImage();
            pushHistory();
        });
        if (resetTransformBtn) resetTransformBtn.addEventListener('click', () => {
            state.rotation = 0;
            state.flipH = false;
            state.flipV = false;
            renderImage();
            pushHistory();
            showToast('รีเซ็ตการหมุน/พลิก', '⟲');
        });
        // Crop
        if (cropBtn) cropBtn.addEventListener('click', toggleCropMode);
        // Download
        if (downloadBtn) downloadBtn.addEventListener('click', downloadImage);
        // Sliders
        const sliderMap = {
            sliderBrightness: 'brightness',
            sliderContrast: 'contrast',
            sliderSaturate: 'saturate',
            sliderHue: 'hue',
            sliderBlur: 'blur',
            sliderSepia: 'sepia'
        };
        Object.entries(sliderMap).forEach(([id, key]) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', function() {
                    let val = parseFloat(this.value);
                    if (key === 'hue') state.filters[key] = val;
                    else if (key === 'blur') state.filters[key] = val;
                    else state.filters[key] = val / 100;
                    renderImage();
                });
                el.addEventListener('change', pushHistory);
            }
        });
        if (resetSlidersBtn) {
            resetSlidersBtn.addEventListener('click', () => {
                state.filters = { brightness:1, contrast:1, saturate:1, hue:0, blur:0, sepia:0 };
                syncUIFromState();
                renderImage();
                pushHistory();
                showToast('รีเซ็ต Slider', '🔄');
            });
        }
        // Resize
        if (resizeBtn) resizeBtn.addEventListener('click', resizeImage);
        // Text
        if (addTextBtn) addTextBtn.addEventListener('click', addText);
        if (removeTextBtn) removeTextBtn.addEventListener('click', removeText);
        // Sharpen
        if (sharpenSlider) {
            sharpenSlider.addEventListener('input', function() {
                state.sharpen = parseFloat(this.value) / 100;
                sharpenVal.textContent = Math.round(state.sharpen * 100) + '%';
                renderImage();
            });
            sharpenSlider.addEventListener('change', pushHistory);
        }
        // Vignette
        if (vignetteSlider) {
            vignetteSlider.addEventListener('input', function() {
                state.vignette = parseFloat(this.value) / 100;
                vignetteVal.textContent = Math.round(state.vignette * 100) + '%';
                renderImage();
            });
            vignetteSlider.addEventListener('change', pushHistory);
        }
        // Grain
        if (grainSlider) {
            grainSlider.addEventListener('input', function() {
                state.grain = parseFloat(this.value) / 100;
                grainVal.textContent = Math.round(state.grain * 100) + '%';
                renderImage();
            });
            grainSlider.addEventListener('change', pushHistory);
        }
        // Selection
        if (selectionBtn) selectionBtn.addEventListener('click', startSelectionMode);
        if (applySelectionFilterBtn) applySelectionFilterBtn.addEventListener('click', applySelectionFilter);
        // Preset
        if (savePresetBtn) savePresetBtn.addEventListener('click', savePreset);
        if (presetList) presetList.addEventListener('change', function() { if (this.value) loadPreset(this.value); });
        if (deletePresetBtn) deletePresetBtn.addEventListener('click', deletePreset);
        // Multi Upload
        if (multiUpload) {
            multiUpload.addEventListener('change', function() {
                if (this.files.length > 0) {
                    handleMultiUpload(this.files);
                    this.value = '';
                }
            });
        }
        if (nextImageBtn) nextImageBtn.addEventListener('click', () => navigateImage(1));
        if (prevImageBtn) prevImageBtn.addEventListener('click', () => navigateImage(-1));
        // Share
        if (shareBtn) shareBtn.addEventListener('click', shareImage);
        // Before/After
        if (beforeAfterBtn) {
            beforeAfterBtn.addEventListener('click', function() {
                state.beforeAfter = !state.beforeAfter;
                this.textContent = state.beforeAfter ? '🔄 After' : '🔄 Before';
                renderImage();
                pushHistory();
                showToast(state.beforeAfter ? 'แสดงภาพต้นฉบับ' : 'แสดงภาพที่แก้ไข', '👁️');
            });
        }
        // Opacity
        if (opacitySlider) {
            opacitySlider.addEventListener('input', function() {
                state.opacity = parseFloat(this.value) / 100;
                opacityVal.textContent = Math.round(state.opacity * 100) + '%';
                renderImage();
            });
            opacitySlider.addEventListener('change', pushHistory);
        }
        // Lens Flare
        const flareMap = {
            flareIntensity: 'intensity',
            flareX: 'x',
            flareY: 'y',
            flareSize: 'size'
        };
        Object.entries(flareMap).forEach(([id, key]) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', function() {
                    state.lensFlare[key] = parseFloat(this.value) / 100;
                    renderImage();
                });
                el.addEventListener('change', pushHistory);
            }
        });
        if (flareColor) {
            flareColor.addEventListener('input', function() {
                state.lensFlare.color = this.value;
                renderImage();
            });
            flareColor.addEventListener('change', pushHistory);
        }
        // Custom Filter Builder
        const builderMap = {
            builderBrightness: 'brightness',
            builderContrast: 'contrast',
            builderSaturate: 'saturate',
            builderHue: 'hue',
            builderBlur: 'blur',
            builderSepia: 'sepia'
        };
        Object.entries(builderMap).forEach(([id, key]) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', function() {
                    let val = parseFloat(this.value);
                    if (key === 'hue') state.filters[key] = val;
                    else if (key === 'blur') state.filters[key] = val;
                    else state.filters[key] = val / 100;
                    syncUIFromState();
                    renderImage();
                });
                el.addEventListener('change', pushHistory);
            }
        });
        const builderExtraMap = {
            builderSharpen: 'sharpen',
            builderVignette: 'vignette',
            builderGrain: 'grain',
            builderOpacity: 'opacity'
        };
        Object.entries(builderExtraMap).forEach(([id, key]) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', function() {
                    state[key] = parseFloat(this.value) / 100;
                    syncUIFromState();
                    renderImage();
                });
                el.addEventListener('change', pushHistory);
            }
        });
        if (builderApplyBtn) {
            builderApplyBtn.addEventListener('click', function() {
                // ค่าถูก sync อยู่แล้วจาก input events
                pushHistory();
                showToast('นำค่าทั้งหมดไปใช้', '✅');
            });
        }
        if (builderResetBtn) {
            builderResetBtn.addEventListener('click', function() {
                state.filters = { brightness:1, contrast:1, saturate:1, hue:0, blur:0, sepia:0 };
                state.sharpen = 0;
                state.vignette = 0;
                state.grain = 0;
                state.opacity = 1;
                syncUIFromState();
                renderImage();
                pushHistory();
                showToast('รีเซ็ตค่าทั้งหมด', '↺');
            });
        }
        if (builderRefreshBtn) {
            builderRefreshBtn.addEventListener('click', function() {
                syncUIFromState();
                showToast('รีเฟรชค่าแล้ว', '🔄');
            });
        }
        // Drag & Drop (บน canvasWrap)
        if (canvasWrap) {
            canvasWrap.addEventListener('dragover', function(e) {
                e.preventDefault();
                canvasWrap.style.border = '3px dashed #4CAF50';
            });
            canvasWrap.addEventListener('dragleave', function(e) {
                e.preventDefault();
                canvasWrap.style.border = 'none';
            });
            canvasWrap.addEventListener('drop', function(e) {
                e.preventDefault();
                canvasWrap.style.border = 'none';
                const files = e.dataTransfer.files;
                if (files.length > 0) handleUpload(files[0]);
            });
        }
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            const active = document.activeElement;
            const isInside = container.contains(active);
            if (!isInside) return;
            const tag = active.tagName.toLowerCase();
            if (['input','textarea','select'].includes(tag)) {
                if (!((e.ctrlKey || e.metaKey) && ['z','y','Enter'].includes(e.key))) return;
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); global.applyMagic(); return; }
            if (e.key === 'Escape') {
                if (active === promptEl) { promptEl.value = ''; updateCharCount(); showToast('ล้างข้อความแล้ว', '🧹'); return; }
                if (state.isSelecting) { state.isSelecting = false; selectionBtn.textContent = '🔲 เลือกพื้นที่'; cropOverlay.style.display = 'none'; showToast('ยกเลิกการเลือก', '❌'); return; }
                if (cropBtn.dataset.active === 'true') { toggleCropMode(); return; }
            }
            if (e.key === 'r' && !e.ctrlKey && !e.metaKey && !['input','textarea','select'].includes(tag)) {
                e.preventDefault(); global.resetImage();
            }
        });
    }

    // ---- เรียก init เมื่อ DOM พร้อม ----
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', global.initImageEditor);
    } else {
        global.initImageEditor();
    }

    console.log('🖼️ Image Editor เวอร์ชันสมบูรณ์ พร้อมใช้งานแล้ว');
})(window);
