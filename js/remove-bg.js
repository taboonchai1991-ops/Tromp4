document.addEventListener('DOMContentLoaded', function() {

    // ===== DOM Refs =====
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const canvasWrap = document.getElementById('canvasWrap');

    const mainInput = document.getElementById('mainImage');
    const bgInput = document.getElementById('bgImage');
    const colorInput = document.getElementById('bgColor');
    const scaleSlider = document.getElementById('scaleSlider');
    const scaleLabel = document.getElementById('scaleLabel');
    const downloadBtn = document.getElementById('downloadBtn');
    const resetBtn = document.getElementById('resetBtn');

    const mainFileName = document.getElementById('mainFileName');
    const bgFileName = document.getElementById('bgFileName');
    const colorHex = document.getElementById('colorHex');
    const dimDisplay = document.getElementById('dimDisplay');
    const posDisplay = document.getElementById('posDisplay');
    const sizeDisplay = document.getElementById('sizeDisplay');

    // ===== ค่าคงที่ =====
    const W = 1200;
    const H = 1200;

    // ===== State =====
    let mainImage = null;
    let bgImage = null;
    let mainX = W / 2;
    let mainY = H / 2;
    let mainScale = 0.80;
    let mainHasAlpha = false;          // ← 新增: บอกว่ารูปมีอัลฟาหรือไม่

    let isDragging = false;
    let dragStartX = 0,
        dragStartY = 0;
    let dragStartMainX = 0,
        dragStartMainY = 0;

    // ===== Helper =====
    function getMainDrawParams() {
        if (!mainImage) return null;
        const scale = mainScale * Math.min(W / mainImage.width, H / mainImage.height);
        const w = mainImage.width * scale;
        const h = mainImage.height * scale;
        const x = mainX - w / 2;
        const y = mainY - h / 2;
        return { x, y, w, h, scale };
    }

    function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

    // ===== ตรวจสอบว่ารูปมีอัลฟาแชนเนล (โปร่งใส) หรือไม่ =====
    function checkAlpha(image) {
        const c = document.createElement('canvas');
        c.width = image.width;
        c.height = image.height;
        const cx = c.getContext('2d');
        cx.drawImage(image, 0, 0);
        const data = cx.getImageData(0, 0, c.width, c.height).data;
        // ตรวจสอบพิกเซลในกริด 10x10 เพื่อประหยัดเวลา
        const step = Math.max(1, Math.floor(Math.min(c.width, c.height) / 50));
        for (let y = 0; y < c.height; y += step) {
            for (let x = 0; x < c.width; x += step) {
                const idx = (y * c.width + x) * 4 + 3;
                if (data[idx] < 255) return true;
            }
        }
        return false;
    }

    // ===== Render =====
    function render() {
        ctx.clearRect(0, 0, W, H);

        ctx.fillStyle = colorInput.value;
        ctx.fillRect(0, 0, W, H);

        if (bgImage) {
            const bw = bgImage.width,
                bh = bgImage.height;
            const s = Math.max(W / bw, H / bh);
            const sw = bw * s,
                sh = bh * s;
            ctx.drawImage(bgImage, (W - sw) / 2, (H - sh) / 2, sw, sh);
        }

        if (mainImage) {
            const p = getMainDrawParams();
            if (p) {
                ctx.save();

                // ปรับเงาตามว่ามีอัลฟาหรือไม่
                if (mainHasAlpha) {
                    // เงาจาง ๆ หรือจะไม่ใส่ก็ได้
                    ctx.shadowColor = 'rgba(0,0,0,0.08)';
                    ctx.shadowBlur = 8;
                    ctx.shadowOffsetY = 2;
                } else {
                    ctx.shadowColor = 'rgba(0,0,0,0.5)';
                    ctx.shadowBlur = 28;
                    ctx.shadowOffsetY = 6;
                }

                ctx.drawImage(mainImage, p.x, p.y, p.w, p.h);
                ctx.restore();

                // ✅ ถ้ามีอัลฟา → ไม่วาดเส้นขอบ
                if (!mainHasAlpha) {
                    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
                    ctx.lineWidth = 1.5;
                    ctx.strokeRect(p.x, p.y, p.w, p.h);
                }
            }
        }

        if (mainImage) {
            const p = getMainDrawParams();
            if (p) {
                posDisplay.textContent = '📍 ตำแหน่ง: ' + Math.round(p.x) + ', ' + Math.round(p.y);
                sizeDisplay.textContent = '📐 ขนาด: ' + Math.round(p.w) + ' × ' + Math.round(p.h);
            }
        } else {
            posDisplay.textContent = '📍 ตำแหน่ง: —';
            sizeDisplay.textContent = '📐 ขนาด: —';
        }

        canvas.style.cursor = mainImage ? 'grab' : 'default';
    }

    // ===== ปรับขนาด =====
    function updateScale() {
        const val = parseInt(scaleSlider.value, 10);
        mainScale = val / 100;
        scaleLabel.textContent = val + '%';
        render();
    }

    // ===== รีเซ็ต =====
    function resetPositionAndScale() {
        mainX = W / 2;
        mainY = H / 2;
        scaleSlider.value = '80';
        mainScale = 0.80;
        scaleLabel.textContent = '80%';
        render();
    }

    // ===== อัปโหลดรูปหลัก =====
    mainInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        mainFileName.textContent = file.name.length > 18 ? file.name.slice(0, 16) + '…' : file.name;

        const reader = new FileReader();
        reader.onload = function(ev) {
            const img = new Image();
            img.onload = function() {
                mainImage = img;
                mainHasAlpha = checkAlpha(img);   // ← ตรวจสอบอัลฟา
                resetPositionAndScale();
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    });

    // ===== อัปโหลดรูปพื้นหลัง =====
    bgInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        bgFileName.textContent = file.name.length > 18 ? file.name.slice(0, 16) + '…' : file.name;

        const reader = new FileReader();
        reader.onload = function(ev) {
            const img = new Image();
            img.onload = function() {
                bgImage = img;
                document.querySelectorAll('.sample-thumb').forEach(el => el.classList.remove('active'));
                render();
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    });

    // ===== สีพื้นหลัง =====
    colorInput.addEventListener('input', function() {
        colorHex.textContent = colorInput.value;
        render();
    });

    // ===== สไลด์เลอร์ =====
    scaleSlider.addEventListener('input', updateScale);

    // ===== รีเซ็ต =====
    resetBtn.addEventListener('click', resetPositionAndScale);

    // ===== ดาวน์โหลด =====
    downloadBtn.addEventListener('click', function() {
        const link = document.createElement('a');
        link.download = 'background-editor.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    });

    // ===== การลาก (Drag) =====
    function getCanvasCoords(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        let clientX, clientY;
        if (e.touches) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
            e.preventDefault();
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
            return null;
        }
        const x = (clientX - rect.left) * scaleX;
        const y = (clientY - rect.top) * scaleY;
        return { x, y };
    }

    function onDragStart(e) {
        if (!mainImage) return;
        const pos = getCanvasCoords(e);
        if (!pos) return;
        const p = getMainDrawParams();
        if (!p) return;
        if (pos.x >= p.x && pos.x <= p.x + p.w &&
            pos.y >= p.y && pos.y <= p.y + p.h) {
            isDragging = true;
            dragStartX = pos.x;
            dragStartY = pos.y;
            dragStartMainX = mainX;
            dragStartMainY = mainY;
            canvas.style.cursor = 'grabbing';
            if (e.preventDefault) e.preventDefault();
        }
    }

    function onDragMove(e) {
        if (!isDragging || !mainImage) return;
        const pos = getCanvasCoords(e);
        if (!pos) return;
        const dx = pos.x - dragStartX;
        const dy = pos.y - dragStartY;
        mainX = dragStartMainX + dx;
        mainY = dragStartMainY + dy;
        const p = getMainDrawParams();
        if (p) {
            const margin = 20;
            mainX = clamp(mainX, p.w / 2 - margin, W - p.w / 2 + margin);
            mainY = clamp(mainY, p.h / 2 - margin, H - p.h / 2 + margin);
        }
        render();
        if (e.preventDefault) e.preventDefault();
    }

    function onDragEnd(e) {
        if (isDragging) {
            isDragging = false;
            canvas.style.cursor = 'grab';
            render();
        }
    }

    canvas.addEventListener('mousedown', onDragStart);
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd);

    canvas.addEventListener('touchstart', onDragStart, { passive: false });
    window.addEventListener('touchmove', onDragMove, { passive: false });
    window.addEventListener('touchend', onDragEnd, { passive: false });
    window.addEventListener('touchcancel', onDragEnd, { passive: false });

    // ===== คีย์บอร์ด =====
    window.addEventListener('keydown', function(e) {
        if (!mainImage) return;
        const step = e.shiftKey ? 20 : 4;
        let dx = 0,
            dy = 0;
        if (e.key === 'ArrowLeft') dx = -step;
        else if (e.key === 'ArrowRight') dx = step;
        else if (e.key === 'ArrowUp') dy = -step;
        else if (e.key === 'ArrowDown') dy = step;
        else return;
        e.preventDefault();
        mainX += dx;
        mainY += dy;
        const p = getMainDrawParams();
        if (p) {
            const margin = 10;
            mainX = clamp(mainX, p.w / 2 - margin, W - p.w / 2 + margin);
            mainY = clamp(mainY, p.h / 2 - margin, H - p.h / 2 + margin);
        }
        render();
    });

    // ============================================================
    //  🧠 ฟังก์ชันลบพื้นหลัง (AI)
    // ============================================================

    const removeBgBtn = document.getElementById('removeBgBtn');
    const progressContainer = document.getElementById('progressContainer');
    const progressFill = document.getElementById('progressFill');

    function refineEdges(imageData, radius = 2) {
        const data = imageData.data;
        const w = imageData.width,
            h = imageData.height;
        const total = w * h;
        const alpha = new Float32Array(total);
        for (let i = 0; i < total; i++) alpha[i] = data[i * 4 + 3] / 255;

        const size = Math.ceil(radius * 3);
        const kernel = [];
        let sum = 0;
        for (let i = -size; i <= size; i++) {
            const v = Math.exp(-(i * i) / (2 * radius * radius));
            kernel.push(v);
            sum += v;
        }
        for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;

        const temp = new Float32Array(total);
        const half = size;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let val = 0;
                const row = y * w;
                for (let k = 0; k < kernel.length; k++) {
                    const kx = Math.min(w - 1, Math.max(0, x + (k - half)));
                    val += alpha[row + kx] * kernel[k];
                }
                temp[row + x] = val;
            }
        }
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let val = 0;
                for (let k = 0; k < kernel.length; k++) {
                    const ky = Math.min(h - 1, Math.max(0, y + (k - half)));
                    val += temp[ky * w + x] * kernel[k];
                }
                const idx = (y * w + x) * 4;
                const orig = alpha[y * w + x];
                if (orig > 0.05 && orig < 0.95) {
                    data[idx + 3] = Math.round(Math.min(1, Math.max(0, val)) * 255);
                }
            }
        }
        return imageData;
    }

    async function removeBackgroundFromMain() {
        if (!mainImage) {
            alert('⚠️ กรุณาอัปโหลดรูปหลักก่อน');
            return;
        }

        removeBgBtn.disabled = true;
        removeBgBtn.textContent = '⏳ กำลังโหลด...';
        progressContainer.style.display = 'block';
        progressFill.style.width = '0%';

        try {
            const srcCanvas = document.createElement('canvas');
            srcCanvas.width = mainImage.width;
            srcCanvas.height = mainImage.height;
            const srcCtx = srcCanvas.getContext('2d');
            srcCtx.drawImage(mainImage, 0, 0);

            const maxSize = 512;
            let w = srcCanvas.width,
                h = srcCanvas.height;
            if (w > maxSize || h > maxSize) {
                const ratio = Math.min(maxSize / w, maxSize / h);
                w = Math.round(w * ratio);
                h = Math.round(h * ratio);
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = w;
                tempCanvas.height = h;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.drawImage(srcCanvas, 0, 0, w, h);
                srcCanvas.width = w;
                srcCanvas.height = h;
                srcCtx.drawImage(tempCanvas, 0, 0);
            }

            const blob = await new Promise(res => srcCanvas.toBlob(res, 'image/png'));

            const module = await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal/+esm');
            const removeFn = module.removeBackground;

            const resultBlob = await removeFn(blob, {
                cache: true,
                model: 'small',
                output: { format: 'image/png' },
                progress: (p) => {
                    const percent = Math.min(100, p * 100);
                    progressFill.style.width = percent + '%';
                }
            });

            const img = new Image();
            const url = URL.createObjectURL(resultBlob);
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = url;
            });

            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = mainImage.width;
            finalCanvas.height = mainImage.height;
            const finalCtx = finalCanvas.getContext('2d');
            finalCtx.drawImage(img, 0, 0, finalCanvas.width, finalCanvas.height);
            let resultData = finalCtx.getImageData(0, 0, finalCanvas.width, finalCanvas.height);

            // ✅ ปรับขอบให้เนียนขึ้น
            resultData = refineEdges(resultData, 1.5);
            finalCtx.putImageData(resultData, 0, 0);

            const newMainImage = new Image();
            newMainImage.src = finalCanvas.toDataURL('image/png');
            await new Promise(resolve => newMainImage.onload = resolve);

            mainImage = newMainImage;
            mainHasAlpha = true;               // ← ตั้งค่าสถานะว่ามีอัลฟา
            mainX = canvas.width / 2;
            mainY = canvas.height / 2;
            render();

            progressFill.style.width = '100%';
            setTimeout(() => {
                progressContainer.style.display = 'none';
                progressFill.style.width = '0%';
            }, 600);
            removeBgBtn.textContent = '✨ ลบพื้นหลัง (AI)';
            URL.revokeObjectURL(url);

        } catch (error) {
            console.error('❌ ลบพื้นหลังล้มเหลว:', error);
            alert('เกิดข้อผิดพลาด: ' + error.message);
            progressContainer.style.display = 'none';
            progressFill.style.width = '0%';
            removeBgBtn.textContent = '✨ ลบพื้นหลัง (AI)';
        } finally {
            removeBgBtn.disabled = false;
        }
    }

    if (removeBgBtn) {
        removeBgBtn.addEventListener('click', removeBackgroundFromMain);
    }

    document.addEventListener('keydown', function(e) {
        if (e.key === '1' && !e.repeat) {
            const tag = e.target.tagName.toLowerCase();
            if (tag === 'input' || tag === 'textarea') return;
            if (removeBgBtn && !removeBgBtn.disabled) {
                removeBackgroundFromMain();
                e.preventDefault();
            }
        }
    });

    // ============================================================
    //  🖼️ รูปตัวอย่างพื้นหลัง 5 รูป (ใช้รูปจากลิงก์ของคุณ)
    // ============================================================

    const SAMPLE_IMAGES = [
        { name: 'ห้องสมุด', url: 'https://od.lk/s/N18yODQ0OTcxOTdf/789.jpg' },
        { name: 'เรือนไทย', url: 'https://od.lk/s/N18yODQzMzIwNzdf/6db9d034-1022-40c3-b023-a0749ab58b01.png' },
        { name: 'Trojan', url: 'https://od.lk/s/N18yODU4NTIyNDdf/Untitled-3.jpg' },
        { name: 'อยุธยา', url: 'https://od.lk/s/N18yODU5NjQyMTlf/SMART_SHARPEN_PRO.png' },
        { name: 'ห้อง', url: 'https://od.lk/s/N18yODU5NjQyMTBf/ChatGPT%20Image%2028%20%E0%B8%9E.%E0%B8%84.%202569%2013_32_17.png' }
    ];

    const sampleGrid = document.getElementById('sampleGrid');
    const bgImageInput = document.getElementById('bgImage');

    SAMPLE_IMAGES.forEach((imgData) => {
        const thumb = document.createElement('img');
        thumb.src = imgData.url;
        thumb.alt = imgData.name;
        thumb.title = imgData.name;
        thumb.className = 'sample-thumb';
        thumb.loading = 'lazy';
        thumb.crossOrigin = 'anonymous';

        thumb.classList.add('loading');
        thumb.addEventListener('load', function() {
            this.classList.remove('loading');
        });
        thumb.addEventListener('error', function() {
            this.classList.remove('loading');
            this.style.background = '#2f3d52';
            this.alt = '❌';
        });

        thumb.addEventListener('click', function(e) {
            e.stopPropagation();

            document.querySelectorAll('.sample-thumb').forEach(el => el.classList.remove('active'));
            this.classList.add('active');

            const fullImg = new Image();
            fullImg.crossOrigin = 'anonymous';
            fullImg.onload = function() {
                window.bgImage = fullImg;
                bgFileName.textContent = '📷 ' + imgData.name + '.jpg';
                bgImageInput.value = '';
                render();
            };
            fullImg.onerror = function() {
                alert('❌ โหลดรูปตัวอย่างไม่สำเร็จ – ตรวจสอบ URL หรืออินเทอร์เน็ต');
                this.classList.remove('active');
            };
            fullImg.src = imgData.url;
        });

        sampleGrid.appendChild(thumb);
    });

    // ============================================================
    //  เริ่มต้น
    // ============================================================
    dimDisplay.textContent = W + ' × ' + H;
    colorHex.textContent = colorInput.value;
    render();

    console.log('✅ โปรแกรมพร้อมใช้งาน (กด 1 เพื่อลบพื้นหลัง)');

    window.render = render;
    window.bgImage = bgImage;
    Object.defineProperty(window, 'bgImage', {
        get: function() { return bgImage; },
        set: function(val) { bgImage = val; }
    });
    window.mainImage = mainImage;
    Object.defineProperty(window, 'mainImage', {
        get: function() { return mainImage; },
        set: function(val) { mainImage = val; }
    });
    window.refineEdges = refineEdges;
    window.removeBackgroundFromMain = removeBackgroundFromMain;

});
