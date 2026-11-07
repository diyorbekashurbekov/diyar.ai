/* =====================================================================
   3D SHOWCASE — laptop + phone modelled in Blender, rendered with Three.js
   - The text side works without WebGL.
   - Three.js is only downloaded after the page has fully loaded and the
     visitor is getting close to this section.
   - Each project: the camera flies to its own shot, and the real website
     scrolls inside both screens as the visitor scrolls.
   ===================================================================== */
const sec = document.getElementById('show');
const $ = id => document.getElementById(id);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const URL0 = 'https://diyorbekashurbekov.github.io/';

/* name, meta, url slug, screenshot id (images/scroll/d_*.webp + m_*.webp) */
const P = [
  ['DOS Мебель', 'Жиһаз фабрикасы · Алматы', 'dos-mebel', 'dos'],
  ['Perde Mariam', 'Перде салоны · Астана', 'perde.mariam', 'perde'],
  ['Luxe Furnitura', 'Онлайн дүкен', 'luxe-furnitura', 'luxe'],
  ['Printspace.kz', 'Полиграфия · Түркістан', 'printspace-kz', 'print'],
  ['LUXE Barbershop', 'Барбершоп · Кентау', 'luxe-barbershop-kentau', 'barber'],
  ['Amanat Interior', 'Интерьер · Астана', 'amanat_interior', 'amanat'],
];
const INTRO = .15;                // first 15%: scattered parts assemble, then the lid opens
let prog = 0, idx = 0, onIndex = null;

/* where we are: u runs 0..N across the projects */
const uOf = p => clamp((p - INTRO) / (1 - INTRO)) * P.length;

/* ---------- text side ---------- */
let textTok = 0;
function setText(i) {
  const b = $('sp-body'), my = ++textTok; b.classList.add('swap');
  setTimeout(() => {
    if (my !== textTok) return;          // a newer project already took over
    const p = P[i];
    $('sp-name').textContent = p[0]; $('sp-meta').textContent = p[1];
    $('sp-link').href = URL0 + p[2] + '/'; b.classList.remove('swap');
  }, 220);
  $('sp-i').textContent = '0' + (i + 1);
  [...$('sp-dots').children].forEach((d, k) => d.classList.toggle('on', k === i));
}
function measure() {
  const r = sec.getBoundingClientRect();
  prog = clamp(-r.top / (r.height - innerHeight));
  $('hint').style.opacity = prog > .02 ? 0 : 1;
  const i = Math.min(P.length - 1, Math.floor(uOf(prog)));
  if (i !== idx) { idx = i; setText(i); onIndex && onIndex(i); }
}
addEventListener('scroll', measure, { passive: true });
addEventListener('resize', measure);
measure();

/* click on the devices = open the project */
$('stage').addEventListener('click', () => open(URL0 + P[idx][2] + '/', '_blank', 'noopener'));

/* ---------- lazy boot ---------- */
const ok = !matchMedia('(prefers-reduced-motion: reduce)').matches && !(navigator.connection && navigator.connection.saveData);
let started = false;
const whenIdle = f => {
  const go = () => (window.requestIdleCallback || setTimeout)(f, { timeout: 1500 });
  document.readyState === 'complete' ? go() : addEventListener('load', go, { once: true });
};
function boot() { if (started || !ok) return; started = true; whenIdle(() => init().catch(e => console.warn('3D off:', e))); }
if (ok) {
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); boot(); } }, { rootMargin: '120% 0px' });
  io.observe(sec);
  const near = () => { if (sec.getBoundingClientRect().top < innerHeight * 2.2) { removeEventListener('scroll', near); boot(); } };
  addEventListener('scroll', near, { passive: true }); near();
}

/* ---------- camera shots, one per project ----------
   az/el: orbit angles (rad); z: zoom (1 = both devices fit); t: look-at point */
const SHOTS = [
  { az: .55, el: .30, z: 1.00, t: [.40, .85, 0] },    // DOS — classic three-quarter
  { az: .10, el: .10, z: .52, t: [1.75, .85, .45] },  // Perde — close on the phone
  { az: -.04, el: .16, z: .66, t: [.05, 1.0, -.55] }, // Luxe — straight at the laptop screen
  { az: -.62, el: .06, z: .86, t: [.35, .78, 0] },    // Print — low, dramatic, from the left
  { az: .30, el: .78, z: .92, t: [.35, .55, 0] },     // Barber — from above
  { az: .80, el: .22, z: .98, t: [.65, .9, 0] },      // Amanat — wide from the right
];
const INTRO_SHOT = { az: .75, el: .55, z: 1.05, t: [.4, .6, 0] };

async function init() {
  const [THREE, { GLTFLoader }, { RoomEnvironment }, { MeshoptDecoder }] = await Promise.all([
    import('three'), import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/environments/RoomEnvironment.js'), import('three/addons/libs/meshopt_decoder.module.js')]);

  const stage = $('stage'), canvas = $('gl'), mobile = innerWidth < 900;
  const LOW = mobile || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !LOW, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, LOW ? 1.25 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture;
  scene.environmentIntensity = .55;
  const key = new THREE.DirectionalLight(0xfff1dd, 1.4); key.position.set(-4, 6, 5);
  const rim = new THREE.DirectionalLight(0xffc773, 3); rim.position.set(5, 3, -5);
  scene.add(key, rim);
  const cam = new THREE.PerspectiveCamera(28, 1, 1, 60);   // tighter near/far = more depth precision

  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('models/devices.glb');
  const root = gltf.scene; scene.add(root);
  const lid = root.getObjectByName('Lid'), phone = root.getObjectByName('Phone');
  const phBase = phone.position.clone();

  /* every part starts scattered around the scene and flies home (keys, lid, trackpad, lenses...) */
  const parts = [];
  root.traverse(o => {
    if (!o.isMesh) return;
    const dir = new THREE.Vector3(Math.random() - .5, Math.random() * .8 + .1, Math.random() - .5).normalize();
    parts.push({ o, p: o.position.clone(), r: o.rotation.clone(), d: dir.multiplyScalar(1.6 + Math.random() * 2.4),
      s: [Math.random() * 6 - 3, Math.random() * 6 - 3, Math.random() * 6 - 3], delay: Math.random() * .45 });
  });

  /* screens: glossy glass that glows with the website and reflects the room */
  const screenMat = () => new THREE.MeshStandardMaterial({
    color: 0x000000, emissive: 0xffffff, emissiveIntensity: 0, roughness: .16, metalness: 0, toneMapped: false,
    // the screen sits 0.6 mm in front of the black bezel glass: from far away the depth buffer
    // can't tell them apart (z-fighting → black diagonal stripes). Always draw the screen on top.
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const lapMat = screenMat(), phMat = screenMat();
  root.getObjectByName('LaptopScreen').material = lapMat;
  root.getObjectByName('PhoneScreen').material = phMat;
  const ASPECT = { d: 2.80 / 1.75, m: .718 / 1.558 };   // screen width / height (from the Blender model)

  /* soft contact shadow under the devices (one tiny canvas, no shadow maps) */
  {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(0,0,0,.62)'); gr.addColorStop(.55, 'rgba(0,0,0,.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, toneMapped: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.set(.55, -.012, .05); sh.scale.set(6.4, 3.6, 1);
    scene.add(sh);
  }

  /* ---------- textures: load current + next, free the rest (keeps phone GPUs happy) ---------- */
  const cache = new Map();
  function load(kind, i) {
    const k = kind + i; if (cache.has(k)) return cache.get(k);
    const pr = new Promise(res => {
      new THREE.TextureLoader().load(`images/scroll/${kind}_${P[i][3]}.webp`, t => {
        t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = Math.min(8, maxAniso);
        t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
        const img = t.image, view = img.width / ASPECT[kind];          // px of page height visible at once
        t.userData.v = Math.min(1, view / img.height);                  // visible fraction
        if (view > img.height) { t.repeat.set(img.height / view, 1); t.offset.x = (1 - t.repeat.x) / 2; }
        else t.repeat.set(1, t.userData.v);
        res(t);
      }, undefined, () => res(null));
    });
    cache.set(k, pr); return pr;
  }
  function keep(i) {
    for (const [k, pr] of cache) {
      const j = +k.slice(1);
      if (Math.abs(j - i) > 1) { pr.then(t => t && t.dispose()); cache.delete(k); }
    }
    [i, i + 1].filter(j => j < P.length).forEach(j => { load('d', j); load('m', j); });
  }
  let flash = 0, shown = -1;
  async function show(i) {
    keep(i);
    const [a, b] = await Promise.all([load('d', i), load('m', i)]);
    if (i !== idx) return;
    lapMat.emissiveMap = a; phMat.emissiveMap = b;
    lapMat.needsUpdate = phMat.needsUpdate = true; shown = i; flash = 1;
  }
  onIndex = show; show(idx);

  /* ---------- size & camera fit ---------- */
  let fitD = 9;
  function size() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    fitD = Math.max(8.4, 2.5 / (.2493 * cam.aspect));   // distance at which both devices fit the frame
  }
  new ResizeObserver(size).observe(stage); size();

  let mx = 0, my = 0, tx = 0, ty = 0;
  addEventListener('pointermove', e => { tx = e.clientX / innerWidth - .5; ty = e.clientY / innerHeight - .5; }, { passive: true });

  /* ---------- render loop (runs only while the section is on screen) ---------- */
  let visible = true, looping = false, sm = 0, first = true;
  const start = () => { if (!looping) { looping = true; loop(); } };
  new IntersectionObserver(es => { visible = es[es.length - 1].isIntersecting; if (visible) start(); }).observe(sec);
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const lerp = THREE.MathUtils.lerp, target = new THREE.Vector3();
  const mix = (A, B, k) => ({ az: lerp(A.az, B.az, k), el: lerp(A.el, B.el, k), z: lerp(A.z, B.z, k),
    t: [0, 1, 2].map(n => lerp(A.t[n], B.t[n], k)) });

  function loop() {
    if (!visible) { looping = false; return; }
    requestAnimationFrame(loop);
    measure();                            // never miss a scroll position, even if scroll events are coalesced
    // weak devices: when nothing moves (no scroll, no pointer, no screen switch) skip the frame entirely
    if (LOW && !first && Math.abs(prog - sm) < 1e-4 && Math.abs(tx - mx) < 1e-3 && Math.abs(ty - my) < 1e-3 && flash < .004) return;
    sm += (prog - sm) * .085; mx += (tx - mx) * .06; my += (ty - my) * .06;
    const time = performance.now() / 1000;

    /* intro part 1: scattered parts fly together (each with its own delay) */
    const build = clamp(sm / (INTRO * .6));
    for (const q of parts) {
      const k = 1 - easeOut(clamp((build - q.delay) / (1 - q.delay * .9)));
      q.o.position.set(q.p.x + q.d.x * k, q.p.y + q.d.y * k, q.p.z + q.d.z * k);
      q.o.rotation.set(q.r.x + q.s[0] * k, q.r.y + q.s[1] * k, q.r.z + q.s[2] * k);
    }
    /* intro part 2: lid opens, phone slides in */
    const open = easeOut(clamp((sm - INTRO * .45) / (INTRO * .55)));
    lid.rotation.set(lerp(Math.PI / 2, -.21, open), 0, 0);
    phone.position.set(phBase.x + (1 - open) * .7, phBase.y - (1 - open) * .35 + (LOW ? 0 : Math.sin(time * 1.4) * .03), phBase.z + (1 - open) * .3);

    /* camera: hold each project's shot, glide to the next one near the end of its segment */
    const u = uOf(sm), i = Math.min(P.length - 1, Math.floor(u)), f = u - i;
    let shot = mix(SHOTS[i], SHOTS[Math.min(P.length - 1, i + 1)], i < P.length - 1 ? smooth(.62, 1, f) : 0);
    shot = mix(INTRO_SHOT, shot, open);
    /* tall screens (phones, tablets): aim between both devices and pull back a little */
    const narrow = clamp((1.15 - cam.aspect) / .5);
    const d = fitD * shot.z * (1 + .12 * narrow), az = shot.az + mx * .22, el = shot.el + my * .1;
    target.set(...shot.t);
    target.x += (.85 - target.x) * .55 * narrow;
    cam.position.set(target.x + Math.sin(az) * Math.cos(el) * d, target.y + Math.sin(el) * d, target.z + Math.cos(az) * Math.cos(el) * d);
    cam.lookAt(target);

    /* the websites scroll inside the screens */
    const s = i === shown ? smooth(.08, .78, f) : 0;
    for (const m of [lapMat, phMat]) {
      const t = m.emissiveMap; if (!t) continue;
      if (t.userData.v < 1) t.offset.y = s * (1 - t.userData.v);
    }

    /* screen brightness: off while closed, quick dip when switching project */
    flash *= .9;
    lapMat.emissiveIntensity = lapMat.emissiveMap ? Math.min(1, open * 1.15) * (1 - flash * .8) : 0;
    phMat.emissiveIntensity = phMat.emissiveMap ? 1 - flash * .8 : 0;

    renderer.render(scene, cam);
    if (first) { first = false; stage.classList.add('ready'); }
  }
  start();
}
