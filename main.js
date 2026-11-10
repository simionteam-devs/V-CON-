import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import './style.css';

const $ = (s) => document.querySelector(s);
const app = $('#app');

app.innerHTML = `
  <main class="shell">
    <header class="topbar">
      <div class="brand"><div class="brand-mark">V</div><div><b>V-CON</b><small>VIDEO CONVERTER</small></div></div>
      <span class="privacy"><i></i> ON-DEVICE</span>
    </header>

    <section class="hero">
      <div class="eyebrow">SIMPLE · PRIVATE · POWERFUL</div>
      <h1>Convert videos.<br><span>Your way.</span></h1>
      <p>Change formats and export a video directly on your device. Your files are not uploaded.</p>
    </section>

    <section class="panel">
      <div class="section-title"><span class="step">01</span><div><b>Select a video</b><small>Choose a file from your device</small></div></div>
      <label class="dropzone" for="file">
        <div class="upload-icon">↑</div>
        <b>Tap to choose video</b>
        <span>MP4, MOV, MKV, AVI, WebM and more</span>
        <input id="file" type="file" accept="video/*,.mkv,.avi,.webm,.mov,.mp4" />
      </label>
      <div id="fileInfo" class="file-info hidden"></div>
    </section>

    <section class="panel">
      <div class="section-title"><span class="step">02</span><div><b>Output settings</b><small>Choose your preferred format and quality</small></div></div>
      <label class="field-label" for="format">Convert to</label>
      <select id="format">
        <option value="mp4">MP4 — Best compatibility</option>
        <option value="webm">WebM — Web-friendly</option>
        <option value="mkv">MKV — Flexible container</option>
        <option value="mov">MOV — Editing workflow</option>
        <option value="avi">AVI — Legacy compatibility</option>
        <option value="gif">GIF — Animated image (no audio)</option>
      </select>
      <label class="field-label" for="resolution">Resolution</label>
      <select id="resolution">
        <option value="original">Original</option>
        <option value="1080">1080p</option>
        <option value="720">720p</option>
        <option value="480">480p</option>
      </select>
      <label class="field-label" for="quality">Quality</label>
      <select id="quality">
        <option value="high">High quality</option>
        <option value="balanced" selected>Balanced</option>
        <option value="small">Smaller file</option>
      </select>
      <button id="convert" class="primary" disabled><span>⇄</span> Convert video</button>
      <div id="progressWrap" class="progress-wrap hidden">
        <div class="progress-head"><span id="status">Preparing…</span><b id="percent">0%</b></div>
        <div class="track"><div id="bar"></div></div>
      </div>
      <div id="message" class="message" role="status"></div>
      <a id="download" class="download hidden" download>↓ Download converted video</a>
    </section>
    <footer><span>V-CON v1.0</span><span>Files stay on your device</span></footer>
  </main>
`;

let selectedFile = null;
let ffmpeg = null;
let loaded = false;
let outputUrl = null;

const formatNames = { mp4:'MP4', webm:'WebM', mkv:'MKV', mov:'MOV', avi:'AVI', gif:'GIF' };
const sizeText = (n) => n < 1024**2 ? `${(n/1024).toFixed(0)} KB` : `${(n/1024**2).toFixed(1)} MB`;

$('#file').addEventListener('change', (e) => {
  selectedFile = e.target.files?.[0] || null;
  $('#download').classList.add('hidden');
  if (!selectedFile) {
    $('#fileInfo').classList.add('hidden');
    $('#convert').disabled = true;
    return;
  }
  $('#fileInfo').classList.remove('hidden');
  $('#fileInfo').innerHTML = `<span class="file-badge">VID</span><div><b>${escapeHtml(selectedFile.name)}</b><small>${sizeText(selectedFile.size)}</small></div><span class="check">✓</span>`;
  $('#convert').disabled = false;
  $('#message').textContent = '';
});

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

async function loadEngine() {
  if (loaded) return;
  $('#status').textContent = 'Loading conversion engine…';
  const base = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';
  ffmpeg = new FFmpeg();
  ffmpeg.on('progress', ({ progress }) => {
    const p = Math.max(0, Math.min(99, Math.round(progress * 100)));
    $('#bar').style.width = `${p}%`;
    $('#percent').textContent = `${p}%`;
    $('#status').textContent = 'Converting video…';
  });
  await ffmpeg.load({
    coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm')
  });
  loaded = true;
}

$('#convert').addEventListener('click', async () => {
  if (!selectedFile) return;
  const button = $('#convert');
  button.disabled = true;
  $('#download').classList.add('hidden');
  $('#progressWrap').classList.remove('hidden');
  $('#message').textContent = '';
  $('#bar').style.width = '0%';
  $('#percent').textContent = '0%';
  let inputName = `input.${(selectedFile.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g,'')}`;
  const fmt = $('#format').value;
  const outputName = `vcon-output.${fmt}`;
  try {
    await loadEngine();
    $('#status').textContent = 'Reading video…';
    await ffmpeg.writeFile(inputName, await fetchFile(selectedFile));

    const args = ['-i', inputName];
    const resolution = $('#resolution').value;
    if (resolution !== 'original') args.push('-vf', `scale=-2:${resolution}`);
    const quality = $('#quality').value;
    if (fmt === 'gif') {
      args.push('-an', '-vf', resolution === 'original' ? 'fps=12,scale=480:-1:flags=lanczos' : `fps=12,scale=-2:${Math.min(Number(resolution),480)}:flags=lanczos`);
    } else if (fmt === 'mp4' || fmt === 'mov') {
      args.push('-c:v','libx264','-preset','ultrafast','-crf', quality === 'high' ? '18' : quality === 'small' ? '28' : '23', '-c:a','aac');
    } else if (fmt === 'webm') {
      args.push('-c:v','libvpx','-crf', quality === 'high' ? '10' : quality === 'small' ? '35' : '25','-b:v','0','-c:a','libvorbis');
    } else if (fmt === 'mkv') {
      args.push('-c:v','libx264','-preset','ultrafast','-crf', quality === 'high' ? '18' : quality === 'small' ? '28' : '23','-c:a','aac');
    } else if (fmt === 'avi') {
      args.push('-c:v','mpeg4','-q:v', quality === 'high' ? '2' : quality === 'small' ? '6' : '4','-c:a','libmp3lame');
    }
    args.push(outputName);
    await ffmpeg.exec(args);
    const data = await ffmpeg.readFile(outputName);
    const mime = fmt === 'gif' ? 'image/gif' : fmt === 'webm' ? 'video/webm' : fmt === 'mov' ? 'video/quicktime' : fmt === 'avi' ? 'video/x-msvideo' : fmt === 'mkv' ? 'video/x-matroska' : 'video/mp4';
    const blob = new Blob([data.buffer], { type: mime });
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    outputUrl = URL.createObjectURL(blob);
    $('#download').href = outputUrl;
    $('#download').download = outputName;
    $('#download').classList.remove('hidden');
    $('#bar').style.width = '100%';
    $('#percent').textContent = '100%';
    $('#status').textContent = 'Conversion complete';
    $('#message').textContent = `Done. Output size: ${sizeText(blob.size)}.`;
  } catch (err) {
    console.error(err);
    $('#status').textContent = 'Conversion failed';
    $('#message').textContent =
  'Conversion failed: ' + (err?.message || String(err));
  } finally {
    button.disabled = false;
    try { await ffmpeg?.deleteFile(inputName); await ffmpeg?.deleteFile(outputName); } catch {}
  }
});
