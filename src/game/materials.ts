import * as THREE from 'three';

export function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

/**
 * Generates a tileable tangent-space normal map for realistic micro-grain asphalt & concrete PBR detail.
 */
export function createAsphaltNormalTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const d = img.data;

  // Deterministic pseudo-noise heightfield -> Sobel normal
  const h = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
    h[i] = s - Math.floor(s);
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;
      const ym = (y - 1 + size) % size;
      const yp = (y + 1) % size;

      const dx = (h[y * size + xp] - h[y * size + xm]) * 1.6;
      const dy = (h[yp * size + x] - h[ym * size + x]) * 1.6;
      const nz = 1.0;
      const len = Math.hypot(dx, dy, nz);

      const idx = (y * size + x) * 4;
      d[idx] = Math.floor(((dx / len) * 0.5 + 0.5) * 255);
      d[idx + 1] = Math.floor(((dy / len) * 0.5 + 0.5) * 255);
      d[idx + 2] = Math.floor(((nz / len) * 0.5 + 0.5) * 255);
      d[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Generates a tileable wave normal map for shimmering Pacific Ocean water reflections.
 */
export function createWaterNormalTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const d = img.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * Math.PI * 2;
      const v = (y / size) * Math.PI * 2;
      const nx =
        Math.cos(u * 4 + v * 2) * 0.25 +
        Math.cos(u * 7 - v * 5) * 0.15;
      const ny =
        Math.sin(v * 4 + u * 2) * 0.25 +
        Math.sin(v * 6 + u * 3) * 0.15;
      const nz = 1.0;
      const len = Math.hypot(nx, ny, nz);

      const idx = (y * size + x) * 4;
      d[idx] = Math.floor(((nx / len) * 0.5 + 0.5) * 255);
      d[idx + 1] = Math.floor(((ny / len) * 0.5 + 0.5) * 255);
      d[idx + 2] = Math.floor(((nz / len) * 0.5 + 0.5) * 255);
      d[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(24, 36);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createRoadIntersectionTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Rich dark Los Santos sun-baked asphalt
  ctx.fillStyle = '#1b1f26';
  ctx.fillRect(0, 0, 1024, 1024);

  // Subtle tire-wear arc polish through the intersection box
  const centerGlow = ctx.createRadialGradient(512, 512, 60, 512, 512, 460);
  centerGlow.addColorStop(0, 'rgba(42, 48, 58, 0.55)');
  centerGlow.addColorStop(1, 'rgba(22, 26, 33, 0)');
  ctx.fillStyle = centerGlow;
  ctx.fillRect(0, 0, 1024, 1024);

  // High-frequency aggregate stone speckle
  for (let i = 0; i < 12000; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 1024;
    const v = 24 + Math.floor(Math.random() * 26);
    ctx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Cast-iron utility manhole cover in center-offset
  ctx.fillStyle = '#2d333d';
  ctx.beginPath();
  ctx.arc(468, 548, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#14171d';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Crisp continental zebra crosswalk bars on all 4 approaches
  ctx.fillStyle = '#e2e8f0';
  const stripeCount = 8;
  for (let i = 0; i < stripeCount; i++) {
    const offset = 172 + i * 92;
    ctx.fillRect(offset, 34, 46, 104);
    ctx.fillRect(offset, 886, 46, 104);
    ctx.fillRect(34, offset, 104, 46);
    ctx.fillRect(886, offset, 104, 46);
  }

  // Thick white thermoplastic stop bars
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(148, 152, 728, 12);
  ctx.fillRect(148, 860, 728, 12);
  ctx.fillRect(152, 148, 12, 728);
  ctx.fillRect(860, 148, 12, 728);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createStraightRoadTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1b1f26';
  ctx.fillRect(0, 0, 512, 1024);

  // Subtle dark wheel-track wear strips in left and right lanes
  ctx.fillStyle = 'rgba(12, 15, 20, 0.35)';
  ctx.fillRect(96, 0, 44, 1024);
  ctx.fillRect(168, 0, 44, 1024);
  ctx.fillRect(300, 0, 44, 1024);
  ctx.fillRect(372, 0, 44, 1024);

  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 1024;
    const v = 24 + Math.floor(Math.random() * 24);
    ctx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Crisp shoulder fog lines + gutter shadow
  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.fillRect(0, 0, 18, 1024);
  ctx.fillRect(494, 0, 18, 1024);

  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(24, 0, 8, 1024);
  ctx.fillRect(480, 0, 8, 1024);

  // Authentic California double-yellow centerline with reflective cat's-eye studs
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(246, 0, 7, 1024);
  ctx.fillRect(259, 0, 7, 1024);

  ctx.fillStyle = '#fef08a';
  for (let y = 32; y < 1024; y += 128) {
    ctx.fillRect(254, y, 4, 8);
  }

  // Crisp white dashed sub-lane dividers
  ctx.fillStyle = '#cbd5e1';
  for (let y = 28; y < 1024; y += 128) {
    ctx.fillRect(134, y, 6, 58);
    ctx.fillRect(372, y, 6, 58);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 2);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export interface FacadeMaterialMaps {
  map: THREE.CanvasTexture;
  emissiveMap: THREE.CanvasTexture;
}

export function createBuildingFacadeMaps(
  baseHex: string,
  glassTintHex: string,
  warmLitHex: string,
  maxAnisotropy: number,
  seed: number
): FacadeMaterialMaps {
  const w = 512;
  const h = 1024;
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = w;
  albedoCanvas.height = h;
  const ctx = albedoCanvas.getContext('2d')!;

  const emCanvas = document.createElement('canvas');
  emCanvas.width = w;
  emCanvas.height = h;
  const emCtx = emCanvas.getContext('2d')!;
  emCtx.fillStyle = '#000000';
  emCtx.fillRect(0, 0, w, h);

  // Architectural stone / anodized metal cladding
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, w, h);

  // Subtle vertical pilasters & spandrel shadow bands
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  for (let y = 0; y < h - 96; y += 64) {
    ctx.fillRect(0, y, w, 10);
  }
  for (let x = 0; x <= w; x += 85) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.fillRect(x, 0, 6, h - 96);
  }

  const cols = 6;
  const rows = 14;
  const padX = 14;
  const padY = 14;
  const cellW = w / cols;
  const cellH = (h - 110) / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const hash = Math.sin((r * 13 + c * 7 + seed * 19) * 12.9898) * 43758.5453;
      const rand = hash - Math.floor(hash);
      const isLit = rand > 0.56;

      const wx = c * cellW + padX * 0.5;
      const wy = 18 + r * cellH + padY * 0.5;
      const ww = cellW - padX;
      const wh = cellH - padY;

      // Sky-reflective gradient glass pane
      const grad = ctx.createLinearGradient(wx, wy, wx + ww, wy + wh);
      if (isLit) {
        grad.addColorStop(0, warmLitHex);
        grad.addColorStop(1, '#cbd5e1');
      } else {
        grad.addColorStop(0, glassTintHex);
        grad.addColorStop(0.55, '#0f172a');
        grad.addColorStop(1, '#1e293b');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(wx, wy, ww, wh);

      // Subtle interior blinds / mullion bar
      ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
      ctx.fillRect(wx, wy + wh * 0.48, ww, 2);

      if (isLit) {
        emCtx.fillStyle = warmLitHex;
        emCtx.fillRect(wx + 2, wy + 2, ww - 4, wh - 4);
      }
    }
  }

  // Luxury ground-level Los Santos retail storefront & lit display windows
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, h - 94, w, 94);

  const accentColors = ['#38bdf8', '#f59e0b', '#ec4899', '#10b981'];
  const neonColor = accentColors[Math.abs(seed) % accentColors.length];
  ctx.fillStyle = neonColor;
  ctx.fillRect(16, h - 88, w - 32, 6);
  emCtx.fillStyle = neonColor;
  emCtx.fillRect(16, h - 88, w - 32, 6);

  for (let s = 0; s < 3; s++) {
    const sx = 24 + s * 160;
    const shopGrad = ctx.createLinearGradient(sx, h - 72, sx, h - 10);
    shopGrad.addColorStop(0, '#fde68a');
    shopGrad.addColorStop(1, '#475569');
    ctx.fillStyle = shopGrad;
    ctx.fillRect(sx, h - 72, 136, 58);

    emCtx.fillStyle = '#fef3c7';
    emCtx.fillRect(sx + 4, h - 68, 128, 48);
  }

  const map = new THREE.CanvasTexture(albedoCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  const emissiveMap = new THREE.CanvasTexture(emCanvas);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  emissiveMap.anisotropy = maxAnisotropy;

  return { map, emissiveMap };
}

export function createSidewalkTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Warm California sun-bleached concrete & travertine pavers
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(0, 0, 512, 512);

  for (let py = 0; py < 512; py += 64) {
    for (let px = 0; px < 512; px += 64) {
      const shade = 196 + (((px * 7 + py * 13) % 5) - 2) * 5;
      ctx.fillStyle = `rgb(${shade},${shade + 2},${shade + 5})`;
      ctx.fillRect(px + 2, py + 2, 60, 60);
    }
  }

  // Fine expansion joints
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 512; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 5);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createSkyGradientTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, '#0c4a6e'); // Deep zenith azure
  grad.addColorStop(0.36, '#0284c7'); // Crisp California sky
  grad.addColorStop(0.5, '#bae6fd'); // Warm coastal horizon haze
  grad.addColorStop(0.54, '#fed7aa'); // Golden horizon scatter
  grad.addColorStop(1.0, '#1e293b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 512);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createRadialShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0,0,0,0.68)');
  grad.addColorStop(0.62, 'rgba(0,0,0,0.3)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
