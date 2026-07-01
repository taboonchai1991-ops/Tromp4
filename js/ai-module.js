// ================================================================
//  ai-module.js – ฟังก์ชัน AI (Histogram + COCO-SSD Scene Detection)
//  เพิ่ม: ดึงตัวเลขจาก prompt สำหรับ trim
// ================================================================

(function(global) {
    'use strict';

    let model = null;
    let modelLoaded = false;
    let _cachedScenes = null;
    const modelStatus = document.getElementById('modelStatus');

    // ---- โหลดโมเดล ----
    global.loadAIModel = async function() {
        if (modelLoaded) return;
        modelStatus.textContent = '⏳ กำลังโหลดโมเดล...';
        try {
            model = await cocoSsd.load({ base: 'mobilenet_v2' });
            modelLoaded = true;
            modelStatus.textContent = '✅ โหลด COCO-SSD สำเร็จ';
            console.log('✅ COCO-SSD loaded');
        } catch (err) {
            modelStatus.textContent = '❌ โหลดโมเดลล้มเหลว: ' + err.message;
            console.error(err);
        }
    };

    // ============================================================
    //  ดึงตัวเลขจาก Prompt (ใช้สำหรับ trim)
    // ============================================================

    function extractNumbersFromPrompt(text) {
        // หาตัวเลขที่มีจุดทศนิยมหรือจำนวนเต็ม
        const matches = text.match(/(\d+\.?\d*)/g);
        if (!matches || matches.length < 2) return null;
        const nums = matches.map(Number).filter(n => !isNaN(n) && n >= 0);
        if (nums.length >= 2) {
            return { inVal: nums[0], outVal: nums[1] };
        }
        return null;
    }

    // ============================================================
    //  RUN AI (หลัก) – เพิ่มการตรวจจับ trim
    // ============================================================

    global.runAI = function() {
        const p = document.getElementById('promptVideo').value.toLowerCase().trim();
        const video = global.getVideo();
        if (!video.src) return alert('กรุณาโหลดวิดีโอก่อน');

        // ---- ตรวจจับคำสั่ง trim (พร้อมตัวเลข) ----
        if (p.includes('trim') || p.includes('ตัดเฉพาะ') || p.includes('ตัดทิ้ง')) {
            // ลองดึงตัวเลขจาก prompt
            const nums = extractNumbersFromPrompt(p);
            if (nums) {
                // ตั้งค่า In/Out จากตัวเลขที่ได้
                const inPointInput = document.getElementById('inPointInput');
                const outPointInput = document.getElementById('outPointInput');
                if (inPointInput && outPointInput) {
                    inPointInput.value = nums.inVal.toFixed(2);
                    outPointInput.value = nums.outVal.toFixed(2);
                    global.setStatus(`📍 ตั้งค่า In=${nums.inVal}s, Out=${nums.outVal}s จากคำสั่ง`);
                }
                // เรียก applyInOutFromInput เพื่ออัปเดต state
                if (typeof global.applyInOutFromInput === 'function') {
                    global.applyInOutFromInput();
                }
            }
            // เรียก trim
            if (typeof global.trimToSelection === 'function') {
                global.trimToSelection();
            } else {
                global.setStatus('❌ ไม่พบฟังก์ชัน trimToSelection');
            }
            return;
        }

        // ---- คำสั่งอื่น ๆ (เหมือนเดิม) ----
        if (p.includes('cut') || p.includes('ตัด')) {
            if (p.includes('ml') || p.includes('machine')) {
                global.autoDetectScenesML();
            } else {
                global.autoDetectScenesHistogram();
            }
        }
        if (p.includes('cinematic')) global.applyEffect('cinematic');
        if (p.includes('fast')) global.applyEffect('fast');
        if (p.includes('vlog')) global.applyEffect('vlog');
        if (p.includes('smooth')) global.applyEffect('smooth');
        if (p.includes('captions') || p.includes('คำบรรยาย')) {
            generateCaptions();
        }
        if (p.includes('in') && p.includes('out') && !p.includes('trim')) {
            global.setInPoint();
            setTimeout(global.setOutPoint, 500);
        }
        global.setStatus('✨ AI ประมวลผลคำสั่งแล้ว');
    };

    // ---- Histogram Scene Detection (เร็ว) ----
    global.autoDetectScenesHistogram = async function() {
        const video = global.getVideo();
        const canvas = global.getCanvas();
        const ctx = global.getContext();
        if (!video.src) return alert('กรุณาโหลดวิดีโอก่อน');
        global.setStatus('📊 กำลังวิเคราะห์ฉากด้วย Histogram...');

        const step = 0.5;
        const threshold = 0.3;
        const scenes = [];
        let prevHist = null;

        video.pause();
        const totalDur = video.duration;

        for (let t = 0; t < totalDur; t += step) {
            video.currentTime = t;
            await new Promise(r => setTimeout(r, 30));
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const hist = getHistogram(imageData);

            if (prevHist) {
                const diff = compareHistogram(prevHist, hist);
                if (diff > threshold) {
                    scenes.push({ start: t, label: `Scene ${scenes.length+1}` });
                }
            }
            prevHist = hist;
        }

        const clipData = [];
        let lastStart = 0;
        for (let i = 0; i < scenes.length; i++) {
            const end = scenes[i].start;
            clipData.push({ start: lastStart, end: end, label: `Scene ${i+1}` });
            lastStart = end;
        }
        clipData.push({ start: lastStart, end: totalDur, label: `Scene ${scenes.length+1}` });

        global.renderClips(clipData);
        global.setStatus(`✅ Histogram: พบ ${clipData.length} ฉาก`);
    };

    function getHistogram(imageData) {
        const data = imageData.data;
        const hist = new Array(256).fill(0);
        for (let i = 0; i < data.length; i += 4) {
            const gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
            hist[Math.floor(gray)]++;
        }
        return hist;
    }

    function compareHistogram(h1, h2) {
        let diff = 0;
        for (let i = 0; i < h1.length; i++) diff += Math.abs(h1[i] - h2[i]);
        return diff / (h1.length * 255 * 2);
    }

    // ---- ML Scene Detection (แม่นยำ) ----
    global.autoDetectScenesML = async function() {
        const video = global.getVideo();
        const canvas = global.getCanvas();
        const ctx = global.getContext();
        if (!video.src) return alert('กรุณาโหลดวิดีโอก่อน');

        if (_cachedScenes && video.src === _cachedScenes.src) {
            global.renderClips(_cachedScenes.clips);
            global.setStatus(`✅ ใช้ผลลัพธ์เดิม (ML): ${_cachedScenes.clips.length} ฉาก`);
            return;
        }

        if (!modelLoaded) {
            global.setStatus('⏳ กำลังโหลดโมเดล... โปรดรอ');
            await global.loadAIModel();
            if (!modelLoaded) return alert('โหลดโมเดลไม่สำเร็จ');
        }

        global.setStatus('🧠 กำลังวิเคราะห์ฉากด้วย ML (COCO-SSD) ...');
        const totalDur = video.duration;
        const step = 0.6;
        const similarityThreshold = 0.4;
        const scale = 0.2;

        video.pause();

        const smallCanvas = document.createElement('canvas');
        const smallCtx = smallCanvas.getContext('2d');
        const sw = canvas.width * scale;
        const sh = canvas.height * scale;
        smallCanvas.width = sw;
        smallCanvas.height = sh;

        let prevClasses = new Set();
        const sceneStarts = [];
        let progress = 0;
        const totalSteps = Math.floor(totalDur / step);

        const { exportProgress, exportBar } = global.getExportProgress();
        exportProgress.classList.add('visible');
        exportBar.style.width = '0%';

        for (let t = 0; t < totalDur; t += step) {
            video.currentTime = t;
            await new Promise(r => setTimeout(r, 40));

            smallCtx.clearRect(0, 0, sw, sh);
            smallCtx.drawImage(video, 0, 0, sw, sh);

            let detections = [];
            try {
                detections = await model.detect(smallCanvas);
            } catch (err) {
                console.warn('Detection error at', t, err);
            }

            const currentClasses = new Set(
                detections.filter(d => d.score > 0.5).map(d => d.class)
            );

            if (prevClasses.size > 0 && currentClasses.size > 0) {
                const sim = jaccardSimilarity(prevClasses, currentClasses);
                if (sim < similarityThreshold) {
                    sceneStarts.push(t);
                }
            } else if (prevClasses.size > 0 && currentClasses.size === 0) {
                sceneStarts.push(t);
            } else if (prevClasses.size === 0 && currentClasses.size > 0) {
                sceneStarts.push(t);
            }

            prevClasses = currentClasses;

            progress += 1;
            const pct = Math.min((progress / totalSteps) * 100, 100);
            exportBar.style.width = pct + '%';
            global.setStatus(`🧠 กำลังวิเคราะห์... ${Math.round(pct)}%`);

            if (t >= totalDur - step) {
                drawDetections(detections);
            }
        }

        exportProgress.classList.remove('visible');
        exportBar.style.width = '0%';

        const clipData = [];
        let lastStart = 0;
        for (let i = 0; i < sceneStarts.length; i++) {
            const end = sceneStarts[i];
            if (end - lastStart > 0.5) {
                clipData.push({ start: lastStart, end: end, label: `Scene ${clipData.length+1}` });
            }
            lastStart = end;
        }
        if (totalDur - lastStart > 0.5) {
            clipData.push({ start: lastStart, end: totalDur, label: `Scene ${clipData.length+1}` });
        }
        if (clipData.length === 0) {
            clipData.push({ start: 0, end: totalDur, label: 'Full Video' });
        }

        _cachedScenes = { src: video.src, clips: clipData };

        global.renderClips(clipData);
        global.setStatus(`✅ ML: พบ ${clipData.length} ฉาก (ใช้ COCO-SSD)`);
    };

    function jaccardSimilarity(setA, setB) {
        const intersection = new Set([...setA].filter(x => setB.has(x)));
        const union = new Set([...setA, ...setB]);
        return intersection.size / union.size;
    }

    function drawDetections(detections) {
        const canvas = global.getCanvas();
        const ctx = global.getContext();
        ctx.save();
        ctx.filter = 'none';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(global.getVideo(), 0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 2;
        ctx.font = '14px Arial';
        ctx.fillStyle = '#00ff88';
        detections.forEach(d => {
            if (d.score < 0.5) return;
            const [x, y, w, h] = d.bbox;
            ctx.strokeRect(x, y, w, h);
            ctx.fillText(`${d.class} (${Math.round(d.score*100)}%)`, x, y - 6);
        });
        ctx.restore();
    }

    // ---- Captions (จำลอง) ----
    function generateCaptions() {
        const phrases = ['เริ่มต้น...', 'เนื้อหาสำคัญ', 'สรุปจบ'];
        let i = 0;
        const interval = setInterval(() => {
            if (i >= phrases.length) { clearInterval(interval); return; }
            global.setStatus('📝 ' + phrases[i]);
            i++;
        }, 1500);
    }

    console.log('🧠 AI Module พร้อมทำงาน (เวอร์ชัน trim + ตัวเลข)');

})(window);