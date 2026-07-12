// ================================================================
//  image-editor.js – AI Image Studio (ปรับปรุง: เร็วขึ้น + รองรับมือถือ + แก้บัค)
//  ต้องเรียก initImageEditor() เมื่อโหลดแท็บ (ควรเรียกใน DOMContentLoaded)
// ================================================================

(function(global) {
    'use strict';

    // ---- DOM elements (ค้นหาภายใน image-tab) ----
    const container = document.getElementById('image-tab');
    if (!container) {
        console.error('❌ ไม่พบ element #image-tab');
        return;
    }

    // ฟังก์ชันช่วยในการค้นหา element และตรวจสอบ
    function getElement(selector, context = container) {
        const el = context.querySelector(selector);
        if (!el) console.warn(`⚠️ ไม่พบ element: ${selector}`);
        return el;
    }

    const grid = getElement('#grid');
    const img = getElement('#canvasImg');
    const canvasWrap = getElement('#canvasWrap');
    const promptEl = getElement('#promptImage');
    const applyBtn = getElement('#applyBtn');
    const toast = getElement('#toast');
    const toastMsg = getElement('#toastMsg');
    const imgLabel = getElement('#imgLabel');
    const filterLabel = getElement('#filterLabel');
    const charCount = getElement('#charCount');
    const fileInput = getElement('#fileInput');

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

    // Filter name -> label and emoji (for prompt processing)
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

    // Pre-sort keys by length descending for faster matching
    const PROMPT_KEYS = Array.from(FILTER_MAP.keys()).sort((a, b) => b.length - a.length);

    // ---- State ----
    let currentFilter = 'none';
    let currentTab = 'magic';
    let isProcessing = false;
    const MAX_HISTORY = 50;
    let filterHistory = [];
    let historyIndex = -1;
    let lastFilterValue = 'none';
    let toastTimer = null;
    let currentAssetIndex = 0; // 0-based index of active asset, -1 if uploaded

    // ---- ฟังก์ชันสาธารณะ (expose) ----
    global.initImageEditor = function() {
        if (!grid || !img || !promptEl) {
            console.error('❌ องค์ประกอบหลักหายไป ไม่สามารถเริ่มต้นได้');
            return;
        }
        initGrid();
        updateCharCount();
        // ตั้งค่าเริ่มต้น
        selectAsset(0);
        updateFilterLabel();
        bindEvents();
        showToast('✨ ยินดีต้อนรับสู่ Image Editor', '👋');
    };

    global.setTab = function(el, type) {
        if (!container) return;
        container.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        if (el) el.classList.add('active');
        currentTab = type;
        const placeholders = {
            magic: 'พิมพ์สิ่งที่ต้องการ… เช่น "ทำให้เป็นแนวภาพยนตร์"',
            filter: 'ลอง: "vintage", "cyberpunk", "b&w", "pastel", "cinematic"',
            adjust: 'ลอง: "bright", "dark", "contrast", "warm", "cool"'
        };
        if (promptEl) {
            promptEl.placeholder = placeholders[type] || placeholders.magic;
            //  optionally clear prompt when switching? เราไม่ล้างเพื่อให้ user เปลี่ยนใจ
        }
        showToast(`สลับเป็นโหมด ${type}`, '🔄');
    };

    global.resetImage = function() {
        if (!img || !imgLabel) return;
        resetFilters();
        // เลือก asset แรกหรือ asset ที่ active อยู่
        const activeItem = container?.querySelector('.item.active');
        if (activeItem) {
            const idx = parseInt(activeItem.dataset.index, 10);
            if (!isNaN(idx) && idx >= 0 && idx < ASSETS.length) {
                selectAsset(idx);
                return;
            }
        }
        // fallback: เลือกอันแรก
        selectAsset(0);
        showToast('รีเซ็ตเรียบร้อย', '↺');
    };

    global.applyMagic = async function() {
        if (isProcessing) return;
        if (!promptEl || !applyBtn) return;
        const prompt = promptEl.value.trim();
        if (!prompt) {
            showToast('กรุณาพิมพ์คำสั่งก่อน', '✏️');
            promptEl.focus();
            return;
        }
        isProcessing = true;
        applyBtn.disabled = true;
        applyBtn.innerHTML = `<span class="spinner"></span> กำลังประมวลผล…`;

        // จำลองการประมวลผล (300-600ms)
        await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 300));

        try {
            const result = processPrompt(prompt);
            applyFilter(result.filter, result.label);
            showToast(result.label, result.emoji || '✨');
        } catch (err) {
            console.error('applyMagic error:', err);
            showToast('เกิดข้อผิดพลาด ลองใหม่', '❌');
        } finally {
            isProcessing = false;
            if (applyBtn) {
                applyBtn.disabled = false;
                applyBtn.innerHTML = `<span>✨</span> Apply`;
            }
        }
    };

    global.downloadImage = function() {
        if (!img) return;
        // ใช้ขนาดที่ปลอดภัย
        const w = img.naturalWidth || img.width || 800;
        const h = img.naturalHeight || img.height || 600;
        if (w === 0 || h === 0) {
            showToast('รูปภาพยังไม่โหลดเสร็จ', '⏳');
            return;
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        // ใช้ filter style ล่าสุด
        const filterStyle = lastFilterValue || 'none';
        ctx.filter = filterStyle;
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

    // เลือก asset ตาม index
    function selectAsset(index) {
        if (!img || !imgLabel) return;
        if (index < 0 || index >= ASSETS.length) {
            console.warn('Asset index out of range:', index);
            return;
        }
        currentAssetIndex = index;
        const asset = ASSETS[index];
        img.src = asset.url;
        imgLabel.textContent = asset.label;
        // อัปเดต active class ใน grid
        const items = container?.querySelectorAll('.item');
        if (items) {
            items.forEach((el, i) => {
                el.classList.toggle('active', i === index);
            });
        }
        resetFilters(); // reset filter เมื่อเปลี่ยนภาพ
        // อัปเดต label filter
        updateFilterLabel();
        // ล้าง uploaded state
        fileInput && (fileInput.value = '');
    }

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
                showToast(`เปลี่ยนเป็น ${asset.label}`, '🖼️');
            });
            grid.appendChild(div);
        });
        const countEl = container?.querySelector('#assetCount');
        if (countEl) countEl.textContent = ASSETS.length;
    }

    function showToast(msg, emoji = '✨') {
        if (!toast || !toastMsg) {
            // fallback: alert? แต่ไม่ควร
            console.log(`[Toast] ${emoji} ${msg}`);
            return;
        }
        toastMsg.textContent = msg;
        const emojiEl = toast.querySelector('.emoji');
        if (emojiEl) emojiEl.textContent = emoji;
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
        if (!img) return;
        img.style.filter = 'none';
        currentFilter = 'none';
        lastFilterValue = 'none';
        filterHistory = [];
        historyIndex = -1;
        if (canvasWrap) canvasWrap.classList.remove('glow');
        updateFilterLabel();
    }

    function updateFilterLabel() {
        if (!filterLabel) return;
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

    // ---- processPrompt (ใช้ pre-sorted keys) ----
    function processPrompt(text) {
        const t = text.toLowerCase();
        for (const key of PROMPT_KEYS) {
            if (t.includes(key)) {
                return FILTER_MAP.get(key);
            }
        }
        // default
        return { filter: 'cinematic', label: 'Enhanced', emoji: '✨' };
    }

    function applyFilter(filterName, label) {
        if (!img) return;
        // ตรวจสอบว่า filterName มีอยู่ใน FILTER_STYLES หรือไม่
        const filterValue = FILTER_STYLES[filterName] || 'none';
        img.style.filter = filterValue;
        currentFilter = filterName;
        lastFilterValue = filterValue;
        if (canvasWrap) canvasWrap.classList.add('glow');
        updateFilterLabel();

        // จัดการ history
        filterHistory.push({ filter: filterName, value: filterValue });
        if (filterHistory.length > MAX_HISTORY) {
            filterHistory.shift();
        }
        historyIndex = filterHistory.length - 1;
    }

    function handleUpload(file) {
        if (!file || !file.type.startsWith('image/')) {
            showToast('กรุณาเลือกไฟล์รูปภาพ', '❌');
            return;
        }
        if (!img || !imgLabel) return;
        const url = URL.createObjectURL(file);
        img.src = url;
        img.onload = function() {
            URL.revokeObjectURL(url);
            // อัปเดต label
            imgLabel.textContent = `📸 ${file.name}`;
            // ล้าง active class ใน grid
            const items = container?.querySelectorAll('.item');
            if (items) {
                items.forEach(el => el.classList.remove('active'));
            }
            resetFilters();
            showToast(`อัปโหลด "${file.name}" สำเร็จ`, '📤');
            if (fileInput) fileInput.value = '';
            currentAssetIndex = -1; // indicate uploaded
        };
        img.onerror = function() {
            URL.revokeObjectURL(url);
            showToast('ไม่สามารถโหลดรูปภาพได้', '❌');
            imgLabel.textContent = '❌ โหลดผิดพลาด';
        };
    }

    // ---- Event binding ----
    function bindEvents() {
        if (promptEl) {
            promptEl.addEventListener('input', updateCharCount);
        }

        if (fileInput) {
            fileInput.addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (file) handleUpload(file);
            });
        }

        // Chips (ถ้ามี)
        const chips = container?.querySelectorAll('.chip');
        if (chips) {
            chips.forEach(chip => {
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
        }

        // Keyboard shortcuts – ใช้ capturing? แต่ใช้ bubbling
        document.addEventListener('keydown', (e) => {
            // ตรวจสอบว่า active element อยู่ใน image-tab หรือไม่
            const activeEl = document.activeElement;
            const isInside = container && container.contains(activeEl);
            if (!isInside) return;

            // ถ้ากำลังพิมพ์ใน input/textarea/select ให้ข้าม shortcut
            const tag = activeEl?.tagName?.toLowerCase() || '';
            if (['input', 'textarea', 'select'].includes(tag)) {
                // ยกเว้น ctrl+Enter ที่ยังใช้งานได้
                if (!((e.ctrlKey || e.metaKey) && e.key === 'Enter')) {
                    return;
                }
            }

            // Ctrl/Cmd + Enter -> apply
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                global.applyMagic();
                return;
            }

            // Escape -> clear prompt
            if (e.key === 'Escape' && activeEl === promptEl) {
                e.preventDefault();
                if (promptEl) {
                    promptEl.value = '';
                    updateCharCount();
                    showToast('ล้างข้อความแล้ว', '🧹');
                }
                return;
            }

            // 'r' -> reset (เฉพาะเมื่อไม่ได้ focus ที่ input)
            if (e.key === 'r' && !e.ctrlKey && !e.metaKey) {
                if (activeEl && ['input', 'textarea', 'select'].includes(activeEl.tagName.toLowerCase())) {
                    return;
                }
                e.preventDefault();
                global.resetImage();
            }
        });
    }

    // ---- เริ่มต้นเมื่อ DOM พร้อม? เราให้ผู้ใช้เรียกเอง แต่ถ้าเรียกก่อน DOM พร้อมก็จะมีปัญหา ----
    console.log('🖼️ Image Editor โหลดแล้ว (รอเรียก initImageEditor)');

})(window);
