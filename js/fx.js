/* =====================================================================
   SHARDS — a gold sphere fractured in Blender (Voronoi, ~110 pieces)
   lives behind the whole page:
     hero     → shards fly in and assemble into a golden orb behind the portrait
     scroll   → the orb explodes; shards drift through the dark sections
     contact  → shards reassemble into a giant "D."
   All 110 shards are ONE mesh / ONE draw call; every shard's flight is
   computed on the GPU (vertex shader), so the main thread stays free.
   ===================================================================== */
const ok = !matchMedia('(prefers-reduced-motion: reduce)').matches && !(navigator.connection && navigator.connection.saveData);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

if (ok) {
  const go = () => (window.requestIdleCallback || setTimeout)(() => init().catch(e => console.warn('fx off:', e)), { timeout: 1200 });
  document.readyState === 'complete' ? go() : addEventListener('load', go, { once: true });
}

/* target points for the "D." formation, sampled from canvas-drawn text */
function letterPoints(n) {
  const W = 260, H = 200, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  // thick strokes so ~110 shards fill the glyph solidly (thin serif hairlines would break up)
  g.fillStyle = g.strokeStyle = '#fff'; g.lineWidth = 7; g.lineJoin = 'round';
  g.font = 'italic 600 176px "Playfair Display", Georgia, serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('D.', W / 2, H / 2 + 8); g.strokeText('D.', W / 2, H / 2 + 8);
  const d = g.getImageData(0, 0, W, H).data, pts = [];
  for (let y = 0; y < H; y += 3) for (let x = 0; x < W; x += 3) if (d[(y * W + x) * 4 + 3] > 128) pts.push([x, y]);
  // farthest-point sampling → evenly spread shards over the glyph
  const out = [pts[(Math.random() * pts.length) | 0]], dist = pts.map(() => 1e9);
  while (out.length < n) {
    const l = out[out.length - 1]; let bi = 0, bd = -1;
    for (let i = 0; i < pts.length; i++) {
      const dx = pts[i][0] - l[0], dy = pts[i][1] - l[1], dd = Math.min(dist[i], dx * dx + dy * dy);
      dist[i] = dd; if (dd > bd) { bd = dd; bi = i; }
    }
    out.push(pts[bi]);
  }
  return out.map(([x, y]) => [(x - W / 2) / H, -(y - H / 2) / H, (Math.random() - .5) * .04]);
}

async function init() {
  const [THREE, { GLTFLoader }, { RoomEnvironment }, { MeshoptDecoder }] = await Promise.all([
    import('three'), import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/environments/RoomEnvironment.js'), import('three/addons/libs/meshopt_decoder.module.js')]);
  try { await document.fonts.load('italic 190px "Playfair Display"'); } catch (e) {}

  const mobile = innerWidth < 900;
  // phones / weak devices: 1x pixels and 30 fps for this ambient layer (it's background, not the hero)
  const LOW = mobile || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  const canvas = document.createElement('canvas'); canvas.id = 'fx'; canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !LOW, alpha: true, powerPreference: LOW ? 'low-power' : 'high-performance' });
  renderer.setPixelRatio(LOW ? 1 : Math.min(devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0f0e0c, 12, 21);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture;
  scene.environmentIntensity = .7;
  const key = new THREE.DirectionalLight(0xfff0d8, 2.2); key.position.set(-3, 4, 6);
  const rim = new THREE.DirectionalLight(0xffb55a, 3.2); rim.position.set(4, 2, -3);
  scene.add(key, rim);
  const FOV = 35, CZ = 10;
  const cam = new THREE.PerspectiveCamera(FOV, 1, .1, 60); cam.position.z = CZ;

  /* ---------- build one merged geometry from the Blender shards ---------- */
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('models/shards.glb');
  const parts = []; gltf.scene.traverse(o => o.isMesh && parts.push(o));
  const N = parts.length, L = letterPoints(N);
  // shuffle letter targets so neighbours on the orb fly to distant spots
  for (let i = L.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [L[i], L[j]] = [L[j], L[i]]; }
  const P = [], A = [], B = [], C = [], R = [], COL = [];
  const gold = new THREE.Color(1.0, .62, .26), dark = new THREE.Color(.035, .03, .026);
  const v = new THREE.Vector3(), cen = new THREE.Vector3(), tri = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  parts.forEach((m, k) => {
    m.updateWorldMatrix(true, false);
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    g.applyMatrix4(m.matrixWorld);
    const pos = g.attributes.position, n = pos.count;
    cen.set(0, 0, 0); for (let i = 0; i < n; i++) cen.add(v.fromBufferAttribute(pos, i)); cen.divideScalar(n);
    const cloud = [(Math.random() * 2 - 1), (Math.random() * 2 - 1), -Math.random() * .9 + .15];
    const ax = new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize();
    const rnd = Math.random();
    for (let i = 0; i < n; i += 3) {
      for (let q = 0; q < 3; q++) tri[q].fromBufferAttribute(pos, i + q);
      // outer skin of the orb = gold, fresh fracture faces = dark obsidian
      const c = tri[0].clone().add(tri[1]).add(tri[2]).divideScalar(3);
      const nrm = tri[1].clone().sub(tri[0]).cross(tri[2].clone().sub(tri[0])).normalize();
      const outer = c.length() > .9 && Math.abs(nrm.dot(c.clone().normalize())) > .85;
      const col = outer ? gold : dark;
      for (let q = 0; q < 3; q++) {
        P.push(tri[q].x - cen.x, tri[q].y - cen.y, tri[q].z - cen.z);
        A.push(cen.x, cen.y, cen.z); B.push(...cloud); C.push(...L[k]);
        R.push(ax.x, ax.y, ax.z, rnd); COL.push(col.r, col.g, col.b);
      }
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('aA', new THREE.Float32BufferAttribute(A, 3));
  geo.setAttribute('aB', new THREE.Float32BufferAttribute(B, 3));
  geo.setAttribute('aC', new THREE.Float32BufferAttribute(C, 3));
  geo.setAttribute('aR', new THREE.Float32BufferAttribute(R, 4));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(COL, 3));
  geo.computeVertexNormals();

  const U = {
    uW: { value: new THREE.Vector3(0, 1, 0) },     // weights: orb, cloud, letter
    uTime: { value: 0 },
    uRot: { value: new THREE.Matrix3() },
    uOrb: { value: new THREE.Vector4(0, 0, 0, 1) }, // centre xyz, radius
    uLet: { value: new THREE.Vector4(0, -20, 0, 1) },// centre xyz, height
    uCloud: { value: new THREE.Vector3(8, 5, 7) },   // half width, half height, depth
    uS: { value: new THREE.Vector3(1, .32, .13) },  // shard scale per formation (letter: overlap into solid strokes)
    uPush: { value: 0 },                             // pointer near the orb → it cracks open
  };
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 1, roughness: .26, flatShading: true });
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec3 aA; attribute vec3 aB; attribute vec3 aC; attribute vec4 aR;
        uniform vec3 uW; uniform float uTime; uniform mat3 uRot; uniform vec4 uOrb; uniform vec4 uLet;
        uniform vec3 uCloud; uniform vec3 uS; uniform float uPush;
        varying float vK;
        vec3 rotA(vec3 v, vec3 a, float t){ float c=cos(t), s=sin(t); return v*c + cross(a,v)*s + a*dot(a,v)*(1.-c); }`)
      .replace('#include <begin_vertex>', `
        float st = aR.w * .45;                                   // staggered arrival per shard
        float kA = smoothstep(st, st + .55, uW.x);
        float kC = smoothstep(st, st + .55, uW.z);
        float kB = max(0., 1. - kA - kC);
        float ks = kA + kB + kC; kA /= ks; kB /= ks; kC /= ks;
        vec3 ax = normalize(aR.xyz);
        float spin = kB * (aR.w * 6.2831 + uTime * (.22 + aR.w * .45));
        // orb/cloud: shards tumble with the orb; letter: they lie flat toward the camera → clean mosaic
        vec3 locOrb = rotA(uRot * position, ax, spin);
        vec3 locLet = vec3(position.xy, position.z * .25);
        vec3 loc = mix(locOrb, locLet, kC);
        vK = kC;
        vec3 dir = normalize(aA + 1e-4);
        vec3 pA = uOrb.xyz + uRot * (aA + dir * (uPush * (.25 + aR.w * .35) + .012 * sin(uTime * 1.6 + aR.w * 20.))) * uOrb.w;
        float tt = uTime * .12 + aR.w * 40.;
        vec3 pB = vec3(aB.x * uCloud.x, aB.y * uCloud.y, aB.z * uCloud.z) + vec3(sin(tt) * .45, cos(tt * 1.3) * .35, sin(tt * .7) * .4);
        vec3 pC = uLet.xyz + vec3(aC.xy * uLet.w, aC.z * uLet.w);
        float sc = kA * uOrb.w * uS.x + kB * uS.y + kC * uLet.w * uS.z;
        vec3 transformed = kA * pA + kB * pB + kC * pC + loc * sc;`);
    // letter formation: every face gold (no dark fracture faces poking through) + a soft glow
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n varying float vK;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1., .64, .28), vK);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(.55, .32, .12) * vK;`);
  };
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; scene.add(mesh);

  /* ---------- DOM anchors ---------- */
  const hero = document.querySelector('.hero'), portrait = document.getElementById('portrait');
  const contact = document.getElementById('contact'), big = contact && contact.querySelector('.dmark');
  const show = document.getElementById('show');
  const lights = [...document.querySelectorAll('.light')];
  let k = 1;                                   // world units per CSS px on the z=0 plane
  const toWorld = (x, y, out) => out.set((x - innerWidth / 2) * k, -(y - innerHeight / 2) * k, 0);
  function size() {
    renderer.setSize(innerWidth, innerHeight, false);
    cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix();
    k = 2 * CZ * Math.tan(THREE.MathUtils.degToRad(FOV / 2)) / innerHeight;
    U.uCloud.value.set(innerWidth * k * .62, innerHeight * k * .62, 7);
    U.uS.value.y = mobile ? .26 : .34;
  }
  addEventListener('resize', size); size();

  let px = 0, py = 0, tx = 0, ty = 0, pushT = 0;
  addEventListener('pointermove', e => {
    tx = e.clientX / innerWidth - .5; ty = e.clientY / innerHeight - .5;
    if (portrait) {   // cursor close to the orb → it cracks open a little
      const r = portrait.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height * .36;
      pushT = 1 - clamp(Math.hypot(e.clientX - cx, e.clientY - cy) / (r.width * .9));
    }
  }, { passive: true });

  /* ---------- loop ---------- */
  const t0 = performance.now(), rotE = new THREE.Euler(), rotM = new THREE.Matrix4(), tmp = new THREE.Vector3();
  let wA = 0, wB = 1, wC = 0, push = 0, ready = false, alpha = 0, shownAlpha = -1, last = 0;
  const STEP = LOW ? 1000 / 30 - 2 : 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    if (document.hidden || ts - last < STEP) return;      // 30 fps cap on weak devices
    last = ts;
    const H = innerHeight, now = (performance.now() - t0) / 1000;

    // skip the GPU work whenever an opaque light section or the 3D showcase fills the screen
    let covered = lights.some(s => { const r = s.getBoundingClientRect(); return r.top <= 0 && r.bottom >= H; });
    let inShow = false;
    if (show) { const r = show.getBoundingClientRect(); inShow = r.top < H * .35 && r.bottom > H * .65; }
    alpha += ((inShow ? 0 : 1) - alpha) * (LOW ? .22 : .12);
    if (Math.abs(alpha - shownAlpha) > .01 || (alpha < .01 && shownAlpha !== 0)) {   // touch the DOM only when it changes
      shownAlpha = alpha < .01 ? 0 : alpha; canvas.style.opacity = shownAlpha.toFixed(2);
    }
    if (covered || alpha < .01) return;

    // formation weights from scroll position
    const intro = smooth(0, 2.4, now);
    let a = 0, c = 0;
    if (hero) { const r = hero.getBoundingClientRect(); a = smooth(.2, .72, r.bottom / H); }
    if (contact) { const r = contact.getBoundingClientRect(); c = smooth(H * .95, H * .2, r.top) * smooth(-H * .2, H * .35, r.bottom); }
    a *= intro;
    const F = LOW ? 1.9 : 1;                                // same easing speed at 30 fps
    wA += (a - wA) * .08 * F; wC += (c - wC) * .06 * F;
    U.uW.value.set(wA, Math.max(0, 1 - wA - wC), wC);

    // orb sits exactly on the portrait's gold circle
    if (portrait) {
      const r = portrait.getBoundingClientRect();
      // a golden halo behind head and shoulders
      toWorld(r.left + r.width / 2, r.top + r.height * .36, tmp);
      U.uOrb.value.set(tmp.x, tmp.y, -1.2, r.width * .66 * k);
    }
    if (big) {
      const r = big.getBoundingClientRect();
      toWorld(r.left + r.width / 2, r.top + r.height / 2, tmp);
      // its own space above the headline (nothing overlaps it), capped so the glyph fits phones too
      U.uLet.value.set(tmp.x, tmp.y, 0, Math.min(r.height * 1.05, innerWidth * .6) * k);
    }

    px += (tx - px) * .05 * F; py += (ty - py) * .05 * F; push += (pushT - push) * .08 * F;
    U.uPush.value = push;
    rotE.set(.25 + py * .5, now * .18 + px * .9, .08);
    rotM.makeRotationFromEuler(rotE); U.uRot.value.setFromMatrix4(rotM);
    U.uTime.value = now;

    renderer.render(scene, cam);
    if (!ready) { ready = true; document.body.classList.add('fx-on'); }
  }
  requestAnimationFrame(frame);
}
