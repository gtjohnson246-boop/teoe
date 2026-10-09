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
const movementKeys = new Set();
const fieldHalfSize = 52;

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
      Color,
      DirectionalLight,
      Fog,
      InstancedMesh,
      Matrix4,
      Mesh,
      MeshStandardMaterial,
      PerspectiveCamera,
      PlaneGeometry,
      Quaternion,
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
  gltf.scene.updateMatrixWorld(true);
  const variants = gltf.scene.children.filter((child) => /^SM_tdcrdbur_Var[A-F]$/.test(child.name));
  if (variants.length === 0) {
    throw new Error('The grass model contains no usable plant variants.');
  }

  const renderer = new WebGLRenderer({ canvas: grassCanvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  const scene = new Scene();
  scene.background = new Color(0xa5bd83);
  scene.fog = new Fog(0xa5bd83, 38, 115);
  scene.add(new AmbientLight(0xffffff, 2.4));

  const sunlight = new DirectionalLight(0xfff2d6, 3.5);
  sunlight.position.set(-30, 45, 20);
  scene.add(sunlight);

  const ground = new Mesh(
    new PlaneGeometry(120, 120),
    new MeshStandardMaterial({ color: 0x566c31, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.06;
  scene.add(ground);

  const variantSources = variants.map((variant) => {
    const sources = [];
    variant.traverse((object) => {
      if (object.isMesh) sources.push(object);
    });
    return sources;
  });
  const fieldRows = 56;
  const spacing = 1.8;
  const random = () => Math.random();
  const positionsByVariant = variants.map(() => []);

  for (let row = 0; row < fieldRows; row += 1) {
    for (let column = 0; column < fieldRows; column += 1) {
      const variantIndex = Math.floor(random() * variants.length);
      positionsByVariant[variantIndex].push({
        x: (column - (fieldRows - 1) / 2) * spacing + (random() - 0.5) * 0.45,
        z: (row - (fieldRows - 1) / 2) * spacing + (random() - 0.5) * 0.45,
        yaw: random() * Math.PI * 2,
        scale: 0.85 + random() * 0.4
      });
    }
  }

  const plantUpright = new Matrix4().makeRotationX(Math.PI / 2);
  const placement = new Matrix4();
  const orientation = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const plantScale = new Vector3();

  variants.forEach((variant, variantIndex) => {
    const positions = positionsByVariant[variantIndex];
    if (positions.length === 0) return;

    for (const source of variantSources[variantIndex]) {
      const plants = new InstancedMesh(source.geometry, source.material, positions.length);
      plants.name = `${variant.name} field`;
      plants.castShadow = false;
      plants.receiveShadow = true;
      const sourceTransform = plantUpright.clone().multiply(source.matrixWorld);

      positions.forEach((position, index) => {
        orientation.setFromAxisAngle(up, position.yaw);
        plantScale.setScalar(position.scale);
        placement.compose(new Vector3(position.x, 0, position.z), orientation, plantScale);
        placement.multiply(sourceTransform);
        plants.setMatrixAt(index, placement);
      });

      plants.instanceMatrix.needsUpdate = true;
      scene.add(plants);
    }
  });

  const camera = new PerspectiveCamera(72, 1, 0.1, 140);
  camera.position.set(0, 1.45, 0);
  camera.lookAt(0, 1.45, -1);

  return { renderer, scene, camera };
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

  const delta = lastGrassFrame === 0 ? 0 : Math.min((time - lastGrassFrame) / 1000, 0.05);
  lastGrassFrame = time;
  const forward = Number(movementKeys.has('KeyW') || movementKeys.has('ArrowUp'))
    - Number(movementKeys.has('KeyS') || movementKeys.has('ArrowDown'));
  const strafe = Number(movementKeys.has('KeyD') || movementKeys.has('ArrowRight'))
    - Number(movementKeys.has('KeyA') || movementKeys.has('ArrowLeft'));
  const length = Math.hypot(forward, strafe) || 1;
  const speed = 7 * delta / length;
  grassScene.camera.position.x = Math.max(
    -fieldHalfSize,
    Math.min(fieldHalfSize, grassScene.camera.position.x + strafe * speed)
  );
  grassScene.camera.position.z = Math.max(
    -fieldHalfSize,
    Math.min(fieldHalfSize, grassScene.camera.position.z - forward * speed)
  );
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
  movementKeys.clear();
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
  movementKeys.clear();
  cancelAnimationFrame(grassAnimationFrame);
  grassAnimationFrame = 0;
  lastGrassFrame = 0;
});

window.addEventListener('keydown', (event) => {
  if (grassGame.hidden) return;
  const movementCode = /^(Key[WASD]|Arrow(?:Up|Down|Left|Right))$/.test(event.code);
  if (!movementCode) return;

  event.preventDefault();
  movementKeys.add(event.code);
});

window.addEventListener('keyup', (event) => {
  movementKeys.delete(event.code);
});

window.addEventListener('blur', () => movementKeys.clear());
window.addEventListener('resize', resizeGrassScene);
