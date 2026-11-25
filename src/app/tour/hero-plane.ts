import * as THREE from 'three';

export function createHeroPlane(host: HTMLElement, image: HTMLImageElement, invalidate: () => void) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('webgl2', {
    antialias: false,
    depth: false,
    powerPreference: 'low-power',
    failIfMajorPerformanceCaveat: true,
  });
  if (!context) return;

  const renderer = new THREE.WebGLRenderer({ canvas, context });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 10);
  const texture = new THREE.Texture(image);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  const geometry = new THREE.PlaneGeometry(1, 1);
  const material = new THREE.MeshBasicMaterial({ map: texture, depthTest: false, depthWrite: false });
  const plane = new THREE.Mesh(geometry, material);
  scene.add(plane);

  const restingDistance = 3;
  const viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * restingDistance;
  let width = 0;
  let height = 0;
  let imageChanged = true;
  let disposed = false;

  canvas.style.cssText = 'display:block;width:100%;height:100%;visibility:hidden';
  canvas.setAttribute('aria-hidden', 'true');
  host.append(canvas);

  function draw(progress: number) {
    if (disposed || !image.naturalWidth || !image.naturalHeight) return;
    const nextWidth = host.clientWidth;
    const nextHeight = host.clientHeight;
    if (nextWidth === 0 || nextHeight === 0) return;

    if (width !== nextWidth || height !== nextHeight || imageChanged) {
      width = nextWidth;
      height = nextHeight;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5, 2400 / Math.max(width, height)));
      renderer.setSize(width, height, false);

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      const imageAspect = image.naturalWidth / image.naturalHeight;
      const coverScale = viewHeight * Math.max(1, camera.aspect / imageAspect);
      plane.scale.set(coverScale * imageAspect, coverScale, 1);
      imageChanged = false;
    }

    camera.position.z = restingDistance * (1 - 0.05 * progress);
    camera.position.y = -0.03 * progress;
    material.color.setScalar(1 - 0.07 * progress);
    renderer.render(scene, camera);
    canvas.style.visibility = 'visible';
  }

  function refreshImage() {
    imageChanged = true;
    texture.needsUpdate = true;
    invalidate();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    canvas.removeEventListener('webglcontextlost', dispose);
    image.removeEventListener('load', refreshImage);
    canvas.remove();
    texture.dispose();
    material.dispose();
    geometry.dispose();
    renderer.dispose();
    if (!context.isContextLost()) renderer.forceContextLoss();
  }

  canvas.addEventListener('webglcontextlost', dispose);
  image.addEventListener('load', refreshImage);

  return { draw, dispose };
}
