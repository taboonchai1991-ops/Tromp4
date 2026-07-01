// ================================================================
//  image-editor.js – AI Image Studio (ปรับปรุง: เร็วขึ้น + รองรับมือถือ)
//  ต้องเรียก initImageEditor() เมื่อโหลดแท็บ
// ================================================================

(function(global) {
    'use strict';

    // ---- DOM elements (ค้นหาภายใน image-tab) ----
    const container = document.getElementById('image-tab');
    const grid = container.querySelector('#grid');
    const img = container.querySelector('#canvasImg');
    const canvasWrap = container.querySelector('#canvasWrap');
    const promptEl = container.querySelector('#promptImage');
    const applyBtn = container.querySelector('#applyBtn');
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMsg');
    const imgLabel = container.querySelector('#imgLabel');
    const filterLabel = container.querySelector('#filterLabel');
    const charCount = container.querySelector('#charCount');
    const fileInput = container.querySelector('#fileInput');

    // ---- State ----
    const ASSETS = [
        { url: 'https://od.lk/s/N18yODk4MDQ5MDJf/ChatGPT%20Image%2027%20%E0%B8%A1%E0%B8%B4.%E0%B8%A2.%202569%2021_23_15.png', label: 'Landscape' },
        { url: 'https://images.pexels.com/photos/414612/pexels-photo-414612.jpeg', label: 'City' },
        { url: 'https://images.pexels.com/photos/34950/pexels-photo.jpg', label: 'Bridge' },
        { url: 'https://images.pexels.com/photos/417173/pexels-photo-417173.jpeg', label: 'Forest' },
        { url: 'https://images.pexels.com/photos/326055/pexels-photo-326055.jpeg', label: 'Beach' },
        { url: 'https://images.pexels.com/photos/248797/pexels-photo-248797.jpeg', label: 'Mountain' },
    ];

    let currentFilter = 'none';
    let currentTab = 'magic';
    let isProcessing = false;
    let filterHistory = [];
    let historyIndex = -1;
    let lastFilterValue = 'none';
    let toastTimer = null;

    // ---- ฟังก์ชันสาธารณะ (expose) ----
    global.initImageEditor = function() {
        initGrid();
        updateCharCount();
        imgLabel.textContent = ASSETS[0].label;
        updateFilterLabel();
        bindEvents();
        showToast('✨ ยินดีต้อนรับสู่ Image Editor', '👋');
    };

    global.setTab = function(el, type) {
        container.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        el.classList.add('active');
        currentTab = type;
        const placeholders = {
            magic: 'พิมพ์สิ่งที่ต้องการ… เช่น "ทำให้เป็นแนวภาพยนตร์"',
            filter: 'ลอง: "vintage", "cyberpunk", "b&w", "pastel", "cinematic"',
            adjust: 'ลอง: "bright", "dark", "contrast", "warm", "cool"'
        };
        promptEl.placeholder = placeholders[type] || placeholders.magic;
        showToast(`สลับเป็นโหมด ${type}`, '🔄');
    };

    global.resetImage = function() {
        resetFilters();
        const active = container.querySelector('.item.active');
        if (active) {
            const idx = parseInt(active.dataset.index);
            const asset = ASSETS[idx];
            img.src = asset.url;
            imgLabel.textContent = asset.label;
        } else {
            img.src = ASSETS[0].url;
            imgLabel.textContent = ASSETS[0].label;
            const firstItem = container.querySelector('.item');
            if (firstItem) firstItem.classList.add('active');
        }
        // รีเซ็ต lastFilterValue เพื่อให้ดาวน์โหลดรูปต้นฉบับ
        lastFilterValue = 'none';
        showToast('รีเซ็ตเรียบร้อย', '↺');
    };

    global.applyMagic = function() {
        if (isProcessing) return;
        const prompt = promptEl.value.trim();
        if (!prompt) {
            showToast('กรุณาพิมพ์คำสั่งก่อน', '✏️');
            promptEl.focus();
            return;
        }
        isProcessing = true;
        applyBtn.disabled = true;
        applyBtn.innerHTML = `<span class="spinner"></span> กำลังประมวลผล…`;

        // ** ปรับความเร็ว: ลดจาก 800-1400ms เหลือ 300-600ms **
        setTimeout(() => {
            const result = processPrompt(prompt);
            applyFilter(result.filter, result.label);
            showToast(result.label, result.emoji || '✨');
            isProcessing = false;
            applyBtn.disabled = false;
            applyBtn.innerHTML = `<span>✨</span> Apply`;
        }, 300 + Math.random() * 300);
    };

    global.downloadImage = function() {
        const w = img.naturalWidth || img.width || 800;
        const h = img.naturalHeight || img.height || 600;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.filter = lastFilterValue || 'none';
        ctx.drawImage(img, 0, 0, w, h);
        const link = document.createElement('a');
        link.download = `edited-image-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('ดาวน์โหลดรูปภาพแล้ว', '💾');
    };

    // ---- ฟังก์ชันภายใน ----
    function initGrid() {
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
            if (idx === 0) div.classList.add('active');
            div.onclick = () => {
                container.querySelectorAll('.item').forEach(el => el.classList.remove('active'));
                div.classList.add('active');
                img.src = asset.url;
                imgLabel.textContent = asset.label;
                resetFilters();
                updateFilterLabel();
            };
            grid.appendChild(div);
        });
        const countEl = container.querySelector('#assetCount');
        if (countEl) countEl.textContent = ASSETS.length;
    }

    function showToast(msg, emoji = '✨') {
        if (!toast || !toastMsg) return;
        toastMsg.textContent = msg;
        toast.querySelector('.emoji').textContent = emoji;
        toast.classList.add('visible');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toast.classList.remove('visible');
        }, 2200);
    }

    function updateCharCount() {
        if (!promptEl || !charCount) return;
        const len = promptEl.value.length;
        charCount.textContent = `${len} / 200`;
    }

    function resetFilters() {
        img.style.filter = 'none';
        currentFilter = 'none';
        lastFilterValue = 'none';
        filterHistory = [];
        historyIndex = -1;
        canvasWrap.classList.remove('glow');
        updateFilterLabel();
    }

    function updateFilterLabel() {
        const labels = {
            'none': '🎨 Original',
            'cinematic': '🎬 Cinematic',
            'vintage': '📻 Vintage',
            'cyberpunk': '💜 Cyberpunk',
            'bw': '🖤 B&W',
            'pastel': '🌸 Pastel',
            'dark': '🌙 Dark',
            'bright': '☀️ Bright',
            'warm': '🔥 Warm',
            'cool': '❄️ Cool',
            'contrast': '⚡ High Contrast',
            'blur': '🌫️ Soft Blur',
            'dramatic': '🎭 Dramatic',
        };
        filterLabel.textContent = labels[currentFilter] || '🎨 Custom';
    }

    // ---- processPrompt (ปรับปรุงให้เร็วขึ้นด้วย Map + some) ----
    function processPrompt(text) {
        const t = text.toLowerCase();
        // ใช้ Map เพื่อค้นหาคำสั่งที่มีความสำคัญสูงสุด
        const filterMap = new Map([
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

        // หาคำที่ตรงกับข้อความ (เรียงตามความยาวจากมากไปน้อย)
        const keys = Array.from(filterMap.keys()).sort((a, b) => b.length - a.length);
        for (const key of keys) {
            if (t.includes(key)) {
                return filterMap.get(key);
            }
        }

        // ถ้าไม่เจอ ให้ใช้ cinematic เป็น default
        return { filter: 'cinematic', label: 'Enhanced', emoji: '✨' };
    }

    function applyFilter(filterName, label) {
        const filters = {
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
        const filterValue = filters[filterName] || 'none';
        img.style.filter = filterValue;
        currentFilter = filterName;
        lastFilterValue = filterValue;
        canvasWrap.classList.add('glow');
        updateFilterLabel();
        filterHistory.push({ filter: filterName, value: filterValue });
        historyIndex = filterHistory.length - 1;
    }

    function handleUpload(file) {
        if (!file || !file.type.startsWith('image/')) {
            showToast('กรุณาเลือกไฟล์รูปภาพ', '❌');
            return;
        }
        const url = URL.createObjectURL(file);
        img.src = url;
        img.onload = function() { URL.revokeObjectURL(url); };
        container.querySelectorAll('.item').forEach(el => el.classList.remove('active'));
        imgLabel.textContent = '📸 อัปโหลดแล้ว';
        resetFilters();
        showToast(`อัปโหลด "${file.name}" สำเร็จ`, '📤');
        fileInput.value = '';
    }

    function bindEvents() {
        promptEl.addEventListener('input', updateCharCount);
        fileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) handleUpload(file);
        });
        // Chips
        container.querySelectorAll('.chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const val = chip.dataset.prompt;
                promptEl.value = val;
                promptEl.focus();
                updateCharCount();
                showToast(`Prompt: "${val}"`, '📝');
            });
        });
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.target.closest('#image-tab') === null) return; // เฉพาะใน image tab
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                global.applyMagic();
            }
            if (e.key === 'Escape' && document.activeElement === promptEl) {
                promptEl.value = '';
                updateCharCount();
                showToast('ล้างข้อความแล้ว', '🧹');
            }
            if (e.key === 'r' && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== 'TEXTAREA') {
                global.resetImage();
            }
        });
    }

    // ---- เริ่มต้นเมื่อเรียก ----
    console.log('🖼️ Image Editor พร้อมใช้งาน (ปรับปรุงเร็ว + มือถือ)');

})(window);