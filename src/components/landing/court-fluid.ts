import * as THREE from 'three';

const vertexShader = `varying vec2 vUv;
void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const common = `precision highp float; varying vec2 vUv;`;
const shaders = {
  advect: `${common}
    uniform sampler2D velocity; uniform sampler2D source;
    uniform vec2 texel; uniform float dt; uniform float decay;
    void main(){vec2 p=vUv-dt*texture2D(velocity,vUv).xy*texel;
      gl_FragColor=texture2D(source,p)*decay;}`,
  splat: `${common}
    uniform sampler2D source; uniform vec2 point; uniform vec3 force;
    uniform float aspect; uniform float radius;
    void main(){vec2 d=vUv-point;d.x*=aspect;
      vec3 ink=exp(-dot(d,d)/radius)*force;
      gl_FragColor=vec4(texture2D(source,vUv).xyz+ink,1.);}`,
  divergence: `${common}
    uniform sampler2D velocity;uniform vec2 texel;
    void main(){
      float l=texture2D(velocity,vUv-vec2(texel.x,0.)).x;
      float r=texture2D(velocity,vUv+vec2(texel.x,0.)).x;
      float b=texture2D(velocity,vUv-vec2(0.,texel.y)).y;
      float t=texture2D(velocity,vUv+vec2(0.,texel.y)).y;
      gl_FragColor=vec4(.5*(r-l+t-b),0.,0.,1.);}`,
  pressure: `${common}
    uniform sampler2D source;uniform sampler2D divergence;uniform vec2 texel;
    void main(){
      float l=texture2D(source,vUv-vec2(texel.x,0.)).x;
      float r=texture2D(source,vUv+vec2(texel.x,0.)).x;
      float b=texture2D(source,vUv-vec2(0.,texel.y)).x;
      float t=texture2D(source,vUv+vec2(0.,texel.y)).x;
      float d=texture2D(divergence,vUv).x;
      gl_FragColor=vec4((l+r+b+t-d)*.25,0.,0.,1.);}`,
  gradient: `${common}
    uniform sampler2D pressure;uniform sampler2D velocity;uniform vec2 texel;
    void main(){
      float l=texture2D(pressure,vUv-vec2(texel.x,0.)).x;
      float r=texture2D(pressure,vUv+vec2(texel.x,0.)).x;
      float b=texture2D(pressure,vUv-vec2(0.,texel.y)).x;
      float t=texture2D(pressure,vUv+vec2(0.,texel.y)).x;
      vec2 v=texture2D(velocity,vUv).xy-.5*vec2(r-l,t-b);
      gl_FragColor=vec4(v,0.,1.);}`,
  display: `${common}
    uniform sampler2D surface;uniform sampler2D ink;
    void main(){vec4 base=texture2D(surface,vUv);
      float d=texture2D(ink,vUv).r;
      float mask=smoothstep(.12,.38,d);
      gl_FragColor=vec4(base.rgb,1.-mask);}`,
};

/** Small, project-owned fluid mask. No reference-site scripts or assets are loaded. */
export async function createCourtFluid(host: HTMLElement, svg: string) {
  const main = host.closest('main')!;
  const touchScreen = window.matchMedia('(pointer: coarse)').matches;
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, premultipliedAlpha: false, powerPreference: 'low-power' });
  // Float linear sampling is needed for stable semi-Lagrangian advection.
  if (!renderer.extensions.has('EXT_color_buffer_float') || !renderer.extensions.has('OES_texture_float_linear')) {
    renderer.dispose();
    throw new Error('Fluid render targets are not supported');
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geometry = new THREE.PlaneGeometry(2, 2);
  const quad = new THREE.Mesh(geometry);
  scene.add(quad);
  const sim = touchScreen ? 96 : 128;
  const dyeSize = touchScreen ? 256 : 512;
  const targets: THREE.WebGLRenderTarget[] = [];
  const target = (size: number) => {
    const t = new THREE.WebGLRenderTarget(size, size, {
      type: THREE.HalfFloatType, format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      depthBuffer: false, stencilBuffer: false,
    });
    targets.push(t);
    renderer.setRenderTarget(t);
    renderer.clear();
    return t;
  };
  const pair = (size: number) => ({ read: target(size), write: target(size), swap() { [this.read, this.write] = [this.write, this.read]; } });
  const velocity = pair(sim);
  const ink = pair(dyeSize);
  const pressure = pair(sim);
  const divergence = target(sim);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;
  const surface = new THREE.CanvasTexture(canvas);
  surface.minFilter = THREE.LinearFilter;
  surface.magFilter = THREE.LinearFilter;
  const texel = new THREE.Vector2(1 / sim, 1 / sim);
  const material = (fragmentShader: string, uniforms: Record<string, THREE.IUniform>) => new THREE.ShaderMaterial({
    vertexShader, fragmentShader, uniforms, depthTest: false, depthWrite: false,
  });
  const advect = material(shaders.advect, { velocity: { value: null }, source: { value: null }, texel: { value: texel }, dt: { value: .016 }, decay: { value: .98 } });
  const splat = material(shaders.splat, { source: { value: null }, point: { value: new THREE.Vector2() }, force: { value: new THREE.Vector3() }, aspect: { value: 1 }, radius: { value: .0018 } });
  const div = material(shaders.divergence, { velocity: { value: null }, texel: { value: texel } });
  const solve = material(shaders.pressure, { source: { value: null }, divergence: { value: divergence.texture }, texel: { value: texel } });
  const subtract = material(shaders.gradient, { pressure: { value: null }, velocity: { value: null }, texel: { value: texel } });
  const display = material(shaders.display, { surface: { value: surface }, ink: { value: ink.read.texture } });
  display.transparent = true;
  display.blending = THREE.NoBlending;
  const materials = [advect, splat, div, solve, subtract, display];
  const pass = (m: THREE.ShaderMaterial, output: THREE.WebGLRenderTarget | null) => {
    quad.material = m;
    renderer.setRenderTarget(output);
    renderer.render(scene, camera);
  };
  const logo = new Image();
  // Data URL has no external resource dependencies, so the canvas stays origin-clean.
  logo.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  try {
    await logo.decode();
  } catch (error) {
    materials.forEach(m => m.dispose());
    targets.forEach(t => t.dispose());
    surface.dispose(); geometry.dispose(); renderer.dispose();
    throw error;
  }
  let width = 1, height = 1, stopped = false;
  let frame = 0, previousTime = performance.now(), lastMove = -Infinity;
  let pointer: { x: number; y: number; dx: number; dy: number } | null = null;
  let previous: { x: number; y: number } | null = null;
  let userInteracted = false;
  const previewStarted = performance.now();
  // A single short reveal teaches the touch interaction without a repeating loop.
  let previewDone = !touchScreen;
  const resize = () => {
    const bounds = main.getBoundingClientRect();
    width = bounds.width; height = bounds.height;
    renderer.setSize(width, height);
    canvas.width = Math.round(width * Math.min(devicePixelRatio, 2));
    canvas.height = Math.round(height * Math.min(devicePixelRatio, 2));
    context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    context.fillStyle = '#f9f9f6';
    context.fillRect(0, 0, width, height);
    const rect = main.querySelector('[data-wordmark]')!.getBoundingClientRect();
    context.drawImage(logo, rect.left - bounds.left, rect.top - bounds.top, rect.width, rect.height);
    surface.needsUpdate = true;
    splat.uniforms.aspect.value = width / height;
    // Keep the brush physical size consistent on portrait screens.
    splat.uniforms.radius.value = width < 700 ? .003 : .0018;
  };
  const move = (event: PointerEvent) => {
    if (event.pointerType === 'touch' && event.buttons === 0) return;
    if (event.isPrimary === false) return;
    if ((event.target as HTMLElement).closest('a,button,nav')) { previous = null; return; }
    userInteracted = true;
    main.dataset.fluidActive = 'true';
    const rect = main.getBoundingClientRect();
    const x = (event.clientX - rect.left) / width;
    const y = 1 - (event.clientY - rect.top) / height;
    if (previous) {
      pointer = { x, y, dx: (x - previous.x) * 2200, dy: (y - previous.y) * 2200 };
      lastMove = performance.now();
      main.dataset.touched = 'true';
    }
    previous = { x, y };
    if (!frame) { previousTime = performance.now(); frame = requestAnimationFrame(animate); }
  };
  const down = (event: PointerEvent) => {
    // Navigation cancels the demonstration but never intercepts the link tap.
    userInteracted = true;
    if (event.pointerType === 'mouse' || event.isPrimary === false || (event.target as HTMLElement).closest('a,button,nav')) return;
    const rect = main.getBoundingClientRect();
    const x = (event.clientX - rect.left) / width;
    const y = 1 - (event.clientY - rect.top) / height;
    previous = { x, y };
    main.dataset.fluidActive = 'true';
    pointer = { x, y, dx: 0, dy: 0 };
    lastMove = performance.now();
    main.dataset.touched = 'true';
    if (!frame) { previousTime = performance.now(); frame = requestAnimationFrame(animate); }
  };
  const leave = () => { previous = null; };
  const animate = (time: number) => {
    frame = 0;
    if (stopped || document.hidden) return;
    // Touch needs a responsive impression, not desktop-level GPU throughput.
    if (touchScreen && time - previousTime < 1000 / 30) {
      frame = requestAnimationFrame(animate);
      return;
    }
    const dt = Math.min((time - previousTime) / 1000, .05);
    if (!previewDone) {
      const progress = (time - previewStarted) / 900;
      if (userInteracted || progress >= 1) previewDone = true;
      else {
        pointer = { x: .40 + .20 * progress, y: .50 + .025 * Math.sin(progress * Math.PI), dx: 15, dy: 2 };
        lastMove = time;
      }
    }
    previousTime = time;
    advect.uniforms.velocity.value = velocity.read.texture;
    advect.uniforms.source.value = velocity.read.texture;
    advect.uniforms.dt.value = dt;
    advect.uniforms.decay.value = Math.pow(.975, dt * 60);
    pass(advect, velocity.write); velocity.swap();
    if (pointer) {
      splat.uniforms.source.value = velocity.read.texture;
      splat.uniforms.point.value.set(pointer.x, pointer.y);
      splat.uniforms.force.value.set(pointer.dx, pointer.dy, 0);
      pass(splat, velocity.write); velocity.swap();
      splat.uniforms.source.value = ink.read.texture;
      splat.uniforms.force.value.set(.85, 0, 0);
      pass(splat, ink.write); ink.swap();
      pointer = null;
    }
    div.uniforms.velocity.value = velocity.read.texture;
    pass(div, divergence);
    renderer.setRenderTarget(pressure.read); renderer.clear();
    for (let i = 0; i < (touchScreen ? 8 : 12); i++) {
      solve.uniforms.source.value = pressure.read.texture;
      pass(solve, pressure.write); pressure.swap();
    }
    subtract.uniforms.pressure.value = pressure.read.texture;
    subtract.uniforms.velocity.value = velocity.read.texture;
    pass(subtract, velocity.write); velocity.swap();
    advect.uniforms.velocity.value = velocity.read.texture;
    advect.uniforms.source.value = ink.read.texture;
    // Trails linger and then fully settle back into the unmarked homepage.
    advect.uniforms.decay.value = Math.pow(.982, dt * 60);
    pass(advect, ink.write); ink.swap();
    display.uniforms.ink.value = ink.read.texture;
    pass(display, null);
    if (!previewDone || time - lastMove < (touchScreen ? 4000 : 6000)) {
      frame = requestAnimationFrame(animate);
    } else {
      // Slow devices must also return to a clean surface before rendering sleeps.
      for (const buffer of [ink.read, ink.write, velocity.read, velocity.write]) {
        renderer.setRenderTarget(buffer);
        renderer.clear();
      }
      pass(display, null);
      main.dataset.fluidActive = 'false';
    }
  };
  const visibility = () => {
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; previous = null; }
    else if (!frame) { previousTime = performance.now(); frame = requestAnimationFrame(animate); }
  };
  const observer = new ResizeObserver(() => {
    resize();
    if (!frame) { previousTime = performance.now(); frame = requestAnimationFrame(animate); }
  });
  const onContextLost = (event: Event) => {
    event.preventDefault();
    main.dataset.reveal = 'unavailable';
    stopped = true;
    cancelAnimationFrame(frame);
  };
  resize();
  host.appendChild(renderer.domElement);
  pass(display, null);
  main.dataset.fluidActive = touchScreen ? 'true' : 'false';
  main.dataset.reveal = 'ready';
  observer.observe(main);
  if (touchScreen) frame = requestAnimationFrame(animate);
  main.addEventListener('pointerdown', down, { passive: true });
  main.addEventListener('pointermove', move, { passive: true });
  main.addEventListener('pointerleave', leave);
  main.addEventListener('pointerup', leave);
  main.addEventListener('pointercancel', leave);
  document.addEventListener('visibilitychange', visibility);
  renderer.domElement.addEventListener('webglcontextlost', onContextLost);
  return () => {
    stopped = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    main.removeEventListener('pointerdown', down);
    main.removeEventListener('pointermove', move);
    main.removeEventListener('pointerleave', leave);
    main.removeEventListener('pointerup', leave);
    main.removeEventListener('pointercancel', leave);
    document.removeEventListener('visibilitychange', visibility);
    renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
    renderer.domElement.remove();
    main.removeAttribute('data-reveal');
    main.removeAttribute('data-fluid-active');
    materials.forEach(m => m.dispose());
    targets.forEach(t => t.dispose());
    surface.dispose(); geometry.dispose(); renderer.dispose();
  };
}
