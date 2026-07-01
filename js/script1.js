/**
 * script1.js
 * - เพิ่มโลโก้ (11.png) ไว้ใต้ปุ่ม "✨ ลบพื้นหลัง"
 * - ไม่มีฟังก์ชันลากการ์ด (ลบออกทั้งหมด)
 * ใช้ได้โดยไม่ต้องแก้ไข HTML หลัก
 */

(function() {
    'use strict';

    // ─── เพิ่ม CSS ที่จำเป็น ──────────────────────────────
    const style = document.createElement('style');
    style.textContent = `
        .logo-icon {
            width: 80px;
            height: 80px;
            object-fit: contain;
            border-radius: 8px;
            flex-shrink: 0;
            background: rgba(255, 255, 255, 0.05);
            padding: 4px;
            transition: transform 0.2s;
            display: block;
            margin: 0 auto;
        }
        .logo-icon:hover {
            transform: scale(1.05);
        }
        .logo-container {
            display: flex;
            justify-content: center;
            margin-top: 12px;
            padding-top: 12px;
            border-top: 1px solid #26303d;
        }
        @media (max-width: 600px) {
            .logo-icon {
                width: 48px;
                height: 48px;
            }
        }
    `;
    document.head.appendChild(style);

    // ─── รอให้ DOM พร้อม ──────────────────────────────────
    function init() {
        const controls = document.querySelector('.controls');
        if (!controls) {
            setTimeout(init, 100);
            return;
        }

        // ─── เพิ่มโลโก้ไว้ใต้ปุ่มลบพื้นหลัง ──────────────
        // ตรวจสอบว่ามีโลโก้อยู่แล้วหรือไม่
        if (controls.querySelector('.logo-container')) {
            console.log('⚠️ โลโก้มีอยู่แล้ว');
            return;
        }

        // หากลุ่มที่มีปุ่มลบพื้นหลัง
        const removeBgGroup = controls.querySelector('.group:has(.btn-remove-bg)');
        if (removeBgGroup) {
            // สร้าง container สำหรับโลโก้
            const container = document.createElement('div');
            container.className = 'logo-container';

            const img = document.createElement('img');
            img.src = 'https://od.lk/s/N18yNzAwOTQ0NzNf/11.png';
            img.alt = '🎨 ตัวแก้ไขพื้นหลัง Logo';
            img.className = 'logo-icon';
            img.loading = 'lazy';

            container.appendChild(img);

            // แทรก container หลังจาก removeBgGroup
            removeBgGroup.parentNode.insertBefore(container, removeBgGroup.nextSibling);

            console.log('✅ เพิ่มโลโก้ใต้ปุ่มลบพื้นหลังเรียบร้อย');
        } else {
            console.warn('⚠️ ไม่พบกลุ่มปุ่มลบพื้นหลัง');
        }
    }

    // ─── เริ่มต้น ──────────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();