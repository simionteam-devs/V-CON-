
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import './style.css';

const $ = (selector) => document.querySelector(selector);
const app = $('#app');

app.innerHTML = `
<main class="shell">
  <header class="topbar">
    <div class="brand">
      <div class="brand-mark">V</div>
      <div><b>V-CON</b><small>VIDEO CONVERTER</small></div>
    </div>
    <span class="privacy"><i></i> ON-DEVICE</span>
  </header>

  <section class="hero">
    <div class="eyebrow">SIMPLE · PRIVATE · POWERFUL</div>
    <h1>Convert videos.<br><span>Your way.</span></h1>
    <p>Convert videos directly on your device. Your files are not uploaded.</p>
  </section>

  <section class="panel">
    <div class="section-title">
      <span class="step">01</span>
      <div><b>Select a video</b><small>Choose a file from your device</small></div>
    </div>
    <label class="dropzone" for="file">
      <div class="upload-icon">↑</div>
      <b>Tap to choose video</b>
      <span>MP4, MOV, MKV, AVI, WebM and more</span>
      <input id="file" type="file" accept="video/*,.mkv,.avi,.webm,.mov,.mp4" />
    </label>
    <div id="fileInfo" class="file-info hidden"></div>
  </section>

  <section class="panel">
    <div class="section-title">
      <span class="step">02</span>
      <div><b>Output settings</b><small>Choose your preferred format and quality</small></div>
    </div>

    <label class="field-label" for="format">Convert to</label>
    <select id="format">
      <option value="mp4">MP4 — Best compatibility</option>
      <option value="webm">WebM</option>
      <option value="mkv">MKV</option>
      <option value="mov">MOV</option>
      <option value="avi">AVI</option>
      <option value="gif">GIF</option>
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

    <button id="convert" class="primary" disabled>
      ⇄ Convert video
    </button>

    <div id="progressWrap" class="progress-wrap hidden">
      <div class="progress-head">
        <span id="status">Preparing...</span>
        <b id="percent">0%</b>
      </div>
      <div class="track"><div id="bar"></div></div>
    </div>

    <div id="message" class="message" role="status"></div>
    <a id="download" class="download hidden" download>
      ↓ Download converted video
    </a>
  </section>

  <footer>
    <span>V-CON v1.0</span>
    <span>Files stay on your device</span>
  </footer>
</main>
`;

let selectedFile = null;
let ffmpeg = null;
let loaded = false;
let outputUrl = null;

const sizeText = (bytes) => {
  if (!Number.isFinite(bytes) || bytes < 0) return 'Unknown size';
  return bytes < 1024 ** 2
    ? `${(bytes / 1024).toFixed(0)} KB`
    : `${(bytes / 1024 ** 2).toFixed(1)} MB`;
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function setMessage(message, isError = false) {
  $('#message').textContent = message;
  $('#message').classList.toggle('error', isError);
}

function safeExtension(filename) {
  const extension = (filename.split('.').pop() || 'mp4')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
  return extension || 'mp4';
}

$('#file').addEventListener('change', (event) => {
  selectedFile = event.target.files?.[0] || null;

  $('#download').classList.add('hidden');

  if (outputUrl) {
    URL.revokeObjectURL(outputUrl);
    outputUrl = null;
  }

  if (!selectedFile) {
    $('#fileInfo').classList.add('hidden');
    $('#convert').disabled = true;
    setMessage('');
    return;
  }

  $('#fileInfo').classList.remove('hidden');
  $('#fileInfo').innerHTML = `
    <span class="file-badge">VID</span>
    <div>
      <b>${escapeHtml(selectedFile.name)}</b>
      <small>${sizeText(selectedFile.size)}</small>
    </div>
    <span class="check">✓</span>
  `;

  $('#convert').disabled = false;
  setMessage('');
});

async function loadEngine() {
  if (loaded && ffmpeg) return;

  $('#status').textContent = 'Loading conversion engine...';

  const base = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';

  ffmpeg = new FFmpeg();

  ffmpeg.on('progress', ({ progress }) => {
    const percent = Math.max(
      0,
      Math.min(99, Math.round(progress * 100))
    );

    $('#bar').style.width = `${percent}%`;
    $('#percent').textContent = `${percent}%`;
    $('#status').textContent = 'Converting video...';
  });

  await ffmpeg.load({
    coreURL: await toBlobURL(
      `${base}/ffmpeg-core.js`,
      'text/javascript'
    ),
    wasmURL: await toBlobURL(
      `${base}/ffmpeg-core.wasm`,
      'application/wasm'
    )
  });

  loaded = true;
}

$('#convert').addEventListener('click', async () => {
  if (!selectedFile) {
    setMessage('Please select a video first.', true);
    return;
  }

  const button = $('#convert');
  button.disabled = true;

  $('#download').classList.add('hidden');
  $('#progressWrap').classList.remove('hidden');
  $('#bar').style.width = '0%';
  $('#percent').textContent = '0%';
  setMessage('');

  const inputName = `vcon-input.${safeExtension(selectedFile.name)}`;
  const format = $('#format').value;
  const outputName = `vcon-output.${format}`;

  try {
    if (!selectedFile.size) {
      throw new Error('Selected video is empty. Please choose it again.');
    }

    await loadEngine();

    $('#status').textContent = 'Reading video...';

    // Read the Android-selected file directly.
    const inputBuffer = await selectedFile.arrayBuffer();
    const inputData = new Uint8Array(inputBuffer);

    if (!inputData.byteLength) {
      throw new Error('Could not read video data. Select the file again.');
    }

    await ffmpeg.writeFile(inputName, inputData);

    const args = ['-i', inputName];

    const resolution = $('#resolution').value;
    const quality = $('#quality').value;

    if (format === 'gif') {
      const gifHeight = resolution === 'original'
        ? 480
        : Math.min(Number(resolution), 480);

      args.push(
        '-an',
        '-vf',
        `fps=12,scale=-2:${gifHeight}:flags=lanczos`
      );
    } else {
      if (resolution !== 'original') {
        args.push('-vf', `scale=-2:${resolution}`);
      }

      const crf = quality === 'high'
        ? '18'
        : quality === 'small' ? '28' : '23';

      if (['mp4', 'mov', 'mkv'].includes(format)) {
        args.push(
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-crf', crf,
          '-c:a', 'aac'
        );
      } else if (format === 'webm') {
        args.push(
          '-c:v', 'libvpx',
          '-crf', quality === 'high' ? '10' : quality === 'small' ? '35' : '25',
          '-b:v', '0',
          '-c:a', 'libvorbis'
        );
      } else if (format === 'avi') {
        args.push(
          '-c:v', 'mpeg4',
          '-q:v', quality === 'high' ? '2' : quality === 'small' ? '6' : '4',
          '-c:a', 'libmp3lame'
        );
      }
    }

    args.push(outputName);

    $('#status').textContent = 'Converting video...';

    await ffmpeg.exec(args);

    $('#status').textContent = 'Preparing download...';

    const outputData = await ffmpeg.readFile(outputName);
    const outputBytes = outputData instanceof Uint8Array
      ? outputData
      : new Uint8Array(outputData);

    if (!outputBytes.byteLength) {
      throw new Error('Conversion produced an empty output.');
    }

    const mimeType = format === 'gif'
      ? 'image/gif'
      : format === 'webm'
        ? 'video/webm'
        : format === 'mov'
          ? 'video/quicktime'
          : format === 'avi'
            ? 'video/x-msvideo'
            : format === 'mkv'
              ? 'video/x-matroska'
              : 'video/mp4';

    const outputBlob = new Blob([outputBytes], {
      type: mimeType
    });

    if (outputUrl) URL.revokeObjectURL(outputUrl);

    outputUrl = URL.createObjectURL(outputBlob);

    const downloadLink = $('#download');

    downloadLink.href = outputUrl;
    downloadLink.download = outputName;
    downloadLink.classList.remove('hidden');

    $('#bar').style.width = '100%';
    $('#percent').textContent = '100%';
    $('#status').textContent = 'Conversion complete';

    setMessage(`Done. Output size: ${sizeText(outputBlob.size)}.`);

  } catch (error) {
    console.error('V-CON conversion error:', error);

    $('#status').textContent = 'Conversion failed';

    setMessage(
      `Conversion failed: ${error?.message || String(error)}`,
      true
    );

  } finally {
    button.disabled = false;

    try {
      if (ffmpeg) {
        await ffmpeg.deleteFile(inputName);
        await ffmpeg.deleteFile(outputName);
      }
    } catch (error) {
      console.warn('Temporary file cleanup:', error);
    }
  }
});

// Convert Blob into Base64 for Capacitor Filesystem.
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(String(reader.result).split(',')[1]);
    };

    reader.onerror = () => {
      reject(reader.error || new Error('Could not read output.'));
    };

    reader.readAsDataURL(blob);
  });
}

// Save and share converted video.
$('#download').addEventListener('click', async (event) => {
  event.preventDefault();

  if (!outputUrl) {
    setMessage('There is no converted video to save.', true);
    return;
  }

  const link = $('#download');
  link.style.pointerEvents = 'none';

  try {
    const filename = link.download || 'vcon-output.mp4';

    const response = await fetch(outputUrl);

    if (!response.ok) {
      throw new Error('Could not access converted video.');
    }

    const blob = await response.blob();
    const base64 = await blobToBase64(blob);

    const savedFile = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Documents,
      recursive: true
    });

    setMessage(`Saved successfully: ${filename}`);

    await Share.share({
      title: filename,
      text: 'Converted using V-CON',
      url: savedFile.uri,
      dialogTitle: 'Save or share your video'
    });

  } catch (error) {
    console.error('V-CON save error:', error);

    setMessage(
      `Save failed: ${error?.message || String(error)}`,
      true
    );

  } finally {
    link.style.pointerEvents = '';
  }
});
