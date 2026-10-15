const intro = document.getElementById('intro');
const menu = document.getElementById('menu');
const playButton = document.getElementById('play-button');
const grassGame = document.getElementById('grass-game');
const grassCanvas = document.getElementById('grass-canvas');
const bloodOverlay = document.getElementById('blood-overlay');
const visionBlink = document.getElementById('vision-blink');
const animatronicDeath = document.getElementById('animatronic-death');
const grassStatus = document.getElementById('grass-status');
const grassControls = document.getElementById('grass-controls');
const backButton = document.getElementById('back-button');
const deathRestartButton = document.getElementById('death-restart');

// Character & Grab Sounds
const characterVoice = new Audio('audio/casual-male-voice.mp3');
characterVoice.preload = 'auto';
const grabSound = new Audio('audio/grab-sound.mp3');
grabSound.preload = 'auto';
grabSound.volume = 0.9;

// Shark Animatronic Sound Setup
const sharkSound = new Audio('audio/shark.mp3');
sharkSound.preload = 'auto';

let introFinished = false;
let grassScene = null;
let grassLoading = false;
let grassAnimationFrame = 0;
let lastGrassFrame = 0;
let lampGazeSeconds = 0;
let enteringLivingRoom = false;
let livingRoomLoadFailed = false;
let lastGazeCountdown = 0;
const movementKeys = new Set();
const fieldHalfSize = 52;
let cameraYaw = 0;
let cameraPitch = 0;
let lookPointerId = null;
let lastLookX = 0;
let lastLookY = 0;
let voiceAudioContext = null;
let voiceAnalyser = null;
let voiceSource = null;
let voiceWaveform = null;

function unlockCharacterVoice() {
  if (!window.AudioContext) return;

  try {
    if (!voiceAudioContext) {
      voiceAudioContext = new (window.AudioContext || window.webkitAudioContext)();
      voiceAnalyser = voiceAudioContext.createAnalyser();
      voiceAnalyser.fftSize = 256;
      voiceWaveform = new Uint8Array(voiceAnalyser.fftSize);
      voiceSource = voiceAudioContext.createMediaElementSource(characterVoice);
      voiceSource.connect(voiceAnalyser);
      voiceAnalyser.connect(voiceAudioContext.destination);
    }

    if (voiceAudioContext.state === 'suspended') {
      void voiceAudioContext.resume().catch((error) => {
        console.error('Could not enable character audio:', error);
      });
    }
  } catch (error) {
    console.error('Could not initialize character audio analysis:', error);
  }
}

async function playCharacterVoice() {
  if (voiceAudioContext?.state === 'suspended') {
    await voiceAudioContext.resume();
  }

  characterVoice.currentTime = 0;
  await characterVoice.play();
}

function playGrabSound() {
  grabSound.currentTime = 0;
  return grabSound.play().catch((error) => {
    console.error('Could not play the grab sound:', error);
  });
}

function playShotSound() {
  if (!voiceAudioContext) return;

  if (voiceAudioContext.state === 'suspended') {
    void voiceAudioContext.resume().catch((error) => {
      console.error('Could not enable the shot sound:', error);
    });
  }

  const now = voiceAudioContext.currentTime;
  const duration = 0.2;
  const noiseBuffer = voiceAudioContext.createBuffer(
    1,
    Math.ceil(voiceAudioContext.sampleRate * duration),
    voiceAudioContext.sampleRate
  );
  const noiseSamples = noiseBuffer.getChannelData(0);
  for (let index = 0; index < noiseSamples.length; index += 1) {
    noiseSamples[index] = (Math.random() * 2 - 1) * (1 - index / noiseSamples.length);
  }

  const noise = voiceAudioContext.createBufferSource();
  noise.buffer = noiseBuffer;
  const filter = voiceAudioContext.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2400, now);
  filter.frequency.exponentialRampToValueAtTime(350, now + duration);
  const noiseGain = voiceAudioContext.createGain();
  noiseGain.gain.setValueAtTime(0.75, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  noise.connect(filter).connect(noiseGain).connect(voiceAudioContext.destination);
  noise.start(now);
  noise.stop(now + duration);

  const thump = voiceAudioContext.createOscillator();
  const thumpGain = voiceAudioContext.createGain();
  thump.type = 'sine';
  thump.frequency.setValueAtTime(105, now);
  thump.frequency.exponentialRampToValueAtTime(38, now + 0.16);
  thumpGain.gain.setValueAtTime(0.55, now);
  thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
  thump.connect(thumpGain).connect(voiceAudioContext.destination);
  thump.start(now);
  thump.stop(now + 0.16);
}

function resetBleedingEffect() {
  bloodOverlay.classList.remove('is-hit', 'is-bleeding');
}

function showBleedingEffect() {
  bloodOverlay.classList.remove('is-hit');
  bloodOverlay.classList.add('is-bleeding');
  void bloodOverlay.offsetWidth;
  bloodOverlay.classList.add('is-hit');
  window.setTimeout(() => bloodOverlay.classList.remove('is-hit'), 350);
}

function stopCharacterVoice() {
  characterVoice.pause();
  characterVoice.currentTime = 0;
}

function resetGrabSound() {
  grabSound.pause();
  grabSound.currentTime = 0;
}

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
      AnimationMixer,
      BoxGeometry,
      Box3,
      BufferGeometry,
      CanvasTexture,
      Color,
      CylinderGeometry,
      DirectionalLight,
      DoubleSide,
      Euler,
      Float32BufferAttribute,
      Fog,
      Group,
      HemisphereLight,
      InstancedMesh,
      Matrix4,
      Mesh,
      MeshBasicMaterial,
      MeshStandardMaterial,
      LoopRepeat,
      PerspectiveCamera,
      PlaneGeometry,
      PointLight,
      Points,
      PointsMaterial,
      Quaternion,
      Raycaster,
      RepeatWrapping,
      Scene,
      SRGBColorSpace,
      Shape,
      ShapeGeometry,
      SphereGeometry,
      TextureLoader,
      Vector2,
      Vector3,
      WebGLRenderer
    },
    { GLTFLoader },
    { createCasualMale }
  ] = await Promise.all([
    import('three'),
    import('three/addons/loaders/GLTFLoader.js'),
    import('./casual-male.js?v=freddie-model-6')
  ]);

  const random = () => Math.random();
  const loader = new GLTFLoader();
  const loadModel = (path) => new Promise((resolve, reject) => {
    loader.load(path, resolve, undefined, reject);
  });
  const [gltf, lampGltf] = await Promise.all([
    loadModel('grass/tdcrdbur_tier_3.gltf'),
    loadModel('lamp/scene.gltf')
  ]);
  gltf.scene.updateMatrixWorld(true);
  const variants = gltf.scene.children.filter((child) => /^SM_tdcrdbur_Var[A-F]$/.test(child.name));
  if (variants.length === 0) {
    throw new Error('The grass model contains no usable plant variants.');
  }

  const renderer = new WebGLRenderer({ canvas: grassCanvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  const scene = new Scene();
  scene.background = new Color(0x17243a);
  scene.fog = new Fog(0x202d43, 42, 120);
  scene.add(new HemisphereLight(0x8298c2, 0x302d23, 1.05));

  const moonlight = new DirectionalLight(0xb5c7ea, 0.62);
  moonlight.position.set(-30, 45, 20);
  scene.add(moonlight);

  const starPositions = [];
  for (let index = 0; index < 420; index += 1) {
    starPositions.push(
      (random() - 0.5) * 140,
      12 + random() * 38,
      (random() - 0.5) * 140
    );
  }
  const starGeometry = new BufferGeometry();
  starGeometry.setAttribute('position', new Float32BufferAttribute(starPositions, 3));
  scene.add(new Points(
    starGeometry,
    new PointsMaterial({ color: 0xb8c8e8, size: 0.13, sizeAttenuation: false })
  ));

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
    new MeshStandardMaterial({ map: groundTexture, color: 0x9ca98a, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.06;
  scene.add(ground);

  const lampModel = lampGltf.scene;
  const lampBulb = lampModel.getObjectByName('Lightbulb_Table_Lamp_0')
    ?? lampModel.getObjectByName('Lightbulb');
  if (!lampBulb) {
    throw new Error('The lamp model is missing its bulb mesh.');
  }

  const lampMaterials = [];
  lampBulb.traverse((object) => {
    if (!object.isMesh) return;
    const makeGlowingMaterial = (material) => {
      const glowingMaterial = material.clone();
      glowingMaterial.emissive.set(0xffb84a);
      glowingMaterial.emissiveIntensity = 0.7;
      lampMaterials.push(glowingMaterial);
      return glowingMaterial;
    };
    object.material = Array.isArray(object.material)
      ? object.material.map(makeGlowingMaterial)
      : makeGlowingMaterial(object.material);
  });

  const lampBounds = new Box3().setFromObject(lampModel);
  const lampCenter = lampBounds.getCenter(new Vector3());
  lampModel.position.set(-lampCenter.x, -lampBounds.min.y, -lampCenter.z);
  const lampRoot = new Group();
  lampRoot.add(lampModel);
  lampRoot.scale.setScalar(2.1);
  lampRoot.position.set(0, 0.76, -4.2);
  scene.add(lampRoot);
  lampRoot.updateMatrixWorld(true);
  const lampFocus = new Box3().setFromObject(lampRoot).getCenter(new Vector3());

  const table = new Group();
  const woodMaterial = new MeshStandardMaterial({ color: 0x72543a, roughness: 0.82 });
  const tableTop = new Mesh(new BoxGeometry(1.65, 0.12, 1.3), woodMaterial);
  tableTop.position.set(0, 0.7, -4.2);
  table.add(tableTop);
  for (const x of [-0.62, 0.62]) {
    for (const z of [-0.46, 0.46]) {
      const leg = new Mesh(new BoxGeometry(0.1, 0.7, 0.1), woodMaterial);
      leg.position.set(x, 0.35, -4.2 + z);
      table.add(leg);
    }
  }
  scene.add(table);

  const bulbBounds = new Box3().setFromObject(lampBulb);
  const lampLight = new PointLight(0xffc66c, 2.4, 18, 2);
  lampLight.position.copy(bulbBounds.getCenter(new Vector3()));
  lampLight.position.y += 0.08;
  scene.add(lampLight);
  const gazeRaycaster = new Raycaster();
  const screenCenter = new Vector2(0, 0);
  const encounterStartZ = -2.15;
  const encounterApproachDistance = 1.35;

  let livingRoomPromise = null;
  const buildLivingRoom = async () => {
    const [
      roomGltf,
      couchGltf,
      rifleGltf,
      tableGltf,
      monitorGltf,
      sharkGltf,
      teethGltf,
      brickBaseColor
    ] = await Promise.all([
      loadModel('living-room/scene.gltf'),
      loadModel('couch/scene.gltf'),
      loadModel('hunting-rifle/scene.gltf'),
      loadModel('pizzeria-table/scene.gltf'),
      loadModel('basic-pc-monitors/scene.gltf'),
      loadModel('abandoned-animatronic/shark/scene.gltf'),
      loadModel('abandoned-animatronic/teeth/scene.gltf'),
      new TextureLoader().loadAsync('brick-stack/brick-wall.jpg')
    ]);
    const roomScene = new Scene();
    roomScene.background = new Color(0x10131a);
    roomScene.add(new HemisphereLight(0xffe6cf, 0x38313a, 1.8));

    const roomLight = new DirectionalLight(0xffd7b0, 2.2);
    roomLight.position.set(-3, 7, 4);
    roomScene.add(roomLight);

    const faceLight = new PointLight(0xffd9a3, 1.6, 10, 2);
    faceLight.position.set(0, 2.0, 1.8);
    roomScene.add(faceLight);

    const fillLight = new PointLight(0xbfd1ff, 0.45, 12, 2);
    fillLight.position.set(-2.8, 1.8, 0.6);
    roomScene.add(fillLight);

    const room = roomGltf.scene;
    room.updateMatrixWorld(true);
    const sourceRoomBounds = new Box3().setFromObject(room);
    const roomScale = 0.25;
    room.scale.setScalar(roomScale);
    room.position.set(
      -(sourceRoomBounds.min.x + sourceRoomBounds.max.x) * roomScale / 2,
      -sourceRoomBounds.min.y * roomScale,
      -(sourceRoomBounds.min.z + sourceRoomBounds.max.z) * roomScale / 2
    );
    roomScene.add(room);
    room.updateMatrixWorld(true);
    const roomBounds = new Box3().setFromObject(room);

    const destinationScene = new Scene();
    destinationScene.background = new Color(0x10120f);
    destinationScene.fog = new Fog(0x171914, 11, 32);
    destinationScene.add(new HemisphereLight(0x9ca9b2, 0x28211a, 1.05));

    const brokenRoofLight = new DirectionalLight(0xb7c3c0, 0.9);
    brokenRoofLight.position.set(-4, 8, 3);
    destinationScene.add(brokenRoofLight);

    const moonbeam = new PointLight(0xc2cbd2, 1.6, 11, 2);
    moonbeam.position.set(-3.4, 2.8, -1.8);
    destinationScene.add(moonbeam);

    const concreteMaterial = new MeshStandardMaterial({ color: 0x45463e, roughness: 1 });
    const buildingFloor = new Mesh(new PlaneGeometry(25, 17), concreteMaterial);
    buildingFloor.rotation.x = -Math.PI / 2;
    buildingFloor.position.y = -0.08;
    destinationScene.add(buildingFloor);

    brickBaseColor.colorSpace = SRGBColorSpace;
    brickBaseColor.wrapS = RepeatWrapping;
    brickBaseColor.wrapT = RepeatWrapping;
    const brickGeometry = new BoxGeometry(1, 1, 1);
    const brickMaterial = new MeshStandardMaterial({
      color: 0xe6ded2,
      map: brickBaseColor,
      roughness: 0.98
    });
    const brickSize = new Vector3(1, 1, 1);

    const wallBrick = (axis, plane, span, rows, openings) => {
      const placements = [];
      const sectionWidth = 1.42;
      const sectionHeight = 0.78;
      const wallDepth = 0.5;
      const columns = Math.ceil(span / sectionWidth) + 1;
      const wallRotation = new Quaternion().setFromAxisAngle(
        new Vector3(0, 1, 0),
        axis === 'z' ? Math.PI / 2 : 0
      );

      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const alongWall = -span / 2 + sectionWidth / 2
            + column * sectionWidth + (row % 2) * sectionWidth / 2;
          if (openings.some((opening) => opening(alongWall, row))) continue;
          placements.push({
            x: axis === 'x' ? alongWall : plane,
            y: row * 0.76 + sectionHeight / 2,
            z: axis === 'z' ? alongWall : plane,
            width: sectionWidth * (0.94 + random() * 0.1),
            height: sectionHeight * (0.94 + random() * 0.1),
            depth: wallDepth * (0.94 + random() * 0.1)
          });
        }
      }

      const wall = new InstancedMesh(brickGeometry, brickMaterial, placements.length);
      wall.name = 'weathered brick wall';
      wall.receiveShadow = true;
      const position = new Vector3();
      const scale = new Vector3();
      const transform = new Matrix4();

      placements.forEach((brick, index) => {
        position.set(brick.x, brick.y, brick.z);
        scale.set(
          brick.width / brickSize.x,
          brick.height / brickSize.y,
          brick.depth / brickSize.z
        );
        transform.compose(position, wallRotation, scale);
        wall.setMatrixAt(index, transform);
      });

      wall.instanceMatrix.needsUpdate = true;
      destinationScene.add(wall);
    };

    wallBrick('x', -8, 24, 6, []);
    wallBrick('x', 8, 24, 6, [
      (x, row) => Math.abs(x) < 0.9 && row < 4
    ]);
    const brokenWindowOpening = (position, row) =>
      row >= 2 && row <= 4 && [-4, 4].some((center) => Math.abs(position - center) < 1.35);
    wallBrick('z', -12, 16, 6, [brokenWindowOpening]);
    wallBrick('z', 12, 16, 6, [brokenWindowOpening]);

    const doorway = (...centers) => (position, row) =>
      centers.some((center) => Math.abs(position - center) < 0.9) && row < 4;
    wallBrick('z', -4, 16, 6, [doorway(-4, 4)]);
    wallBrick('z', 4, 16, 6, [doorway(-4, 4)]);
    wallBrick('x', 0, 24, 6, [doorway(-8, 0, 8)]);

    const roomCenters = [
      [-8, -4], [0, -4], [8, -4],
      [-8, 4], [0, 4], [8, 4]
    ];
    const rugMaterials = [
      0x51443a, 0x45483c, 0x51403b,
      0x45423a, 0x4b4339, 0x41453c
    ].map((color) => new MeshStandardMaterial({ color, roughness: 1 }));
    roomCenters.forEach(([x, z], index) => {
      if (index !== 4) {
        const rug = new Mesh(
          new BoxGeometry(3.6, 0.035, 4.2),
          rugMaterials[index]
        );
        rug.name = `abandoned room ${index + 1} rug`;
        rug.position.set(x, -0.06, z);
        destinationScene.add(rug);
      }

      const roomLight = new PointLight(0xc1c7b3, 0.65, 8, 2);
      roomLight.position.set(x, 3.1, z);
      destinationScene.add(roomLight);
    });

    const tileGeometry = new PlaneGeometry(0.96, 0.96);
    const tileMaterial = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.82 });
    const partyFloor = new InstancedMesh(tileGeometry, tileMaterial, 64);
    partyFloor.name = 'red and cream party-room checkerboard';
    const tilePosition = new Vector3();
    const tileRotation = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
    const tileScale = new Vector3(1, 1, 1);
    const tileTransform = new Matrix4();
    const tileColors = [new Color(0xa52c2d), new Color(0xe8d8ad)];
    for (let row = 0; row < 8; row += 1) {
      for (let column = 0; column < 8; column += 1) {
        const index = row * 8 + column;
        tilePosition.set(-3.5 + column, -0.035, 0.5 + row);
        tileTransform.compose(tilePosition, tileRotation, tileScale);
        partyFloor.setMatrixAt(index, tileTransform);
        partyFloor.setColorAt(index, tileColors[(row + column) % 2]);
      }
    }
    partyFloor.instanceMatrix.needsUpdate = true;
    if (partyFloor.instanceColor) partyFloor.instanceColor.needsUpdate = true;
    destinationScene.add(partyFloor);

    const woodMaterial = new MeshStandardMaterial({ color: 0x453629, roughness: 1 });
    const fadedFabric = new MeshStandardMaterial({ color: 0x666151, roughness: 1 });
    const furnishingBox = (name, size, position, material, rotationY = 0) => {
      const furnishing = new Mesh(new BoxGeometry(...size), material);
      furnishing.name = name;
      furnishing.position.set(...position);
      furnishing.rotation.y = rotationY;
      destinationScene.add(furnishing);
      return furnishing;
    };

    const windowFrameMaterial = new MeshStandardMaterial({ color: 0x382b21, roughness: 1 });
    const windowGlassMaterial = new MeshStandardMaterial({
      color: 0x344044,
      roughness: 0.48,
      metalness: 0.12,
      transparent: true,
      opacity: 0.38
    });
    for (const side of [-1, 1]) {
      for (const centerZ of [-4, 4]) {
        furnishingBox('dark broken window recess', [0.12, 1.5, 2.35], [side * 11.98, 2.63, centerZ], windowGlassMaterial);
        furnishingBox('splintered window sill', [0.24, 0.13, 2.9], [side * 11.78, 1.79, centerZ], windowFrameMaterial);
        furnishingBox('weathered window lintel', [0.22, 0.14, 2.9], [side * 11.78, 3.48, centerZ], windowFrameMaterial);
        for (const offset of [-1.34, 1.34]) {
          furnishingBox('rotted window jamb', [0.22, 1.78, 0.14], [side * 11.78, 2.63, centerZ + offset], windowFrameMaterial);
        }
        furnishingBox('broken window crossbar', [0.18, 0.09, 2.55], [side * 11.78, 2.5, centerZ], windowFrameMaterial);
        furnishingBox('loose window board', [0.14, 0.2, 1.45], [side * 11.76, 2.95, centerZ + 0.32], woodMaterial, side * 0.025);
      }
    }

    const kitchenWood = new MeshStandardMaterial({ color: 0x49372a, roughness: 1 });
    const kitchenDoor = new MeshStandardMaterial({ color: 0x594333, roughness: 0.95 });
    const tarnishedMetal = new MeshStandardMaterial({ color: 0x73756d, roughness: 0.72, metalness: 0.42 });
    const darkMetal = new MeshStandardMaterial({ color: 0x252725, roughness: 0.76, metalness: 0.28 });
    const stainedTile = new MeshStandardMaterial({ color: 0x9b927a, roughness: 0.92 });
    const kitchenBox = (name, size, position, material, rotationY = 0) =>
      furnishingBox(name, size, position, material, rotationY);

    kitchenBox('kitchen cabinet carcass', [5.55, 0.82, 0.68], [0, 0.43, -7.18], kitchenWood);
    kitchenBox('cracked kitchen countertop', [5.9, 0.14, 0.88], [0, 0.91, -6.98], tarnishedMetal);
    kitchenBox('grease-stained kitchen backsplash', [5.8, 1.1, 0.1], [0, 1.52, -7.65], stainedTile);
    for (let index = 0; index < 5; index += 1) {
      const x = -2.2 + index * 1.1;
      kitchenBox('warped lower cabinet door', [1.02, 0.66, 0.055], [x, 0.43, -6.81], kitchenDoor);
      kitchenBox('rusted cabinet pull', [0.16, 0.035, 0.045], [x + 0.34, 0.47, -6.76], tarnishedMetal);
    }

    kitchenBox('sagging wall cupboards', [4.25, 1.05, 0.56], [0.15, 2.47, -7.56], kitchenWood);
    for (const x of [-1.35, -0.15, 1.05, 2.25]) {
      kitchenBox('stained upper cupboard door', [1.12, 0.91, 0.06], [x, 2.47, -7.25], kitchenDoor);
      kitchenBox('upper cupboard handle', [0.045, 0.24, 0.045], [x + 0.42, 2.47, -7.19], tarnishedMetal);
    }

    kitchenBox('old range cooker', [1.15, 0.88, 0.74], [-1.72, 0.47, -7.02], darkMetal);
    kitchenBox('range oven door', [0.86, 0.49, 0.045], [-1.72, 0.39, -6.63], tarnishedMetal);
    kitchenBox('oven handle', [0.55, 0.045, 0.06], [-1.72, 0.7, -6.58], darkMetal);
    for (const xOffset of [-0.32, 0.32]) {
      for (const zOffset of [-0.2, 0.2]) {
        const burner = new Mesh(new CylinderGeometry(0.14, 0.14, 0.035, 16), darkMetal);
        burner.name = 'rusty cooker burner';
        burner.position.set(-1.72 + xOffset, 1.01, -7.02 + zOffset);
        destinationScene.add(burner);
      }
    }

    kitchenBox('enamel sink', [1.14, 0.11, 0.6], [1.12, 1.01, -6.98], darkMetal);
    kitchenBox('sink basin', [0.78, 0.08, 0.4], [1.12, 1.08, -6.98], tarnishedMetal);
    const faucetStem = new Mesh(new CylinderGeometry(0.035, 0.045, 0.35, 10), tarnishedMetal);
    faucetStem.name = 'rusting sink faucet';
    faucetStem.position.set(1.12, 1.25, -7.34);
    destinationScene.add(faucetStem);
    kitchenBox('faucet spout', [0.26, 0.045, 0.045], [1.24, 1.39, -7.2], tarnishedMetal);

    kitchenBox('abandoned refrigerator', [1.05, 2.15, 0.92], [3.12, 1.08, -5.25], tarnishedMetal);
    kitchenBox('refrigerator door', [0.96, 1.92, 0.07], [3.12, 1.15, -4.77], kitchenDoor);
    kitchenBox('refrigerator handle', [0.045, 0.68, 0.07], [3.5, 1.38, -4.7], tarnishedMetal);
    kitchenBox('fallen kitchen cupboard door', [0.09, 1.25, 0.74], [-3.35, 0.08, -6.2], kitchenDoor, 0.28);
    kitchenBox('abandoned cooking pot', [0.42, 0.2, 0.42], [0.1, 1.08, -6.98], darkMetal);

    const table = tableGltf.scene;
    table.updateMatrixWorld(true);
    const sourceTableBounds = new Box3().setFromObject(table);
    const sourceTableSize = sourceTableBounds.getSize(new Vector3());
    const tableScale = 2.35 / sourceTableSize.z;
    const tableCenter = sourceTableBounds.getCenter(new Vector3());
    table.scale.setScalar(tableScale);
    table.position.set(
      -tableCenter.x * tableScale,
      -sourceTableBounds.min.y * tableScale,
      -tableCenter.z * tableScale
    );
    for (const x of [-2.15, 2.15]) {
      const partyTable = table.clone(true);
      partyTable.name = 'textured pizzeria party table';
      partyTable.position.x += x;
      partyTable.position.z += 4.2;
      destinationScene.add(partyTable);
    }

    const partyWallStripe = new MeshStandardMaterial({ color: 0x97332c, roughness: 1 });
    const partyGoldStripe = new MeshStandardMaterial({ color: 0xd2a54e, roughness: 0.9 });
    for (const x of [-3.72, 3.72]) {
      furnishingBox('red pizzeria wall stripe', [0.12, 0.46, 7.7], [x, 1.55, 4], partyWallStripe);
      furnishingBox('gold pizzeria wall stripe', [0.13, 0.1, 7.7], [x, 1.84, 4], partyGoldStripe);
    }

    const signCanvas = document.createElement('canvas');
    signCanvas.width = 640;
    signCanvas.height = 240;
    const signContext = signCanvas.getContext('2d');
    if (!signContext) {
      throw new Error('Could not create the pizzeria party-room sign.');
    }
    signContext.fillStyle = '#8f2927';
    signContext.fillRect(0, 0, signCanvas.width, signCanvas.height);
    signContext.strokeStyle = '#f2cd73';
    signContext.lineWidth = 14;
    signContext.strokeRect(10, 10, signCanvas.width - 20, signCanvas.height - 20);
    signContext.textAlign = 'center';
    signContext.fillStyle = '#fff0c8';
    signContext.font = 'bold 94px sans-serif';
    signContext.fillText('PIZZERIA', 320, 112);
    signContext.fillStyle = '#f2cd73';
    signContext.font = 'bold 40px sans-serif';
    signContext.fillText('PARTY ROOM', 320, 184);
    const signTexture = new CanvasTexture(signCanvas);
    signTexture.colorSpace = SRGBColorSpace;
    const partySign = new Mesh(
      new BoxGeometry(3.2, 1.2, 0.12),
      new MeshStandardMaterial({
        map: signTexture,
        emissive: 0xffa63c,
        emissiveMap: signTexture,
        emissiveIntensity: 0.32,
        roughness: 0.75
      })
    );
    partySign.name = 'illuminated pizzeria party-room sign';
    partySign.position.set(0, 3.05, 7.55);
    destinationScene.add(partySign);

    const flagShape = new Shape();
    flagShape.moveTo(-0.28, 0.2);
    flagShape.lineTo(0.28, 0.2);
    flagShape.lineTo(0, -0.3);
    flagShape.closePath();
    const flagGeometry = new ShapeGeometry(flagShape);
    const flagColors = [0xc53931, 0xe5bd56, 0x4b7890, 0xd9d1ae];
    for (let index = 0; index < 12; index += 1) {
      const flag = new Mesh(
        flagGeometry,
        new MeshStandardMaterial({
          color: flagColors[index % flagColors.length],
          roughness: 0.9,
          side: DoubleSide
        })
      );
      flag.name = 'party bunting flag';
      flag.position.set(-3.25 + index * 0.59, 3.75, 7.44);
      destinationScene.add(flag);
    }

    const balloonColors = [0xc93235, 0xe9c650, 0x417b91, 0x6f944c, 0xd98c4d];
    balloonColors.forEach((color, index) => {
      const balloon = new Mesh(
        new SphereGeometry(0.32, 16, 12),
        new MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.04 })
      );
      balloon.name = 'party balloon';
      balloon.scale.set(0.82, 1.14, 0.82);
      balloon.position.set(3.15 + Math.sin(index * 1.25) * 0.34, 2.75 + index * 0.17, 2.6 + Math.cos(index * 1.1) * 0.3);
      destinationScene.add(balloon);
    });

    furnishingBox('collapsed bed frame', [2.6, 0.34, 3.4], [-9.3, 0.34, 4.4], woodMaterial);
    furnishingBox('dusty mattress', [2.5, 0.24, 3.25], [-9.3, 0.63, 4.4], fadedFabric);
    furnishingBox('dusty pillow', [1.25, 0.18, 0.72], [-9.3, 0.82, 5.45], fadedFabric);
    furnishingBox('empty bookcase', [2.8, 2.7, 0.55], [9.7, 1.35, 6.7], woodMaterial);
    furnishingBox('abandoned security-room console', [2.7, 0.18, 1.5], [-9.4, 1.05, -6.1], woodMaterial, Math.PI / 2);

    const securityMonitors = monitorGltf.scene;
    securityMonitors.name = 'widescreen and standard security monitors';
    securityMonitors.updateMatrixWorld(true);
    const sourceMonitorBounds = new Box3().setFromObject(securityMonitors);
    const sourceMonitorSize = sourceMonitorBounds.getSize(new Vector3());
    securityMonitors.rotation.y = -Math.PI / 2;
    securityMonitors.scale.setScalar(1.95 / sourceMonitorSize.x);
    securityMonitors.updateMatrixWorld(true);
    const monitorBounds = new Box3().setFromObject(securityMonitors);
    securityMonitors.position.set(
      -9.4 - (monitorBounds.min.x + monitorBounds.max.x) / 2,
      1.14 - monitorBounds.min.y,
      -6.1 - (monitorBounds.min.z + monitorBounds.max.z) / 2
    );
    destinationScene.add(securityMonitors);

    const securitySignCanvas = document.createElement('canvas');
    securitySignCanvas.width = 512;
    securitySignCanvas.height = 128;
    const securitySignContext = securitySignCanvas.getContext('2d');
    if (!securitySignContext) {
      throw new Error('Could not create the abandoned security-room sign.');
    }
    securitySignContext.translate(securitySignCanvas.width, 0);
    securitySignContext.scale(-1, 1);
    securitySignContext.fillStyle = '#151a17';
    securitySignContext.fillRect(0, 0, securitySignCanvas.width, securitySignCanvas.height);
    securitySignContext.strokeStyle = '#626b59';
    securitySignContext.lineWidth = 6;
    securitySignContext.strokeRect(5, 5, securitySignCanvas.width - 10, securitySignCanvas.height - 10);
    securitySignContext.textAlign = 'center';
    securitySignContext.fillStyle = '#c4cbb4';
    securitySignContext.font = 'bold 38px monospace';
    securitySignContext.fillText('TECH ROOM', 256, 55);
    securitySignContext.fillStyle = '#b64b43';
    securitySignContext.font = 'bold 18px monospace';
    securitySignContext.fillText('CAMERA CONTROL', 256, 91);
    const securitySignTexture = new CanvasTexture(securitySignCanvas);
    securitySignTexture.colorSpace = SRGBColorSpace;
    const securitySign = new Mesh(
      new PlaneGeometry(2.45, 0.62),
      new MeshBasicMaterial({ map: securitySignTexture, side: DoubleSide })
    );
    securitySign.name = 'abandoned security-room sign';
    securitySign.position.set(-11.66, 2.24, -6.1);
    securitySign.rotation.y = Math.PI / 2;
    destinationScene.add(securitySign);

    const monitorGlow = new PointLight(0x92aeb5, 0.28, 4, 2);
    monitorGlow.position.set(-9.1, 1.75, -6.1);
    destinationScene.add(monitorGlow);

    furnishingBox('second collapsed bed frame', [2.6, 0.34, 3.4], [9.2, 0.34, -4.3], woodMaterial);
    furnishingBox('second dusty mattress', [2.5, 0.24, 3.25], [9.2, 0.63, -4.3], fadedFabric);
    furnishingBox('second dusty pillow', [1.25, 0.18, 0.72], [9.2, 0.82, -5.35], fadedFabric);

    const roofBeamMaterial = new MeshStandardMaterial({ color: 0x30271d, roughness: 1 });
    const roofSheetGeometry = new BoxGeometry(3.99, 0.14, 8.78);
    const roofColors = [0x424843, 0x50534b, 0x3b423f, 0x5b4a3d, 0x454943, 0x383d3a];
    const roofMaterials = roofColors.map((color) => new MeshStandardMaterial({
      color,
      roughness: 0.88,
      metalness: 0.24
    }));
    const roofCenterY = 5.3;
    const roofPitch = 0.16;
    const roofHalfSpan = 8.72;
    const roofSideCenter = roofHalfSpan / 2;

    for (const side of [-1, 1]) {
      for (let panel = 0; panel < 6; panel += 1) {
        const sheet = new Mesh(roofSheetGeometry, roofMaterials[(panel * 2 + (side > 0 ? 1 : 0)) % roofMaterials.length]);
        sheet.name = 'weathered corrugated roof sheet';
        sheet.position.set(-10 + panel * 4, roofCenterY, side * roofSideCenter);
        sheet.rotation.x = side * roofPitch;
        destinationScene.add(sheet);
      }

      const rafterGeometry = new BoxGeometry(0.18, 0.2, roofHalfSpan);
      for (let index = 0; index < 7; index += 1) {
        const rafter = new Mesh(rafterGeometry, roofBeamMaterial);
        rafter.name = 'exposed timber roof rafter';
        rafter.position.set(-10 + index * (20 / 6), roofCenterY, side * roofSideCenter);
        rafter.rotation.x = side * roofPitch;
        destinationScene.add(rafter);
      }
    }

    const roofRibMaterial = new MeshStandardMaterial({ color: 0x252c28, roughness: 0.78, metalness: 0.3 });
    const roofRibGeometry = new BoxGeometry(0.055, 0.065, roofHalfSpan);
    for (const side of [-1, 1]) {
      const ribs = new InstancedMesh(roofRibGeometry, roofRibMaterial, 45);
      ribs.name = 'raised seams on corrugated roof';
      for (let index = 0; index < 45; index += 1) {
        const x = -12 + index * (24 / 44);
        const position = new Vector3(x, roofCenterY + 0.09, side * roofSideCenter);
        const rotation = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), side * roofPitch);
        const transform = new Matrix4().compose(position, rotation, new Vector3(1, 1, 1));
        ribs.setMatrixAt(index, transform);
      }
      ribs.instanceMatrix.needsUpdate = true;
      destinationScene.add(ribs);
    }

    const repairMaterial = new MeshStandardMaterial({ color: 0x70483a, roughness: 0.94, metalness: 0.12 });
    for (const [x, side, distance] of [
      [-8.2, -1, 2.4], [-1.8, -1, 5.8], [6.2, -1, 3.3],
      [-5.5, 1, 6.2], [2.8, 1, 2.8], [9.2, 1, 5.1]
    ]) {
      const patch = new Mesh(new BoxGeometry(1.2, 0.08, 1.45), repairMaterial);
      patch.name = 'rusty patch on roof';
      patch.position.set(
        x,
        roofCenterY + (roofSideCenter - distance) * Math.sin(roofPitch) + 0.1,
        side * distance
      );
      patch.rotation.x = side * roofPitch;
      destinationScene.add(patch);
    }

    const ridgeCap = new Mesh(
      new BoxGeometry(25.4, 0.24, 0.48),
      new MeshStandardMaterial({ color: 0x343a35, roughness: 0.82, metalness: 0.32 })
    );
    ridgeCap.name = 'weathered metal roof ridge cap';
    ridgeCap.position.set(0, roofCenterY + roofSideCenter * Math.sin(roofPitch) + 0.04, 0);
    destinationScene.add(ridgeCap);

    const debrisCount = 64;
    const debris = new InstancedMesh(brickGeometry, brickMaterial, debrisCount);
    debris.name = 'fallen bricks and rubble';
    const debrisPosition = new Vector3();
    const debrisRotation = new Quaternion();
    const debrisScale = new Vector3();
    const debrisTransform = new Matrix4();
    const debrisColor = new Color();
    for (let index = 0; index < debrisCount; index += 1) {
      let x = 0;
      let z = 0;
      do {
        x = (random() - 0.5) * 22;
        z = (random() - 0.5) * 14;
      } while (
        Math.hypot(x, z - 4.5) < 1.7
        || (Math.abs(x) < 3.6 && z > 0 && z < 8)
      );

      const width = 0.72 + random() * 0.55;
      const height = 0.3 + random() * 0.34;
      const depth = 0.32 + random() * 0.3;
      debrisPosition.set(x, height / 2, z);
      debrisRotation.setFromAxisAngle(new Vector3(0, 1, 0), random() * Math.PI);
      debrisRotation.multiply(new Quaternion().setFromAxisAngle(
        new Vector3(0, 0, 1),
        (random() - 0.5) * 0.16
      ));
      debrisScale.set(
        width / brickSize.x,
        height / brickSize.y,
        depth / brickSize.z
      );
      debrisTransform.compose(debrisPosition, debrisRotation, debrisScale);
      debris.setMatrixAt(index, debrisTransform);
      debrisColor.setHSL(0.015 + random() * 0.035, 0.28 + random() * 0.2, 0.2 + random() * 0.12);
      debris.setColorAt(index, debrisColor);
    }
    debris.instanceMatrix.needsUpdate = true;
    if (debris.instanceColor) debris.instanceColor.needsUpdate = true;
    destinationScene.add(debris);

    const animatronicRoot = new Group();
    animatronicRoot.name = 'shark animatronic with monster teeth';
    animatronicRoot.position.set(0, 0, 4.8);
    // Set X back to 0 so it stays above the floor
    animatronicRoot.rotation.x = 0; 
    animatronicRoot.rotation.y = -Math.PI / 2;
    animatronicRoot.rotation.z = Math.PI / 2; // Rotates the model upright on its belly

    const shark = sharkGltf.scene;
    shark.updateMatrixWorld(true);
    const sharkBounds = new Box3().setFromObject(shark);
    const sharkSize = sharkBounds.getSize(new Vector3());
    const sharkCenter = sharkBounds.getCenter(new Vector3());
    const sharkScale = 4.2 / Math.max(sharkSize.x, sharkSize.y, sharkSize.z);
    shark.scale.setScalar(sharkScale);
    shark.position.set(
      -sharkCenter.x * sharkScale,
      -sharkBounds.min.y * sharkScale,
      -sharkCenter.z * sharkScale
    );
    animatronicRoot.add(shark);

    const teeth = teethGltf.scene;
    teeth.updateMatrixWorld(true);
    const teethBounds = new Box3().setFromObject(teeth);
    const teethCenter = teethBounds.getCenter(new Vector3());
    const teethSize = teethBounds.getSize(new Vector3());
    const teethScale = 0.9 / Math.max(teethSize.x, teethSize.y, teethSize.z);
    teeth.position.set(
      -teethCenter.x,
      -teethCenter.y,
      -teethCenter.z
    );
    teeth.scale.setScalar(teethScale);
    const teethJaw = new Group();
    teethJaw.name = 'articulated monster-tooth jaw';
    teethJaw.position.set(
      -sharkSize.x * sharkScale * 0.39,
      sharkSize.y * sharkScale * 0.38,
      0
    );
    teethJaw.rotation.y = -Math.PI / 2;
    teethJaw.add(teeth);
    animatronicRoot.add(teethJaw);
    destinationScene.add(animatronicRoot);

    const sharkMixer = new AnimationMixer(shark);
    const sharkAnimation = sharkGltf.animations[0];
    if (sharkAnimation) {
      sharkMixer.clipAction(sharkAnimation).setLoop(LoopRepeat, Infinity).play();
    }

    const animatronicGlow = new PointLight(0xb51f17, 1.4, 6, 2);
    animatronicGlow.position.set(0, 1.4, 4.8);
    destinationScene.add(animatronicGlow);

    const couch = couchGltf.scene;
    couch.updateMatrixWorld(true);
    const sourceCouchBounds = new Box3().setFromObject(couch);
    const couchScale = roomScale * 0.55;
    couch.scale.setScalar(couchScale);
    couch.position.set(
      -(sourceCouchBounds.min.x + sourceCouchBounds.max.x) * couchScale / 2,
      -sourceCouchBounds.min.y * couchScale,
      -1.1 - (sourceCouchBounds.min.z + sourceCouchBounds.max.z) * couchScale / 2
    );
    roomScene.add(couch);

    const character = await createCasualMale();
    character.root.position.set(0, 0, encounterStartZ);
    roomScene.add(character.root);

    const rifle = rifleGltf.scene;
    rifle.updateMatrixWorld(true);
    const rifleBounds = new Box3().setFromObject(rifle);
    const rifleSize = rifleBounds.getSize(new Vector3());
    rifle.scale.setScalar(0.82 / Math.max(rifleSize.x, rifleSize.y, rifleSize.z));
    rifle.updateMatrixWorld(true);
    const normalizedRifleBounds = new Box3().setFromObject(rifle);
    const rifleCenter = normalizedRifleBounds.getCenter(new Vector3());
    rifle.position.set(-rifleCenter.x, -rifleCenter.y, -rifleCenter.z);
    const rifleGrip = new Group();
    rifleGrip.name = 'hunting rifle grip';
    rifleGrip.position.set(0, -0.015, 0.1);
    rifleGrip.rotation.x = Math.PI / 2;
    rifleGrip.add(rifle);
    rifleGrip.visible = false;
    character.rightHand.add(rifleGrip);

    const muzzleFlash = new Mesh(
      new SphereGeometry(1, 12, 8),
      new MeshBasicMaterial({ color: 0xffa33a })
    );
    muzzleFlash.position.set(0, 0, 0.43);
    muzzleFlash.scale.set(0.045, 0.045, 0.16);
    muzzleFlash.visible = false;
    rifleGrip.add(muzzleFlash);

    let encounterStartTime = null;
    let voiceStarted = false;
    let voiceError = false;
    let grabSoundPlayed = false;
    let speechFinishedElapsed = null;
    let shotElapsed = null;
    let transportStartedAt = null;
    let destinationActive = false;
    let animatronicGazeSeconds = 0;
    let animatronicDeathStartedAt = null;
    let animatronicDead = false;
    const animatronicStartPosition = animatronicRoot.position.clone();
    const animatronicLungeDirection = new Vector3();
    const techRoomDoors = [];
    const beginEncounter = () => {
      stopCharacterVoice();
      resetGrabSound();
      resetBleedingEffect();
      visionBlink.classList.remove('is-blinking');
      encounterStartTime = performance.now();
      voiceStarted = false;
      voiceError = false;
      grabSoundPlayed = false;
      speechFinishedElapsed = null;
      shotElapsed = null;
      transportStartedAt = null;
      destinationActive = false;
      animatronicGazeSeconds = 0;
      animatronicDeathStartedAt = null;
      animatronicDead = false;
      animatronicRoot.position.copy(animatronicStartPosition);
      animatronicDeath.hidden = true;
      techRoomDoors.forEach((door) => {
        door.isOpen = false;
        door.hinge.rotation.y = 0;
      });
      rifleGrip.visible = false;
      muzzleFlash.visible = false;
      character.root.position.set(0, 0, encounterStartZ);
      grassStatus.textContent = 'He grabs you...';
      grassStatus.removeAttribute('data-error');
    };

    // Shark Animatronic & Audio Trigger
    const updateAnimatronic = (delta, time) => {
      sharkMixer.update(delta);
      teethJaw.rotation.z = Math.sin(time * 0.004) * 0.14;
      animatronicGlow.intensity = 1.1 + Math.sin(time * 0.006) * 0.3;

      if (!destinationActive || animatronicDead) {
        if (animatronicDeathStartedAt !== null) {
          const lungeProgress = Math.min(1, (time - animatronicDeathStartedAt) / 420);
          animatronicRoot.position
            .copy(animatronicStartPosition)
            .addScaledVector(animatronicLungeDirection, lungeProgress * 2.1);
          if (time - animatronicDeathStartedAt >= 650 && animatronicDeath.hidden) {
            animatronicDeath.hidden = false;
            deathRestartButton.focus();
          }
        }
        return;
      }

      grassScene.camera.updateMatrixWorld();
      grassScene.gazeRaycaster.setFromCamera(grassScene.screenCenter, grassScene.camera);
      const isLookingAtAnimatronic = grassScene.gazeRaycaster
        .intersectObject(animatronicRoot, true)
        .length > 0;

      if (isLookingAtAnimatronic) {
        // Handle Shark Audio Playback
        if (sharkSound.paused) {
          if (voiceAudioContext?.state === 'suspended') {
            void voiceAudioContext.resume().catch(() => {});
          }
          sharkSound.currentTime = 0;
          sharkSound.play().catch((error) => {
            console.warn('Shark audio playback error caught:', error);
          });
        }

        animatronicGazeSeconds += delta;
        const countdown = Math.max(0, Math.ceil(0.9 - animatronicGazeSeconds));
        grassStatus.textContent = countdown > 0
          ? `It noticed you looking. Look away! ${countdown}`
          : 'The shark animatronic lunges...';

        if (animatronicGazeSeconds >= 0.9) {
          animatronicDead = true;
          animatronicDeathStartedAt = time;
          animatronicLungeDirection
            .set(
              grassScene.camera.position.x - animatronicRoot.position.x,
              0,
              grassScene.camera.position.z - animatronicRoot.position.z
            )
            .normalize();
          movementKeys.clear();
        }
      } else {
        animatronicGazeSeconds = 0;
        if (grassStatus.textContent.startsWith('It noticed you looking')) {
          grassStatus.textContent = '';
        }
        // Stop audio if player looks away
        if (!sharkSound.paused) {
          sharkSound.pause();
          sharkSound.currentTime = 0;
        }
      }
    };

    const respawnFromAnimatronic = () => {
      animatronicDeath.hidden = true;
      resetBleedingEffect();
      animatronicGazeSeconds = 0;
      animatronicDeathStartedAt = null;
      animatronicDead = false;
      animatronicRoot.position.copy(animatronicStartPosition);
      destinationActive = true;
      transportStartedAt = performance.now() - 3000;
      movementKeys.clear();
      grassScene.camera.position.set(-8, 1.65, -4);
      cameraYaw = Math.PI;
      cameraPitch = 0;
      grassStatus.textContent = '';
      grassControls.textContent = "WASD / arrows · drag to look · E opens doors · don't look at the shark";
    };

    const updateEncounter = (time) => {
      if (encounterStartTime === null) return 0;
      if (transportStartedAt !== null) {
        const transportElapsed = (time - transportStartedAt) / 1000;
        if (!destinationActive && transportElapsed >= 1.55) {
          destinationActive = true;
          movementKeys.clear();
          grassScene.camera.position.set(-8, 1.65, -4);
          cameraYaw = Math.PI;
          cameraPitch = 0;
        }
        if (transportElapsed >= 2.6) {
          visionBlink.classList.remove('is-blinking');
          grassStatus.textContent = 'You wake up in the tech room.';
          grassControls.textContent = "WASD / arrows · drag to look · E opens doors · don't look at the shark";
        }
        return 0;
      }

      const elapsed = Math.max(0, (time - encounterStartTime) / 1000);
      const approach = Math.max(0, Math.min(1, elapsed / 1.3));
      const reach = Math.max(0, Math.min(1, (elapsed - 0.2) / 1.05));
      const smoothReach = reach * reach * (3 - 2 * reach);
      const handReach = 0.28 + smoothReach * 0.78;
      character.root.position.z = encounterStartZ + approach * encounterApproachDistance;
      character.root.position.y = Math.sin(elapsed * 2.8) * 0.018 * approach;
      character.root.rotation.y = -0.18 + Math.sin(elapsed * 1.8) * 0.08;
      character.torso.rotation.x = -0.08 * approach;
      character.leftShoulder.rotation.x = -1.5 * smoothReach;
      character.rightShoulder.rotation.x = -1.5 * smoothReach;
      character.leftShoulder.rotation.z = -0.32 * smoothReach;
      character.rightShoulder.rotation.z = 0.32 * smoothReach;
      character.leftElbow.rotation.x = 0.95 * smoothReach;
      character.rightElbow.rotation.x = 0.95 * smoothReach;
      character.leftElbow.rotation.z = -0.4 * smoothReach;
      character.rightElbow.rotation.z = 0.4 * smoothReach;
      character.leftHand.position.z = 0.12 + handReach * 0.65;
      character.rightHand.position.z = 0.12 + handReach * 0.65;
      character.leftHand.rotation.x = -1.2 * smoothReach + 0.35;
      character.rightHand.rotation.x = -1.2 * smoothReach + 0.35;
      character.leftHand.rotation.z = -0.9 * smoothReach;
      character.rightHand.rotation.z = 0.9 * smoothReach;
      character.leftHand.rotation.y = 0.48 * smoothReach;
      character.rightHand.rotation.y = -0.48 * smoothReach;
      for (const [index, finger] of character.leftFingers.entries()) {
        finger.rotation.x = -1.2 * smoothReach;
        finger.rotation.z = (index - 1.5) * 0.06 * smoothReach;
        character.rightFingers[index].rotation.x = -1.2 * smoothReach;
        character.rightFingers[index].rotation.z = -(index - 1.5) * 0.06 * smoothReach;
      }
      character.leftThumb.rotation.x = -0.9 * smoothReach;
      character.rightThumb.rotation.x = -0.9 * smoothReach;
      character.leftThumb.rotation.z = -0.85 * smoothReach;
      character.rightThumb.rotation.z = 0.85 * smoothReach;
      character.leftThumb.rotation.y = 0.22 * smoothReach;
      character.rightThumb.rotation.y = -0.22 * smoothReach;

      const impact = Math.max(0, 1 - Math.abs(elapsed - 1.15) / 0.42);
      const aimProgress = speechFinishedElapsed === null
        ? 0
        : Math.max(0, Math.min(1, (elapsed - speechFinishedElapsed - 0.15) / 0.65));
      const smoothAim = aimProgress * aimProgress * (3 - 2 * aimProgress);
      character.rightShoulder.rotation.z = 0.32 * smoothReach - 0.18 * smoothAim;
      character.rightElbow.rotation.x = 0.95 * smoothReach - 0.22 * smoothAim;
      rifleGrip.visible = speechFinishedElapsed !== null;

      if (!voiceStarted && elapsed >= 1.15) {
        voiceStarted = true;
        if (!grabSoundPlayed) {
          grabSoundPlayed = true;
          void playGrabSound();
        }
        grassStatus.textContent = 'The man is speaking...';
        void playCharacterVoice().catch((error) => {
          console.error('Could not play the character voice:', error);
          voiceError = true;
          grassStatus.textContent = 'Could not play the character audio. Check your browser audio settings.';
          grassStatus.dataset.error = 'true';
        });
      }

      let mouthOpening = 0;
      if (voiceStarted && !characterVoice.paused && voiceAnalyser && voiceWaveform) {
        voiceAnalyser.getByteTimeDomainData(voiceWaveform);
        let amplitude = 0;
        for (const sample of voiceWaveform) {
          const centered = (sample - 128) / 128;
          amplitude += centered * centered;
        }
        mouthOpening = Math.min(1, Math.max(0, (Math.sqrt(amplitude / voiceWaveform.length) - 0.015) * 8));
      } else if (voiceStarted && !characterVoice.paused) {
        mouthOpening = 0.12 + Math.abs(Math.sin(time * 0.024)) * 0.48;
      }
      character.mouth.scale.y = 0.35 + mouthOpening * 2.8;
      character.jaw.rotation.x = -mouthOpening * 0.34;
      character.head.rotation.x = Math.sin(time * 0.003) * mouthOpening * 0.08 - mouthOpening * 0.08;
      character.head.rotation.y = Math.sin(time * 0.0018) * 0.035;

      if (voiceStarted && speechFinishedElapsed === null && (characterVoice.ended || voiceError)) {
        speechFinishedElapsed = elapsed;
        character.mouth.scale.y = 0.35;
        character.jaw.rotation.x = 0;
        grassStatus.textContent = 'He raises his rifle...';
      }

      if (speechFinishedElapsed !== null && shotElapsed === null && elapsed - speechFinishedElapsed >= 1.2) {
        shotElapsed = elapsed;
        muzzleFlash.visible = true;
        grassStatus.textContent = 'You have been shot. You are bleeding...';
        showBleedingEffect();
        playShotSound();
        transportStartedAt = time;
        visionBlink.classList.remove('is-blinking');
        void visionBlink.offsetWidth;
        visionBlink.classList.add('is-blinking');
        grassStatus.textContent = 'You have been shot. Your vision flickers...';
      }

      if (shotElapsed !== null && elapsed - shotElapsed >= 0.12) {
        muzzleFlash.visible = false;
      }

      const shotImpact = shotElapsed === null
        ? 0
        : Math.max(0, 1 - (elapsed - shotElapsed) / 0.8);
      const voiceIntensity = voiceStarted && !characterVoice.ended && !voiceError ? 0.18 : 0;
      return Math.max(impact, voiceIntensity, shotImpact);
    };

    const interiorWalls = [
      { axis: 'x', position: -4, doorways: [-4, 4] },
      { axis: 'x', position: 4, doorways: [-4, 4] },
      { axis: 'z', position: 0, doorways: [-8, 0, 8] }
    ];
    const addTechRoomDoor = (axis, position, center, hingeRotation) => {
      const hinge = new Group();
      hinge.name = 'tech-room exit door hinge';
      if (axis === 'x') {
        hinge.position.set(position, 0, center - 0.8);
      } else {
        hinge.position.set(center - 0.8, 0, position);
      }

      const doorPanel = new Mesh(
        new BoxGeometry(axis === 'x' ? 0.14 : 1.6, 2.95, axis === 'x' ? 1.6 : 0.14),
        new MeshStandardMaterial({ color: 0x493a2c, roughness: 0.96 })
      );
      doorPanel.name = 'weathered tech-room door';
      doorPanel.position.set(axis === 'x' ? 0 : 0.8, 1.5, axis === 'x' ? 0.8 : 0);
      hinge.add(doorPanel);
      destinationScene.add(hinge);
      techRoomDoors.push({ axis, position, center, hinge, hingeRotation, isOpen: false });
    };
    addTechRoomDoor('x', -4, -4, Math.PI / 2);
    addTechRoomDoor('z', 0, -8, -Math.PI / 2);
    const openNearbyTechRoomDoor = (x, z) => {
      const nearbyDoor = techRoomDoors.find((door) =>
        !door.isOpen && Math.hypot(x - (door.axis === 'x' ? door.position : door.center),
          z - (door.axis === 'x' ? door.center : door.position)) < 2.2
      );
      if (!nearbyDoor) return false;

      nearbyDoor.isOpen = true;
      nearbyDoor.hinge.rotation.y = nearbyDoor.hingeRotation;
      return true;
    };
    const isClosedTechRoomDoor = (axis, position, center) =>
      techRoomDoors.some((door) =>
        !door.isOpen
        && door.axis === axis
        && door.position === position
        && Math.abs(door.center - center) < 0.01
      );
    const canMoveTo = (fromX, fromZ, toX, toZ) => interiorWalls.every((wall) => {
      const from = wall.axis === 'x' ? fromX : fromZ;
      const to = wall.axis === 'x' ? toX : toZ;
      const movingTowardWall = Math.abs(to - wall.position) < Math.abs(from - wall.position);
      const reachesWall = Math.min(
        Math.abs(from - wall.position),
        Math.abs(to - wall.position)
      ) < 0.3 || (from - wall.position) * (to - wall.position) < 0;
      if (!movingTowardWall || !reachesWall) return true;

      const openingPosition = wall.axis === 'x' ? toZ : toX;
      const doorway = wall.doorways.find((center) => Math.abs(openingPosition - center) < 0.8);
      return doorway !== undefined && !isClosedTechRoomDoor(wall.axis, wall.position, doorway);
    });

    return {
      scene: roomScene,
      minX: roomBounds.min.x + 0.25,
      maxX: roomBounds.max.x - 0.25,
      minZ: roomBounds.min.z + 0.25,
      maxZ: roomBounds.max.z - 0.25,
      destinationScene,
      destinationBounds: { minX: -11.25, maxX: 11.25, minZ: -7.25, maxZ: 7.25 },
      canMoveTo,
      openNearbyTechRoomDoor,
      beginEncounter,
      get isDestinationActive() {
        return destinationActive;
      },
      get isPlayerDead() {
        return animatronicDead;
      },
      get characterPositionZ() {
        return character.root.position.z;
      },
      updateEncounter,
      updateAnimatronic,
      respawnFromAnimatronic
    };
  };
  const loadLivingRoom = () => {
    if (!livingRoomPromise) {
      livingRoomPromise = buildLivingRoom().catch((error) => {
        livingRoomPromise = null;
        throw error;
      });
    }
    return livingRoomPromise;
  };

  const variantSources = variants.map((variant) => {
    const sources = [];
    variant.traverse((object) => {
      if (object.isMesh) sources.push(object);
    });
    return sources;
  });
  const fieldRows = 48;
  const spacing = 1.5;
  const positionsByVariant = variants.map(() => []);

  for (let row = 0; row < fieldRows; row += 1) {
    for (let column = 0; column < fieldRows; column += 1) {
      const x = (column - (fieldRows - 1) / 2) * spacing;
      const z = (row - (fieldRows - 1) / 2) * spacing;
      if (Math.hypot(x, z + 4.2) < 1.5) continue;

      const variantIndex = Math.floor(random() * variants.length);
      positionsByVariant[variantIndex].push({
        x: x + (random() - 0.5) * 0.45,
        z: z + (random() - 0.5) * 0.45,
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
  const bladeChunkRows = 6;
  const bladeChunkCount = bladeChunkRows * bladeChunkRows;
  const bladeCount = 8000;
  const bladesPerChunk = Array.from({ length: bladeChunkCount }, () => []);

  for (let index = 0; index < bladeCount; index += 1) {
    const x = (random() - 0.5) * fieldRows * spacing;
    const z = (random() - 0.5) * fieldRows * spacing;
    if (Math.hypot(x, z + 4.2) < 1.5) continue;

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
  camera.position.set(0, 1.7, 0);
  camera.rotation.order = 'YXZ';
  const spawnYaw = Math.atan2(-lampFocus.x, -lampFocus.z);
  const spawnPitch = Math.atan2(
    lampFocus.y - camera.position.y,
    Math.hypot(lampFocus.x - camera.position.x, lampFocus.z - camera.position.z)
  );
  camera.rotation.set(spawnPitch, spawnYaw, 0, 'YXZ');

  return {
    renderer,
    scene,
    camera,
    windUniforms,
    lampLight,
    lampRoot,
    gazeRaycaster,
    screenCenter,
    loadLivingRoom,
    preloadLivingRoom: loadLivingRoom,
    livingRoom: null,
    livingRoomPreloadStarted: false,
    spawnYaw,
    spawnPitch
  };
}

function setSeatedLivingRoomView() {
  if (!grassScene) return;

  grassScene.camera.position.set(0, 0.82, 1.6);
  cameraYaw = 0;
  cameraPitch = Math.atan2(0.7 - 0.82, 2.2);
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
  const grabIntensity = grassScene.livingRoom?.updateEncounter(time) ?? 0;
  const isInDestination = grassScene.livingRoom?.isDestinationActive === true;
  let forward = Number(movementKeys.has('KeyW') || movementKeys.has('ArrowUp'))
    - Number(movementKeys.has('KeyS') || movementKeys.has('ArrowDown'));
  let strafe = Number(movementKeys.has('KeyD') || movementKeys.has('ArrowRight'))
    - Number(movementKeys.has('KeyA') || movementKeys.has('ArrowLeft'));
  const minX = grassScene.livingRoom?.minX ?? -fieldHalfSize;
  const maxX = grassScene.livingRoom?.maxX ?? fieldHalfSize;
  const minZ = grassScene.livingRoom?.minZ ?? -fieldHalfSize;
  const maxZ = grassScene.livingRoom?.maxZ ?? fieldHalfSize;
  if (isInDestination) {
    const bounds = grassScene.livingRoom.destinationBounds;
    const length = Math.hypot(forward, strafe) || 1;
    const speed = 4 * delta / length;
    const forwardX = -Math.sin(cameraYaw);
    const forwardZ = -Math.cos(cameraYaw);
    const rightX = Math.cos(cameraYaw);
    const rightZ = -Math.sin(cameraYaw);
    const nextX = Math.max(
      bounds.minX,
      Math.min(bounds.maxX, grassScene.camera.position.x + (forward * forwardX + strafe * rightX) * speed)
    );
    const nextZ = Math.max(
      bounds.minZ,
      Math.min(bounds.maxZ, grassScene.camera.position.z + (forward * forwardZ + strafe * rightZ) * speed)
    );
    const canMoveTo = grassScene.livingRoom.canMoveTo;
    if (canMoveTo(grassScene.camera.position.x, grassScene.camera.position.z, nextX, grassScene.camera.position.z)) {
      grassScene.camera.position.x = nextX;
    }
    if (canMoveTo(grassScene.camera.position.x, grassScene.camera.position.z, grassScene.camera.position.x, nextZ)) {
      grassScene.camera.position.z = nextZ;
    }
  } else if (grassScene.livingRoom) {
    movementKeys.clear();
    forward = 0;
    strafe = 0;
    grassScene.camera.position.x = 0;
    grassScene.camera.position.z = 1.6;
    grassScene.camera.position.y = 0.82;
  } else {
    const length = Math.hypot(forward, strafe) || 1;
    const speed = 7 * delta / length;
    const forwardX = -Math.sin(cameraYaw);
    const forwardZ = -Math.cos(cameraYaw);
    const rightX = Math.cos(cameraYaw);
    const rightZ = -Math.sin(cameraYaw);
    grassScene.camera.position.x = Math.max(
      minX,
      Math.min(maxX, grassScene.camera.position.x + (forward * forwardX + strafe * rightX) * speed)
    );
    grassScene.camera.position.z = Math.max(
      minZ,
      Math.min(maxZ, grassScene.camera.position.z + (forward * forwardZ + strafe * rightZ) * speed)
    );
  }

  grassScene.camera.rotation.set(cameraPitch, cameraYaw, 0, 'YXZ');
  if (isInDestination) {
    grassScene.livingRoom.updateAnimatronic(delta, time);
    if (grassScene.livingRoom.isPlayerDead) {
      movementKeys.clear();
      forward = 0;
      strafe = 0;
    }
  }
  if (grassScene.livingRoom && !isInDestination) {
    const approach = Math.max(0, Math.min(1, (grassScene.livingRoom.characterPositionZ + 0.65) / 1.35));
    grassScene.camera.rotation.x += approach * 0.4;
    grassScene.camera.position.x += Math.sin(time * 0.035) * grabIntensity * 0.045;
    grassScene.camera.position.y += (Math.sin(time * 0.027) - 0.5) * grabIntensity * 0.06;
    grassScene.camera.position.z += (Math.cos(time * 0.031) - 1) * grabIntensity * 0.07;
    grassScene.camera.rotation.x += Math.sin(time * 0.035) * grabIntensity * 0.045;
    grassScene.camera.rotation.y += Math.sin(time * 0.027) * grabIntensity * 0.035;
  }
  grassScene.windUniforms.time.value = time * 0.001;
  if (!grassScene.livingRoom && !enteringLivingRoom) {
    grassScene.camera.updateMatrixWorld();
    grassScene.gazeRaycaster.setFromCamera(grassScene.screenCenter, grassScene.camera);
    const isLookingAtLamp = grassScene.gazeRaycaster
      .intersectObject(grassScene.lampRoot, true)
      .length > 0;

    if (isLookingAtLamp) {
      if (!grassScene.livingRoomPreloadStarted) {
        grassScene.livingRoomPreloadStarted = true;
        void grassScene.preloadLivingRoom().catch((error) => {
          console.error('Could not preload the living room and couch:', error);
        });
      }

      if (!livingRoomLoadFailed) {
        lampGazeSeconds += delta;
        const countdown = Math.ceil(3 - lampGazeSeconds);
        if (countdown !== lastGazeCountdown) {
          lastGazeCountdown = countdown;
          grassStatus.textContent = `Keep the lamp in view for ${countdown} second${countdown === 1 ? '' : 's'}...`;
        }

        if (lampGazeSeconds >= 3) {
          enteringLivingRoom = true;
          grassStatus.textContent = 'Entering the living room...';
          movementKeys.clear();
          void grassScene.loadLivingRoom()
            .then((livingRoom) => {
              grassScene.livingRoom = livingRoom;
              setSeatedLivingRoomView();
              livingRoom.beginEncounter();
              grassControls.textContent = 'Drag to look around the living room from the couch';
            })
            .catch((error) => {
              const message = error instanceof Error ? error.message : String(error);
              console.error('Could not load the living room and couch:', error);
              grassStatus.textContent = `Could not load the living room and couch: ${message}`;
              grassStatus.dataset.error = 'true';
              livingRoomLoadFailed = true;
              lampGazeSeconds = 0;
              lastGazeCountdown = 0;
            })
            .finally(() => {
              enteringLivingRoom = false;
            });
        }
      }
    } else {
      lampGazeSeconds = 0;
      livingRoomLoadFailed = false;
      lastGazeCountdown = 0;
      grassStatus.textContent = '';
      grassStatus.removeAttribute('data-error');
    }
  }
  const activeScene = isInDestination
    ? grassScene.livingRoom.destinationScene
    : grassScene.livingRoom?.scene ?? grassScene.scene;
  grassScene.renderer.render(activeScene, grassScene.camera);
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
  unlockCharacterVoice();
  menu.hidden = true;
  grassGame.hidden = false;
  movementKeys.clear();
  grassStatus.textContent = '';
  grassStatus.removeAttribute('data-error');

  if (grassScene) {
    if (grassScene.livingRoom) {
      setSeatedLivingRoomView();
      grassScene.livingRoom.beginEncounter();
      grassControls.textContent = 'Drag to look around the living room from the couch';
    } else {
      cameraYaw = grassScene.spawnYaw;
      cameraPitch = grassScene.spawnPitch;
      grassControls.textContent = 'WASD / arrows to move · drag to look · keep the lamp in view for 3 seconds';
    }
    lampGazeSeconds = 0;
    livingRoomLoadFailed = false;
    lastGazeCountdown = 0;
    startGrassScene();
    return;
  }

  if (grassLoading) return;
  grassLoading = true;
  grassStatus.textContent = 'Loading the field and lamp...';

  try {
    grassScene = await createGrassScene();
    cameraYaw = grassScene.spawnYaw;
    cameraPitch = grassScene.spawnPitch;
    grassStatus.textContent = '';
    startGrassScene();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Could not load the grass field and lamp:', error);
    grassStatus.textContent = `Could not load the field and lamp: ${message}`;
    grassStatus.dataset.error = 'true';
  } finally {
    grassLoading = false;
  }
});

deathRestartButton.addEventListener('click', () => {
  grassScene?.livingRoom?.respawnFromAnimatronic();
});

backButton.addEventListener('click', () => {
  grassGame.hidden = true;
  menu.hidden = false;
  stopCharacterVoice();
  visionBlink.classList.remove('is-blinking');
  movementKeys.clear();
  lampGazeSeconds = 0;
  livingRoomLoadFailed = false;
  lastGazeCountdown = 0;
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
  if (event.code === 'KeyE') {
    if (!event.repeat && grassScene?.livingRoom?.isDestinationActive) {
      event.preventDefault();
      const openedDoor = grassScene.livingRoom.openNearbyTechRoomDoor(
        grassScene.camera.position.x,
        grassScene.camera.position.z
      );
      grassStatus.textContent = openedDoor
        ? 'The tech-room door creaks open.'
        : 'Move closer to a closed tech-room door to open it.';
    }
    return;
  }
  const movementCode = /^(Key[WASD]|Arrow(?:Up|Down|Left|Right))$/.test(event.code);
  if (!movementCode) return;

  event.preventDefault();
  if (grassScene?.livingRoom
    && (!grassScene.livingRoom.isDestinationActive || grassScene.livingRoom.isPlayerDead)) return;
  movementKeys.add(event.code);
});

window.addEventListener('keyup', (event) => {
  movementKeys.delete(event.code);
});

window.addEventListener('blur', () => movementKeys.clear());
window.addEventListener('resize', resizeGrassScene);