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
let cameraYaw = 0;
let cameraPitch = 0;
let lookPointerId = null;
let lastLookX = 0;
let lastLookY = 0;

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
      CanvasTexture,
      Color,
      DirectionalLight,
      DoubleSide,
      Euler,
      Float32BufferAttribute,
      Fog,
      HemisphereLight,
      InstancedMesh,
      Matrix4,
      Mesh,
      MeshStandardMaterial,
      PerspectiveCamera,
      PlaneGeometry,
      Quaternion,
      RepeatWrapping,
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

  const random = () => Math.random();
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
  scene.add(new HemisphereLight(0xdde9c1, 0x51503a, 2.1));

  const sunlight = new DirectionalLight(0xfff2d6, 2.5);
  sunlight.position.set(-30, 45, 20);
  scene.add(sunlight);

  const groundCanvas = document.createElement('canvas');
  groundCanvas.width = 256;
  groundCanvas.height = 256;
  const groundContext = groundCanvas.getContext('2d');
  if (!groundContext) {
    throw new Error('Could not create the grass field ground texture.');
  }
  groundContext.fillStyle = '#59683c';
  groundContext.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4200; i += 1) {
    const shade = Math.floor(random() * 38);
    const green = 62 + shade;
    groundContext.fillStyle = `rgba(${36 + Math.floor(shade * 0.45)}, ${green}, ${29 + Math.floor(shade * 0.28)}, ${0.08 + random() * 0.2})`;
    const radius = 0.4 + random() * 3;
    groundContext.beginPath();
    groundContext.ellipse(
      random() * 256,
      random() * 256,
      radius * (0.8 + random() * 1.2),
      radius,
      random() * Math.PI,
      0,
      Math.PI * 2
    );
    groundContext.fill();
  }
  const groundTexture = new CanvasTexture(groundCanvas);
  groundTexture.colorSpace = SRGBColorSpace;
  groundTexture.wrapS = RepeatWrapping;
  groundTexture.wrapT = RepeatWrapping;
  groundTexture.repeat.set(12, 12);

  const ground = new Mesh(
    new PlaneGeometry(120, 120),
    new MeshStandardMaterial({ map: groundTexture, roughness: 1 })
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
  const fieldRows = 68;
  const spacing = 1.5;
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
  const plantPosition = new Vector3();

  variants.forEach((variant, variantIndex) => {
    const positions = positionsByVariant[variantIndex];
    if (positions.length === 0) return;

    for (const source of variantSources[variantIndex]) {
      const makeCutoutMaterial = (material) => {
        const cutoutMaterial = material.clone();
        cutoutMaterial.transparent = false;
        cutoutMaterial.alphaTest = 0.4;
        cutoutMaterial.depthWrite = true;
        return cutoutMaterial;
      };
      const cutoutMaterial = Array.isArray(source.material)
        ? source.material.map(makeCutoutMaterial)
        : makeCutoutMaterial(source.material);
      const plants = new InstancedMesh(source.geometry, cutoutMaterial, positions.length);
      plants.name = `${variant.name} field`;
      plants.castShadow = false;
      plants.receiveShadow = true;
      const sourceTransform = plantUpright.clone().multiply(source.matrixWorld);

      positions.forEach((position, index) => {
        orientation.setFromAxisAngle(up, position.yaw);
        plantScale.setScalar(position.scale);
        plantPosition.set(position.x, 0, position.z);
        placement.compose(plantPosition, orientation, plantScale);
        placement.multiply(sourceTransform);
        plants.setMatrixAt(index, placement);
      });

      plants.instanceMatrix.needsUpdate = true;
      scene.add(plants);
    }
  });

  const bladeGeometry = new PlaneGeometry(0.075, 0.46, 2, 4);
  bladeGeometry.translate(0, 0.21, 0);
  const bladePositions = bladeGeometry.attributes.position;
  const bladeVertexColors = [];
  const bladeBaseColor = new Color(0x465b23);
  const bladeTipColor = new Color(0xa2ae52);
  for (let index = 0; index < bladePositions.count; index += 1) {
    const height = bladePositions.getY(index) + 0.02;
    const heightRatio = Math.min(height / 0.46, 1);
    const bend = height * height * 0.16;
    bladePositions.setX(index, bladePositions.getX(index) * (1 - heightRatio) + bend);
    const shade = bladeBaseColor.clone().lerp(bladeTipColor, heightRatio);
    bladeVertexColors.push(shade.r, shade.g, shade.b);
  }
  bladePositions.needsUpdate = true;
  bladeGeometry.setAttribute('color', new Float32BufferAttribute(bladeVertexColors, 3));
  bladeGeometry.computeVertexNormals();
  const windUniforms = { time: { value: 0 } };
  const bladeMaterial = new MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.9,
    side: DoubleSide,
    vertexColors: true
  });
  bladeMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uGrassTime = windUniforms.time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uGrassTime;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\ntransformed.x += sin(uGrassTime * 1.4 + instanceMatrix[3][0] * 0.4 + instanceMatrix[3][2] * 0.4) * position.y * 0.045;'
      );
  };
  bladeMaterial.customProgramCacheKey = () => 'grass-wind-v1';
  const bladeMatrix = new Matrix4();
  const bladeRotation = new Quaternion();
  const bladeEuler = new Euler();
  const bladePosition = new Vector3();
  const bladeScale = new Vector3();
  const greenPalette = [0x718c35, 0x819b3e, 0x96a949, 0x5e792d, 0xa0ad52];
  const bladeColors = greenPalette.map((color) => new Color(color));
  const bladeChunkRows = 8;
  const bladeChunkCount = bladeChunkRows * bladeChunkRows;
  const bladeCount = 20000;
  const bladesPerChunk = Array.from({ length: bladeChunkCount }, () => []);

  for (let index = 0; index < bladeCount; index += 1) {
    const x = (random() - 0.5) * fieldRows * spacing;
    const z = (random() - 0.5) * fieldRows * spacing;
    const chunkX = Math.min(
      bladeChunkRows - 1,
      Math.floor(((x + (fieldRows * spacing) / 2) / (fieldRows * spacing)) * bladeChunkRows)
    );
    const chunkZ = Math.min(
      bladeChunkRows - 1,
      Math.floor(((z + (fieldRows * spacing) / 2) / (fieldRows * spacing)) * bladeChunkRows)
    );
    const chunkIndex = chunkZ * bladeChunkRows + chunkX;
    bladePosition.set(x, 0, z);
    bladeEuler.set(
      (random() - 0.5) * 0.28,
      random() * Math.PI * 2,
      (random() - 0.5) * 0.3,
      'YXZ'
    );
    bladeRotation.setFromEuler(bladeEuler);
    bladeScale.set(0.75 + random() * 0.65, 0.65 + random() * 0.8, 1);
    bladeMatrix.compose(bladePosition, bladeRotation, bladeScale);
    bladesPerChunk[chunkIndex].push([
      x,
      z,
      bladeEuler.x,
      bladeEuler.y,
      bladeEuler.z,
      bladeScale.x,
      bladeScale.y,
      Math.floor(random() * greenPalette.length)
    ]);
  }

  bladesPerChunk.forEach((instances, chunkIndex) => {
    if (instances.length === 0) return;

    const blades = new InstancedMesh(bladeGeometry, bladeMaterial, instances.length);
    blades.name = `Fine grass blades ${chunkIndex}`;
    instances.forEach((instance, index) => {
      bladePosition.set(instance[0], 0, instance[1]);
      bladeEuler.set(instance[2], instance[3], instance[4], 'YXZ');
      bladeRotation.setFromEuler(bladeEuler);
      bladeScale.set(instance[5], instance[6], 1);
      bladeMatrix.compose(bladePosition, bladeRotation, bladeScale);
      blades.setMatrixAt(index, bladeMatrix);
      blades.setColorAt(index, bladeColors[instance[7]]);
    });
    blades.instanceMatrix.needsUpdate = true;
    if (blades.instanceColor) blades.instanceColor.needsUpdate = true;
    scene.add(blades);
  });

  const camera = new PerspectiveCamera(72, 1, 0.1, 140);
  camera.position.set(0, 1.45, 0);
  camera.rotation.order = 'YXZ';

  return { renderer, scene, camera, windUniforms };
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
  const forwardX = -Math.sin(cameraYaw);
  const forwardZ = -Math.cos(cameraYaw);
  const rightX = Math.cos(cameraYaw);
  const rightZ = -Math.sin(cameraYaw);
  grassScene.camera.position.x = Math.max(
    -fieldHalfSize,
    Math.min(fieldHalfSize, grassScene.camera.position.x + (forward * forwardX + strafe * rightX) * speed)
  );
  grassScene.camera.position.z = Math.max(
    -fieldHalfSize,
    Math.min(fieldHalfSize, grassScene.camera.position.z + (forward * forwardZ + strafe * rightZ) * speed)
  );
  grassScene.camera.rotation.set(cameraPitch, cameraYaw, 0, 'YXZ');
  grassScene.windUniforms.time.value = time * 0.001;
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
  cameraYaw = 0;
  cameraPitch = 0;
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
  lookPointerId = null;
  grassCanvas.classList.remove('is-looking');
  cancelAnimationFrame(grassAnimationFrame);
  grassAnimationFrame = 0;
  lastGrassFrame = 0;
});

grassCanvas.addEventListener('pointerdown', (event) => {
  if (!event.isPrimary || event.button !== 0) return;

  lookPointerId = event.pointerId;
  lastLookX = event.clientX;
  lastLookY = event.clientY;
  grassCanvas.classList.add('is-looking');
  grassCanvas.setPointerCapture(event.pointerId);
  event.preventDefault();
});

grassCanvas.addEventListener('pointermove', (event) => {
  if (event.pointerId !== lookPointerId) return;

  const deltaX = event.clientX - lastLookX;
  const deltaY = event.clientY - lastLookY;
  lastLookX = event.clientX;
  lastLookY = event.clientY;
  cameraYaw -= deltaX * 0.004;
  cameraPitch = Math.max(-1.25, Math.min(1.25, cameraPitch - deltaY * 0.004));
});

function stopLooking(event) {
  if (event.pointerId !== lookPointerId) return;

  lookPointerId = null;
  grassCanvas.classList.remove('is-looking');
  if (grassCanvas.hasPointerCapture(event.pointerId)) {
    grassCanvas.releasePointerCapture(event.pointerId);
  }
}

grassCanvas.addEventListener('pointerup', stopLooking);
grassCanvas.addEventListener('pointercancel', stopLooking);

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
