// Génère les vidéos MP4 et leurs affiches à partir de scenes.html.
// Usage : node tools/wifi-videos/render.js [--voice <dossier>] [id ...]
//         node tools/wifi-videos/render.js --stills <dossier>   (images de contrôle, sans vidéo)
// --voice : dossier produit par voice.py (WAV + timings.json). Les scènes sont allongées
// pour laisser finir chaque phrase, et la voix off est ajoutée à la vidéo.
// Nécessite Playwright (Chromium) et ffmpeg.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const FPS = 25;
const OUT = path.join(__dirname, '..', '..', 'wifi-zone', 'videos');
const POSTER_AT = { principe: 24, connexion: 20, installation: 14, gestion: 12 };
const LEAD = 0.4;   // silence avant chaque phrase (s)
const TAIL = 0.8;   // pause après chaque phrase avant la scène suivante (s)

function option(args, name) {
    const i = args.indexOf(name);
    return i >= 0 ? args.splice(i, 2)[1] : null;
}

function run(cmd, args) {
    return new Promise((res, rej) => {
        const p = spawn(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'] });
        p.on('close', c => c === 0 ? res() : rej(new Error(`${cmd} ${c}`)));
    });
}

// Place chaque phrase au début de sa scène et produit une piste AAC
async function buildVoiceTrack(voiceDir, id, starts, total, file) {
    const inputs = [], filters = [];
    starts.forEach(([name, at], i) => {
        inputs.push('-i', path.join(voiceDir, id, `${name}.wav`));
        const ms = Math.round((at + LEAD) * 1000);
        filters.push(`[${i}]adelay=${ms}:all=1[a${i}]`);
    });
    const mix = starts.map((_, i) => `[a${i}]`).join('') +
        `amix=inputs=${starts.length}:normalize=0,apad,atrim=0:${total.toFixed(3)},loudnorm=I=-16:TP=-1.5[out]`;
    await run('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', [...filters, mix].join(';'),
        '-map', '[out]', '-ac', '1', '-ar', '44100', '-c:a', 'aac', '-b:a', '48k', file]);
}

async function main() {
    const args = process.argv.slice(2);
    const stillsDir = option(args, '--stills');
    const voiceDir = option(args, '--voice');
    const timings = voiceDir ? JSON.parse(fs.readFileSync(path.join(voiceDir, 'timings.json'), 'utf8')) : {};

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
        // Allonge les scènes pour que la voix off tienne, et note le début de chaque phrase
        const starts = await page.evaluate(([id, tm, LEAD, TAIL]) => {
            const v = VIDEOS[id];
            if (!tm) return [];
            const fit = (base, speech) => Math.max(base, LEAD + speech + TAIL);
            v.titleD = fit(TITLE_D, tm.intro);
            v.scenes.forEach((sc, i) => { sc.d = fit(sc.d, tm[`scene-${i + 1}`]); });
            v.endD = fit(END_D, tm.outro + 0.6);
            const out = [['intro', 0]];
            let acc = v.titleD;
            v.scenes.forEach((sc, i) => { out.push([`scene-${i + 1}`, acc]); acc += sc.d; });
            out.push(['outro', acc]);
            return out;
        }, [id, timings[id], LEAD, TAIL]);

        const d = await page.evaluate(id => duration(VIDEOS[id]), id);
        const frames = Math.ceil(d * FPS);
        const file = path.join(OUT, `${id}.mp4`);
        const audio = starts.length ? file.replace(/\.mp4$/, '.voix.m4a') : null;
        if (audio) await buildVoiceTrack(voiceDir, id, starts, frames / FPS, audio);

        const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
            ...(audio ? ['-i', audio, '-map', '0:v', '-map', '1:a', '-c:a', 'copy', '-shortest'] : []),
            '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-crf', '27', '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] });
        for (let i = 0; i < frames; i++) {
            const buf = await grab(id, i / FPS);
            if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
        }
        ff.stdin.end();
        await new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg ' + c))));
        if (audio) fs.unlinkSync(audio);
        fs.writeFileSync(path.join(OUT, `${id}.jpg`), await grab(id, POSTER_AT[id] || 10));
        console.log(`${id}.mp4 : ${d.toFixed(1)} s, ${(fs.statSync(file).size / 1e6).toFixed(2)} Mo${audio ? ', avec voix off' : ''}`);
    }
    await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
