// ================================================================
//  video-editor.js – จัดการวิดีโอ, Canvas, UI, Timeline, Export
//  เพิ่ม: In/Out จาก Input, Trim to Selection (พร้อมเสียง)
// ================================================================

(function(global) {
    'use strict';

    // ---- DOM refs (ใช้ภายใน video tab) ----
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas.getContext('2d');
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = false;

    const statusText = document.getElementById('statusText');
    const timeDisplay = document.getElementById('timeDisplay');
    const track = document.getElementById('track');
    const playhead = document.getElementById('playhead');
    const clipCount = document.getElementById('clipCount');
    const exportProgress = document.getElementById('exportProgress');
    const exportBar = document.getElementById('exportBar');

    // ---- Input fields ----
    const inPointInput = document.getElementById('inPointInput');
    const outPointInput = document.getElementById('outPointInput');

    // ---- State ----
    let isPlaying = false;
    let animationId = null;
    let currentFilter = { contrast: 1, saturate: 1, brightness: 1, blur: 0, speed: 1 };
    let inPoint = 0;
    let outPoint = null;
    let clips = [];
    let isExporting = false;

    // ============================================================
    //  UTILITY: formatTime (แสดงทศนิยม 2 ตำแหน่ง)
    // ============================================================

    function formatTime(t) {
        if (isNaN(t) || t < 0) return '0.00s';
        const seconds = Math.floor(t);
        const ms = Math.floor((t - seconds) * 100);
        return `${seconds}.${ms.toString().padStart(2, '0')}s`;
    }

    // ============================================================
    //  IN / OUT จาก Input Fields
    // ============================================================

    global.applyInOutFromInput = function() {
        const inVal = parseFloat(inPointInput.value);
        const outVal = parseFloat(outPointInput.value);

        if (isNaN(inVal) || inVal < 0) {
            alert('กรุณาใส่ตัวเลขที่ถูกต้องสำหรับ In');
            return;
        }
        if (isNaN(outVal) || outVal < 0) {
            alert('กรุณาใส่ตัวเลขที่ถูกต้องสำหรับ Out');
            return;
        }
        if (outVal <= inVal) {
            alert('Out ต้องมากกว่า In');
            return;
        }
        if (outVal > (video.duration || 999)) {
            alert(`Out ต้องไม่เกินความยาววิดีโอ (${video.duration.toFixed(2)} วินาที)`);
            return;
        }

        inPoint = inVal;
        outPoint = outVal;

        statusText.textContent = `📍 In = ${formatTime(inPoint)} | Out = ${formatTime(outPoint)}`;
        showTrimRange();
    };

    global.setInPoint = function() {
        inPoint = video.currentTime;
        inPointInput.value = inPoint.toFixed(2);
        statusText.textContent = `📍 In = ${formatTime(inPoint)}`;
        showTrimRange();
    };

    global.setOutPoint = function() {
        outPoint = video.currentTime;
        outPointInput.value = outPoint.toFixed(2);
        statusText.textContent = `📍 Out = ${formatTime(outPoint)}`;
        showTrimRange();
    };

    function showTrimRange() {
        if (inPoint !== null && outPoint !== null && outPoint > inPoint) {
            statusText.textContent += ` ✂️ ช่วงที่เลือก: ${formatTime(inPoint)} - ${formatTime(outPoint)} (${(outPoint - inPoint).toFixed(2)}s)`;
        }
    }

    // ============================================================
    //  TRIM TO SELECTION (ใช้ video.captureStream() เพื่อรวมเสียง)
    // ============================================================

    global.trimToSelection = async function() {
        const video = global.getVideo();
        if (!video.src) return alert('กรุณาโหลดวิดีโอก่อน');

        // ใช้ค่าจาก input fields ถ้ามี
        const inVal = parseFloat(inPointInput.value);
        const outVal = parseFloat(outPointInput.value);
        if (!isNaN(inVal) && !isNaN(outVal) && outVal > inVal) {
            inPoint = inVal;
            outPoint = outVal;
        }

        const start = inPoint;
        const end = (outPoint !== null && outPoint > start) ? outPoint : video.duration;
        if (end <= start) return alert('กำหนด In/Out ไม่ถูกต้อง (ต้อง Out > In)');
        if (end - start < 0.1) return alert('ช่วงที่เลือกสั้นเกินไป (ต้องมากกว่า 0.1 วินาที)');

        global.setStatus(`✂️ กำลังตัดเฉพาะช่วง ${formatTime(start)} - ${formatTime(end)} (รวมเสียง)...`);

        // ★★★ ใช้ video.captureStream() เพื่อรวมทั้งภาพและเสียง ★★★
        const stream = video.captureStream();
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
        const chunks = [];

        recorder.ondataavailable = e => chunks.push(e.data);
        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);

            // หยุดวิดีโอเก่าและแทนที่ด้วยคลิปใหม่
            video.pause();
            video.src = url;
            video.load();
            video.onloadedmetadata = () => {
                // รีเซ็ต In/Out
                inPoint = 0;
                outPoint = null;
                inPointInput.value = '0';
                outPointInput.value = video.duration.toFixed(2);
                // รีเซ็ตฟิลเตอร์
                global.applyEffect('none');
                // อัปเดต Timeline
                global.renderClips([{ start: 0, end: video.duration, label: 'Trimmed Clip' }]);
                global.setStatus(`✅ ตัดเสร็จ! เหลือ ${formatTime(video.duration)} (พร้อมเสียง)`);
                // เล่นอัตโนมัติ
                video.play();
                isPlaying = true;
                document.querySelectorAll('#video-tab .tool-btn').forEach(el => el.classList.remove('active'));
            };
            video.onerror = () => {
                global.setStatus('❌ ตัดไม่สำเร็จ');
            };
        };

        recorder.start();

        // เล่นตั้งแต่ start ถึง end
        video.currentTime = start;
        await video.play();

        const totalDuration = end - start;
        let elapsed = 0;
        const interval = 50;

        const checkEnd = () => {
            if (video.currentTime >= end) {
                video.pause();
                recorder.stop();
                isPlaying = false;
                video.removeEventListener('timeupdate', checkEnd);
                clearInterval(progressInterval);
            }
        };

        const progressInterval = setInterval(() => {
            elapsed += interval / 1000;
            const pct = Math.min((elapsed / totalDuration) * 100, 100);
            global.setStatus(`✂️ กำลังตัด... ${Math.round(pct)}%`);
            if (elapsed >= totalDuration) {
                clearInterval(progressInterval);
            }
        }, interval);

        video.addEventListener('timeupdate', checkEnd);
    };

    // ============================================================
    //  EXPORT TRIMMED (ใช้ video.captureStream() เพื่อรวมเสียง)
    // ============================================================

    global.exportTrimmed = async function() {
        if (!video.src) return alert('กรุณาโหลดวิดีโอก่อน');
        if (isExporting) return;

        // ใช้ค่าจาก input fields ถ้ามี
        const inVal = parseFloat(inPointInput.value);
        const outVal = parseFloat(outPointInput.value);
        if (!isNaN(inVal) && !isNaN(outVal) && outVal > inVal) {
            inPoint = inVal;
            outPoint = outVal;
        }

        const start = inPoint;
        const end = (outPoint !== null && outPoint > start) ? outPoint : video.duration;
        if (end <= start) return alert('กำหนด In/Out ไม่ถูกต้อง');

        isExporting = true;
        statusText.textContent = '⏳ กำลังบันทึก... (รวมเสียง)';
        exportProgress.classList.add('visible');
        exportBar.style.width = '0%';

        // ★★★ ใช้ video.captureStream() เพื่อรวมทั้งภาพและเสียง ★★★
        const stream = video.captureStream();
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
        const chunks = [];

        recorder.ondataavailable = e => chunks.push(e.data);
        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `trimmed_${formatTime(start)}-${formatTime(end)}.webm`;
            a.click();
            URL.revokeObjectURL(url);
            isExporting = false;
            exportProgress.classList.remove('visible');
            exportBar.style.width = '0%';
            statusText.textContent = '✅ บันทึกเสร็จ (มีเสียง)';
        };

        recorder.start();

        video.currentTime = start;
        await video.play();

        const totalDuration = end - start;
        let elapsed = 0;
        const interval = 50;

        const updateProgress = setInterval(() => {
            elapsed += interval / 1000;
            const pct = Math.min((elapsed / totalDuration) * 100, 100);
            exportBar.style.width = pct + '%';
            if (elapsed >= totalDuration) {
                clearInterval(updateProgress);
                video.pause();
                recorder.stop();
                isPlaying = false;
            }
        }, interval);

        const checkEnd = () => {
            if (video.currentTime >= end) {
                video.pause();
                recorder.stop();
                isPlaying = false;
                video.removeEventListener('timeupdate', checkEnd);
            }
        };
        video.addEventListener('timeupdate', checkEnd);
    };

    // ============================================================
    //  ฟังก์ชันสาธารณะ (เดิม)
    // ============================================================

    global.loadVideo = function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        video.src = url;
        video.load();
        video.onloadedmetadata = () => {
            resizeCanvas();
            // ตั้งค่า Out = ความยาววิดีโอ
            outPointInput.value = video.duration.toFixed(2);
            outPoint = video.duration;

            video.play().then(() => {
                video.pause();
                isPlaying = false;
                statusText.textContent = '✅ โหลดวิดีโอสำเร็จ';
                updateTimeDisplay();
                renderClips([]);
                startRenderLoop();
            }).catch(() => {});
        };
        video.onerror = () => { statusText.textContent = '❌ โหลดล้มเหลว'; };
    };

    global.togglePlay = function() {
        if (!video.src) return;
        if (isPlaying) { video.pause(); }
        else {
            if (outPoint !== null && video.currentTime >= outPoint) video.currentTime = inPoint || 0;
            video.play().catch(() => {});
        }
        isPlaying = !isPlaying;
    };

    global.resetVideo = function() {
        video.currentTime = 0;
        if (isPlaying) { video.pause(); isPlaying = false; }
    };

    global.applyEffect = function(type) {
        if (type === 'none') {
            currentFilter = { contrast: 1, saturate: 1, brightness: 1, blur: 0, speed: 1 };
            video.playbackRate = 1.0;
            document.querySelectorAll('#video-tab .tool-btn').forEach(el => el.classList.remove('active'));
            statusText.textContent = '🎨 รีเซ็ตฟิลเตอร์';
            return;
        }

        currentFilter = { contrast: 1, saturate: 1, brightness: 1, blur: 0, speed: 1 };
        video.playbackRate = 1.0;
        document.querySelectorAll('#video-tab .tool-btn').forEach(el => el.classList.remove('active'));
        const btn = document.querySelector(`#video-tab .tool-btn[data-effect="${type}"]`);
        if (btn) btn.classList.add('active');

        switch (type) {
            case 'cinematic': currentFilter.contrast = 1.25; currentFilter.saturate = 1.3; currentFilter.brightness = 0.92; break;
            case 'fast': video.playbackRate = 1.8; break;
            case 'vlog': currentFilter.saturate = 1.5; currentFilter.brightness = 1.08; currentFilter.contrast = 1.05; break;
            case 'smooth': currentFilter.blur = 0.3; currentFilter.contrast = 1.05; currentFilter.saturate = 0.95; break;
        }
        statusText.textContent = `🎯 เอฟเฟกต์: ${type}`;
    };

    // ---- ฟังก์ชันภายใน ----
    function resizeCanvas() {
        const vw = video.videoWidth || 640;
        const vh = video.videoHeight || 360;
        const container = canvas.parentElement;
        const rect = container.getBoundingClientRect();
        const ratio = vw / vh;
        let w = rect.width;
        let h = rect.height;
        if (w / h > ratio) w = h * ratio;
        else h = w / ratio;
        canvas.width = w;
        canvas.height = h;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
    }

    function startRenderLoop() {
        if (animationId) cancelAnimationFrame(animationId);
        function draw() {
            if (video.readyState >= 2) {
                ctx.filter = buildFilter();
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            }
            updatePlayhead();
            updateTimeDisplay();
            animationId = requestAnimationFrame(draw);
        }
        draw();
    }

    function buildFilter() {
        const f = currentFilter;
        return `contrast(${f.contrast}) saturate(${f.saturate}) brightness(${f.brightness}) blur(${f.blur}px)`;
    }

    function updateTimeDisplay() {
        const dur = video.duration || 0;
        const cur = video.currentTime || 0;
        timeDisplay.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
    }

    function updatePlayhead() {
        const dur = video.duration || 1;
        const pct = (video.currentTime / dur) * 100;
        playhead.style.left = `${Math.min(pct, 100)}%`;
    }

    global.renderClips = function(clipData) {
        const playheadEl = document.getElementById('playhead');
        track.innerHTML = '';
        track.appendChild(playheadEl);

        const totalDur = video.duration || 20;
        if (totalDur === 0) return;

        if (!clipData || clipData.length === 0) {
            const div = document.createElement('div');
            div.className = 'clip-item';
            div.style.width = '100%';
            div.textContent = '📹 วิดีโอหลัก';
            track.appendChild(div);
            clipCount.textContent = '1 คลิป';
            clips = [];
            return;
        }

        clipData.forEach((c, i) => {
            const div = document.createElement('div');
            div.className = 'clip-item';
            const dur = c.end - c.start;
            const pct = (dur / totalDur) * 100;
            div.style.width = `${Math.max(pct, 5)}%`;
            div.innerHTML = `
                <span>${c.label || `Scene ${i+1}`}</span>
                <span class="duration-badge">${formatTime(dur)}</span>
            `;
            div.dataset.start = c.start;
            div.dataset.end = c.end;
            div.onclick = () => {
                video.currentTime = c.start;
                if (isPlaying) { video.pause(); isPlaying = false; }
            };
            track.appendChild(div);
        });

        clips = clipData;
        clipCount.textContent = `${clips.length} คลิป`;
    };

    // ---- ฟังก์ชันสำหรับ AI module ----
    global.getVideo = function() { return video; };
    global.getCanvas = function() { return canvas; };
    global.getContext = function() { return ctx; };
    global.setStatus = function(msg) { statusText.textContent = msg; };
    global.getExportProgress = function() { return { exportProgress, exportBar }; };
    global.formatTime = formatTime;

    // ---- Keyboard shortcuts ----
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
        if (e.code === 'Space') { e.preventDefault(); global.togglePlay(); }
        if (e.code === 'ArrowRight') { video.currentTime = Math.min(video.currentTime + 2, video.duration); }
        if (e.code === 'ArrowLeft') { video.currentTime = Math.max(video.currentTime - 2, 0); }
        if (e.code === 'KeyR') { global.resetVideo(); }
        if (e.code === 'KeyI') { global.setInPoint(); }
        if (e.code === 'KeyO') { global.setOutPoint(); }
        if (e.code === 'KeyT') { global.trimToSelection(); }
    });

    // ---- init ----
    global.initVideoEditor = function() {
        statusText.textContent = '📂 อัปโหลดวิดีโอเพื่อเริ่ม';
        inPointInput.value = '0';
        outPointInput.value = '10';
        inPoint = 0;
        outPoint = 10;
        console.log('🎬 Video Editor พร้อมทำงาน (เวอร์ชันพร้อมเสียง)');
    };

})(window);