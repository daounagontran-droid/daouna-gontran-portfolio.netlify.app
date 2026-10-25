// Génère les vidéos MP4 et leurs affiches à partir de scenes.html.
// Usage : node tools/wifi-videos/render.js [id ...]
//         node tools/wifi-videos/render.js --stills <dossier>   (images de contrôle, sans vidéo)
// Nécessite Playwright (Chromium) et ffmpeg.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const FPS = 25;
const OUT = path.join(__dirname, '..', '..', 'wifi-zone', 'videos');
const POSTER_AT = { principe: 24, connexion: 20, installation: 14, gestion: 12 };

async function main() {
    const args = process.argv.slice(2);
    const stillsIdx = args.indexOf('--stills');
    const stillsDir = stillsIdx >= 0 ? args.splice(stillsIdx, 2)[1] : null;

    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    await page.goto('file://' + path.join(__dirname, 'scenes.html'));
    await page.evaluate(async () => {
        const faces = ['300 20px Inter', '400 20px Inter', '500 20px Inter', '600 20px Inter', '700 20px Inter', '800 20px Inter',
            '800 20px "Inter Display"', '500 20px "JetBrains Mono"', '700 20px "JetBrains Mono"'];
        await Promise.all(faces.map(f => document.fonts.load(f)));
    });

    const ids = args.length ? args : await page.evaluate(() => Object.keys(VIDEOS));
    const grab = async (id, t, type = 'image/jpeg') => {
        const url = await page.evaluate(([id, t, type]) => { renderFrame(id, t); return document.getElementById('c').toDataURL(type, 0.95); }, [id, t, type]);
        return Buffer.from(url.split(',')[1], 'base64');
    };

    if (stillsDir) {
        fs.mkdirSync(stillsDir, { recursive: true });
        for (const id of ids) {
            const d = await page.evaluate(id => duration(VIDEOS[id]), id);
            for (let t = 1; t < d; t += 2.5) fs.writeFileSync(path.join(stillsDir, `${id}-${t.toFixed(1)}.jpg`), await grab(id, t));
        }
        await browser.close();
        return;
    }

    fs.mkdirSync(OUT, { recursive: true });
    for (const id of ids) {
        const d = await page.evaluate(id => duration(VIDEOS[id]), id);
        const frames = Math.ceil(d * FPS);
        const file = path.join(OUT, `${id}.mp4`);
        const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
            '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-crf', '27', '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] });
        for (let i = 0; i < frames; i++) {
            const buf = await grab(id, i / FPS);
            if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
        }
        ff.stdin.end();
        await new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg ' + c))));
        fs.writeFileSync(path.join(OUT, `${id}.jpg`), await grab(id, POSTER_AT[id] || 10));
        console.log(`${id}.mp4 : ${d.toFixed(1)} s, ${(fs.statSync(file).size / 1e6).toFixed(2)} Mo`);
    }
    await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
