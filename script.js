const intro = document.getElementById('intro');
const menu = document.getElementById('menu');
const playButton = document.getElementById('play-button');
const grassGame = document.getElementById('grass-game');
const grassCanvas = document.getElementById('grass-canvas');
const grassStatus = document.getElementById('grass-status');
const backButton = document.getElementById('back-button');

let introFinished = false;
let grassScene = null;
let grassLoading = false;
let grassAnimationFrame = 0;
let lastGrassFrame = 0;

function finishIntro() {
  if (introFinished) return;

  introFinished = true;
  intro.hidden = true;
  menu.hidden = false;
}

window.setTimeout(finishIntro, 2200);

async function createGrassScene() {
  const [
    {
      ACESFilmicToneMapping,
      AmbientLight,
      Box3,
      Color,
      DirectionalLight,
      MathUtils,
      PerspectiveCamera,
      Scene,
      SRGBColorSpace,
      Vector3,
      WebGLRenderer
    },
    { GLTFLoader }
  ] = await Promise.all([
    import('three'),
    import('three/addons/loaders/GLTFLoader.js')
  ]);

  const loader = new GLTFLoader();
  const gltf = await new Promise((resolve, reject) => {
    loader.load('grass/tdcrdbur_tier_3.gltf', resolve, undefined, reject);
  });
  const model = gltf.scene;
  const bounds = new Box3().setFromObject(model);
  const center = bounds.getCenter(new Vector3());
  const size = bounds.getSize(new Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z);

  if (!Number.isFinite(maxDimension) || maxDimension <= 0) {
    throw new Error('The grass model has no visible geometry.');
  }

  model.position.sub(center);

  const renderer = new WebGLRenderer({ canvas: grassCanvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.4;

  const scene = new Scene();
  scene.background = new Color(0x10150d);
  scene.add(new AmbientLight(0xffffff, 2.2));

  const sunlight = new DirectionalLight(0xfff0d0, 3.2);
  sunlight.position.set(-4, 8, 6);
  scene.add(sunlight);
  scene.add(model);

  const camera = new PerspectiveCamera(35, 1, 0.1, 1000);
  const distance = (maxDimension / (2 * Math.tan(MathUtils.degToRad(camera.fov / 2)))) * 1.5;
  camera.position.copy(new Vector3(-0.65, 0.35, 1).normalize().multiplyScalar(distance));
  camera.lookAt(0, 0, 0);

  return { renderer, scene, camera, model };
}

function resizeGrassScene() {
  if (!grassScene) return;

  const width = grassCanvas.clientWidth;
  const height = grassCanvas.clientHeight;
  if (width === 0 || height === 0) return;

  grassScene.renderer.setSize(width, height, false);
  grassScene.camera.aspect = width / height;
  grassScene.camera.updateProjectionMatrix();
}

function renderGrass(time) {
  grassAnimationFrame = 0;
  if (grassGame.hidden || !grassScene) return;

  const delta = lastGrassFrame === 0 ? 0 : (time - lastGrassFrame) / 1000;
  lastGrassFrame = time;
  grassScene.model.rotation.y += delta * 0.08;
  grassScene.renderer.render(grassScene.scene, grassScene.camera);
  grassAnimationFrame = requestAnimationFrame(renderGrass);
}

function startGrassScene() {
  resizeGrassScene();
  if (!grassAnimationFrame) {
    lastGrassFrame = 0;
    grassAnimationFrame = requestAnimationFrame(renderGrass);
  }
}

playButton.addEventListener('click', async () => {
  menu.hidden = true;
  grassGame.hidden = false;
  grassStatus.textContent = '';
  grassStatus.removeAttribute('data-error');

  if (grassScene) {
    startGrassScene();
    return;
  }

  if (grassLoading) return;
  grassLoading = true;
  grassStatus.textContent = 'Loading grass...';

  try {
    grassScene = await createGrassScene();
    grassStatus.textContent = '';
    startGrassScene();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Could not load the grass scene:', error);
    grassStatus.textContent = `Could not load grass: ${message}`;
    grassStatus.dataset.error = 'true';
  } finally {
    grassLoading = false;
  }
});

backButton.addEventListener('click', () => {
  grassGame.hidden = true;
  menu.hidden = false;
  cancelAnimationFrame(grassAnimationFrame);
  grassAnimationFrame = 0;
  lastGrassFrame = 0;
});

window.addEventListener('resize', resizeGrassScene);
