const intro = document.getElementById('intro');
const menu = document.getElementById('menu');
const playButton = document.getElementById('play-button');
const gameScreen = document.getElementById('game-screen');
const gameCanvas = document.getElementById('game-canvas');
const bloodOverlay = document.getElementById('blood-overlay');
const maskOverlay = document.getElementById('mask-overlay');
const visionBlink = document.getElementById('vision-blink');
const animatronicDeath = document.getElementById('animatronic-death');
const gameStatus = document.getElementById('game-status');
const gameControls = document.getElementById('game-controls');
const maskToggleButton = document.getElementById('mask-toggle');
const backButton = document.getElementById('back-button');
const deathRestartButton = document.getElementById('death-restart');
const graphicsResetMessage = 'Graphics paused after a device reset. Waiting for recovery...';
const gamePixelRatioLimit = 1.25;

// Passcode UI Elements
const passcodeContainer = document.getElementById('passcode-container');
const passcodeInput = document.getElementById('passcode-input');
const passcodeError = document.getElementById('passcode-error');

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
let gameScene = null;
let gameLoading = false;
let gameAnimationFrame = 0;
let lastGameFrame = 0;
const movementKeys = new Set();
let cameraYaw = 0;
let cameraPitch = 0;
let lookPointerId = null;
let lastLookX = 0;
let lastLookY = 0;
let maskWorn = false;
let voiceAudioContext = null;
let voiceAnalyser = null;
let voiceSource = null;
let voiceWaveform = null;

function setMaskWorn(worn) {
  maskWorn = worn;
  maskOverlay.classList.toggle('is-worn', maskWorn);
  maskToggleButton.setAttribute('aria-pressed', String(maskWorn));
  maskToggleButton.textContent = maskWorn ? 'Remove mask (M)' : 'Wear mask (M)';
}

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
  if (passcodeInput) {
    window.setTimeout(() => passcodeInput.focus(), 100);
  }
}

window.setTimeout(finishIntro, 2200);

async function createGameScene() {
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
      PCFSoftShadowMap,
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
    { RoundedBoxGeometry },
    { createSurfaceDetail },
    { createCasualMale }
  ] = await Promise.all([
    import('three'),
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/geometries/RoundedBoxGeometry.js'),
    import('./surface-detail.js?v=texture-memory-2'),
    import('./casual-male.js?v=freddie-model-6')
  ]);

  const random = () => Math.random();
  const loader = new GLTFLoader();
  const loadModel = (path) => new Promise((resolve, reject) => {
    loader.load(path, resolve, undefined, reject);
  });
  const renderer = new WebGLRenderer({
    canvas: gameCanvas,
    antialias: true,
    powerPreference: 'low-power'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, gamePixelRatioLimit));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  const surfaceDetail = createSurfaceDetail(renderer);

  const configureSceneShadows = (targetScene) => {
    targetScene.traverse((object) => {
      if (!object.isMesh) return;

      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      object.receiveShadow = true;
      object.castShadow = !object.isInstancedMesh
        && materials.length > 0
        && materials.every((material) => !material.transparent && material.opacity === 1);
    });
  };

  const gazeRaycaster = new Raycaster();
  const screenCenter = new Vector2(0, 0);
  const camera = new PerspectiveCamera(72, 1, 0.1, 140);
  camera.rotation.order = 'YXZ';
  let lastAnimatronicLookCheck = -Infinity;
  let isLookingAtAnimatronic = false;
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
      diabolusRexGltf,
      teethGltf,
      techRoomDoorGltf,
      wallGltf
    ] = await Promise.all([
      loadModel('living-room/scene.gltf'),
      loadModel('couch/scene.gltf'),
      loadModel('hunting-rifle/scene.gltf'),
      loadModel('pizzeria-table/scene.gltf'),
      loadModel('basic-pc-monitors/scene.gltf'),
      loadModel('abandoned-animatronic/shark/scene.gltf'),
      loadModel('diabolus-rex/scene.gltf'),
      loadModel('abandoned-animatronic/teeth/scene.gltf'),
      loadModel('industrial-abandonedfactory-door/SM_xengfcss_tier_2.gltf'),
      loadModel('church-brick-wall/scene.gltf')
    ]);
    const roomScene = new Scene();
    roomScene.background = new Color(0x10131a);
    roomScene.add(new HemisphereLight(0xffe6cf, 0x38313a, 1.8));

    const roomLight = new DirectionalLight(0xffd7b0, 2.2);
    roomLight.position.set(-3, 7, 4);
    roomLight.castShadow = true;
    roomLight.shadow.mapSize.set(1024, 1024);
    roomLight.shadow.camera.left = -12;
    roomLight.shadow.camera.right = 12;
    roomLight.shadow.camera.top = 12;
    roomLight.shadow.camera.bottom = -12;
    roomLight.shadow.camera.near = 0.1;
    roomLight.shadow.camera.far = 40;
    roomLight.shadow.normalBias = 0.035;
    roomLight.shadow.camera.updateProjectionMatrix();
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
    brokenRoofLight.castShadow = true;
    brokenRoofLight.shadow.mapSize.set(2048, 2048);
    brokenRoofLight.shadow.camera.left = -34;
    brokenRoofLight.shadow.camera.right = 34;
    brokenRoofLight.shadow.camera.top = 28;
    brokenRoofLight.shadow.camera.bottom = -28;
    brokenRoofLight.shadow.camera.near = 0.1;
    brokenRoofLight.shadow.camera.far = 100;
    brokenRoofLight.shadow.normalBias = 0.04;
    brokenRoofLight.shadow.camera.updateProjectionMatrix();
    destinationScene.add(brokenRoofLight);

    const moonbeam = new PointLight(0xc2cbd2, 1.6, 11, 2);
    moonbeam.position.set(-3.4, 2.8, -1.8);
    destinationScene.add(moonbeam);

    const roomSize = 12;
    const roomColumnCenters = [-24, -12, 0, 12, 24];
    const roomRowCenters = [-18, -6, 6, 18];
    const buildingHalfWidth = roomColumnCenters.length * roomSize / 2;
    const buildingHalfDepth = roomRowCenters.length * roomSize / 2;
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 512;
    floorCanvas.height = 512;
    const floorContext = floorCanvas.getContext('2d');
    if (!floorContext) {
      throw new Error('Could not create the abandoned building floor texture.');
    }
    floorContext.fillStyle = '#45463e';
    floorContext.fillRect(0, 0, floorCanvas.width, floorCanvas.height);
    for (let index = 0; index < 4600; index += 1) {
      floorContext.globalAlpha = 0.06 + random() * 0.17;
      floorContext.fillStyle = ['#191c19', '#706c5a', '#302e28'][Math.floor(random() * 3)];
      floorContext.beginPath();
      floorContext.ellipse(
        random() * floorCanvas.width,
        random() * floorCanvas.height,
        0.4 + random() * 5,
        0.4 + random() * 2.8,
        random() * Math.PI,
        0,
        Math.PI * 2
      );
      floorContext.fill();
    }
    floorContext.globalAlpha = 1;
    for (let index = 0; index < 55; index += 1) {
      const x = random() * floorCanvas.width;
      const y = random() * floorCanvas.height;
      floorContext.strokeStyle = 'rgba(24, 25, 21, 0.3)';
      floorContext.lineWidth = 0.5 + random();
      floorContext.beginPath();
      floorContext.moveTo(x, y);
      floorContext.lineTo(x + (random() - 0.5) * 32, y + 3 + random() * 22);
      floorContext.stroke();
    }
    const floorTexture = new CanvasTexture(floorCanvas);
    floorTexture.colorSpace = SRGBColorSpace;
    const concreteMaterial = new MeshStandardMaterial({
      map: floorTexture,
      color: 0xffffff,
      roughness: 1
    });
    const buildingFloor = new Mesh(
      new PlaneGeometry(buildingHalfWidth * 2 + 1, buildingHalfDepth * 2 + 1),
      concreteMaterial
    );
    buildingFloor.rotation.x = -Math.PI / 2;
    buildingFloor.position.y = -0.08;
    destinationScene.add(buildingFloor);

    const dustCount = 180;
    const dustPositions = new Float32Array(dustCount * 3);
    for (let index = 0; index < dustCount; index += 1) {
      dustPositions[index * 3] = (random() - 0.5) * buildingHalfWidth * 2;
      dustPositions[index * 3 + 1] = 0.35 + random() * 4.8;
      dustPositions[index * 3 + 2] = (random() - 0.5) * buildingHalfDepth * 2;
    }
    const dustGeometry = new BufferGeometry();
    dustGeometry.setAttribute('position', new Float32BufferAttribute(dustPositions, 3));
    const dustMotes = new Points(
      dustGeometry,
      new PointsMaterial({
        color: 0xc3b99a,
        size: 0.045,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.34,
        depthWrite: false
      })
    );
    dustMotes.name = 'dust drifting through the ruined building';
    destinationScene.add(dustMotes);

    wallGltf.scene.updateMatrixWorld(true);
    const sourceWallMeshes = [];
    wallGltf.scene.traverse((object) => {
      if (object.isMesh) sourceWallMeshes.push(object);
    });
    if (sourceWallMeshes.length !== 1) {
      throw new Error('The abandoned-building wall model must contain exactly one mesh.');
    }

    const sourceWallMesh = sourceWallMeshes[0];
    const wallGeometry = sourceWallMesh.geometry.clone();
    wallGeometry.applyMatrix4(sourceWallMesh.matrixWorld);
    wallGeometry.computeBoundingBox();
    const wallSize = wallGeometry.boundingBox.getSize(new Vector3());
    const wallCenter = wallGeometry.boundingBox.getCenter(new Vector3());
    wallGeometry.translate(-wallCenter.x, -wallCenter.y, -wallCenter.z);
    wallGeometry.computeBoundingBox();
    wallGeometry.computeBoundingSphere();

    const wallHeight = 6 * 0.76;
    const wallDepth = 0.5;
    const wallPanels = [];
    const wallWithOpenings = (axis, plane, span, openings) => {
      const maxPanelWidth = wallSize.x;
      const addPanelRange = (start, end, bottom, top) => {
        if (end - start <= 0.01 || top - bottom <= 0.01) return;
        const panelCount = Math.ceil((end - start) / maxPanelWidth);
        const panelWidth = (end - start) / panelCount;
        for (let index = 0; index < panelCount; index += 1) {
          wallPanels.push({
            axis,
            plane,
            along: start + panelWidth * (index + 0.5),
            width: panelWidth,
            height: top - bottom,
            y: (bottom + top) / 2
          });
        }
      };

      let cursor = -span / 2;
      openings
        .slice()
        .sort((left, right) => left.center - right.center)
        .forEach((opening) => {
          const left = opening.center - opening.width / 2;
          const right = opening.center + opening.width / 2;
          addPanelRange(cursor, left, 0, wallHeight);
          addPanelRange(left, right, 0, opening.bottom);
          addPanelRange(left, right, opening.top, wallHeight);
          cursor = right;
        });
      addPanelRange(cursor, span / 2, 0, wallHeight);
    };

    const buildingWidth = buildingHalfWidth * 2;
    const buildingDepth = buildingHalfDepth * 2;
    wallWithOpenings('x', -buildingHalfDepth, buildingWidth, []);
    wallWithOpenings('x', buildingHalfDepth, buildingWidth, []);
    const windowOpenings = roomRowCenters.map((center) => ({
      center,
      width: 2.7,
      bottom: 1.52,
      top: 3.8
    }));
    wallWithOpenings('z', -buildingHalfWidth, buildingDepth, windowOpenings);
    wallWithOpenings('z', buildingHalfWidth, buildingDepth, windowOpenings);

    const doorOpenings = (centers) => centers.map((center) => ({
      center,
      width: 1.8,
      bottom: 0,
      top: 4 * 0.76
    }));
    roomRowCenters.slice(0, -1).forEach((center) => {
      wallWithOpenings('x', center + roomSize / 2, buildingWidth, doorOpenings(roomColumnCenters));
    });
    roomColumnCenters.slice(0, -1).forEach((center) => {
      wallWithOpenings('z', center + roomSize / 2, buildingDepth, doorOpenings(roomRowCenters));
    });

    const walls = new InstancedMesh(
      wallGeometry,
      sourceWallMesh.material,
      wallPanels.length
    );
    walls.name = 'weathered modeled masonry walls';
    walls.matrixAutoUpdate = false;
    const wallRotation = new Quaternion();
    const wallPosition = new Vector3();
    const wallScale = new Vector3();
    const wallTransform = new Matrix4();
    wallPanels.forEach((panel, index) => {
      wallPosition.set(
        panel.axis === 'x' ? panel.along : panel.plane,
        panel.y,
        panel.axis === 'z' ? panel.along : panel.plane
      );
      wallRotation.setFromAxisAngle(
        new Vector3(0, 1, 0),
        panel.axis === 'z' ? Math.PI / 2 : 0
      );
      wallScale.set(
        panel.width / wallSize.x,
        panel.height / wallSize.y,
        wallDepth / wallSize.z
      );
      wallTransform.compose(wallPosition, wallRotation, wallScale);
      walls.setMatrixAt(index, wallTransform);
    });
    walls.instanceMatrix.needsUpdate = true;
    destinationScene.add(walls);

    const roomCenters = roomRowCenters.flatMap((z) =>
      roomColumnCenters.map((x) => [x, z])
    );
    const rugPalette = [0x51443a, 0x45483c, 0x51403b, 0x45423a, 0x4b4339, 0x41453c];
    const rugMaterials = roomCenters.map((_, index) =>
      new MeshStandardMaterial({ color: rugPalette[index % rugPalette.length], roughness: 1 })
    );
    roomCenters.forEach(([x, z], index) => {
      if (x !== 0 || z !== 4) {
        const rug = new Mesh(
          new BoxGeometry(3.6, 0.035, 4.2),
          rugMaterials[index]
        );
        rug.name = `abandoned room ${index + 1} rug`;
        rug.position.set(x, -0.06, z);
        destinationScene.add(rug);
      }

      if (index % 2 === 0) {
        const roomLight = new PointLight(0xc1c7b3, 0.45, 6, 2);
        roomLight.position.set(x, 3.1, z);
        destinationScene.add(roomLight);
      }
    });

    const tileGeometry = new PlaneGeometry(0.96, 0.96);
    const tileMaterial = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.82 });
    const partyFloor = new InstancedMesh(tileGeometry, tileMaterial, 64);
    partyFloor.name = 'red and cream party-room checkerboard';
    partyFloor.matrixAutoUpdate = false;
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
      const bevelRadius = Math.min(0.055, Math.min(...size.map(Math.abs)) * 0.12);
      const furnishing = new Mesh(
        new RoundedBoxGeometry(...size, 3, bevelRadius),
        material
      );
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
      for (const centerZ of roomRowCenters) {
        const wallX = side * buildingHalfWidth;
        const frameX = side * (buildingHalfWidth - 0.22);
        furnishingBox('dark broken window recess', [0.12, 1.5, 2.35], [wallX, 2.63, centerZ], windowGlassMaterial);
        furnishingBox('splintered window sill', [0.24, 0.13, 2.9], [frameX, 1.79, centerZ], windowFrameMaterial);
        furnishingBox('weathered window lintel', [0.22, 0.14, 2.9], [frameX, 3.48, centerZ], windowFrameMaterial);
        for (const offset of [-1.34, 1.34]) {
          furnishingBox('rotted window jamb', [0.22, 1.78, 0.14], [frameX, 2.63, centerZ + offset], windowFrameMaterial);
        }
        furnishingBox('broken window crossbar', [0.18, 0.09, 2.55], [frameX, 2.5, centerZ], windowFrameMaterial);
        furnishingBox('loose window board', [0.14, 0.2, 1.45], [side * (buildingHalfWidth - 0.24), 2.95, centerZ + 0.32], woodMaterial, side * 0.025);
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
    const roofHalfSpan = buildingHalfDepth + 0.72;
    const roofSheetGeometry = new BoxGeometry(3.99, 0.14, roofHalfSpan + 0.06);
    const roofColors = [0x424843, 0x50534b, 0x3b423f, 0x5b4a3d, 0x454943, 0x383d3a];
    const roofMaterials = roofColors.map((color) => new MeshStandardMaterial({
      color,
      roughness: 0.88,
      metalness: 0.24
    }));
    const roofCenterY = 6.1;
    const roofPitch = 0.16;
    const roofSideCenter = roofHalfSpan / 2;

    for (const side of [-1, 1]) {
      for (let panel = 0; panel < 10; panel += 1) {
        const sheet = new Mesh(roofSheetGeometry, roofMaterials[(panel * 2 + (side > 0 ? 1 : 0)) % roofMaterials.length]);
        sheet.name = 'weathered corrugated roof sheet';
        sheet.position.set(-18 + panel * 4, roofCenterY, side * roofSideCenter);
        sheet.rotation.x = side * roofPitch;
        destinationScene.add(sheet);
      }

      const rafterGeometry = new BoxGeometry(0.18, 0.2, roofHalfSpan);
      for (let index = 0; index < 11; index += 1) {
        const rafter = new Mesh(rafterGeometry, roofBeamMaterial);
        rafter.name = 'exposed timber roof rafter';
        rafter.position.set(-18 + index * 3.6, roofCenterY, side * roofSideCenter);
        rafter.rotation.x = side * roofPitch;
        destinationScene.add(rafter);
      }
    }

    const roofRibMaterial = new MeshStandardMaterial({ color: 0x252c28, roughness: 0.78, metalness: 0.3 });
    const roofRibGeometry = new BoxGeometry(0.055, 0.065, roofHalfSpan);
    for (const side of [-1, 1]) {
      const ribs = new InstancedMesh(roofRibGeometry, roofRibMaterial, 81);
      ribs.name = 'raised seams on corrugated roof';
      ribs.matrixAutoUpdate = false;
      for (let index = 0; index < 81; index += 1) {
        const x = -buildingHalfWidth + index * 0.5;
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
      [-16, -1, 3], [-8, -1, 12], [0, -1, 6], [8, -1, 14], [16, -1, 4],
      [-16, 1, 13], [-8, 1, 5], [0, 1, 15], [8, 1, 3], [16, 1, 10]
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
      new BoxGeometry(buildingHalfWidth * 2 + 0.8, 0.24, 0.48),
      new MeshStandardMaterial({ color: 0x343a35, roughness: 0.82, metalness: 0.32 })
    );
    ridgeCap.name = 'weathered metal roof ridge cap';
    ridgeCap.position.set(0, roofCenterY + roofSideCenter * Math.sin(roofPitch) + 0.04, 0);
    destinationScene.add(ridgeCap);

    const animatronicRoot = new Group();
    animatronicRoot.name = 'shark animatronic with monster teeth';
    animatronicRoot.position.set(0, 0.8, 4.8);
    // Standing upright on its belly
    animatronicRoot.rotation.x = 0;
    animatronicRoot.rotation.y = -Math.PI / 2;
    animatronicRoot.rotation.z = -Math.PI / 2;

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
      sharkMixer.clipAction(sharkAnimation)
        .setEffectiveTimeScale(0.75)
        .setLoop(LoopRepeat, Infinity)
        .play();
    }

    const diabolusRexRoot = new Group();
    diabolusRexRoot.name = 'Diabolus Rex';
    diabolusRexRoot.position.set(8, 0, -4.8);
    const diabolusRex = diabolusRexGltf.scene;
    diabolusRex.updateMatrixWorld(true);
    const diabolusRexBounds = new Box3().setFromObject(diabolusRex);
    const diabolusRexSize = diabolusRexBounds.getSize(new Vector3());
    const diabolusRexCenter = diabolusRexBounds.getCenter(new Vector3());
    const diabolusRexScale = 4.2 / Math.max(
      diabolusRexSize.x,
      diabolusRexSize.y,
      diabolusRexSize.z
    );
    diabolusRex.scale.setScalar(diabolusRexScale);
    diabolusRex.position.set(
      -diabolusRexCenter.x * diabolusRexScale,
      -diabolusRexBounds.min.y * diabolusRexScale,
      -diabolusRexCenter.z * diabolusRexScale
    );
    diabolusRexRoot.add(diabolusRex);
    destinationScene.add(diabolusRexRoot);

    const diabolusRexMixer = new AnimationMixer(diabolusRex);
    const diabolusRexAnimation = diabolusRexGltf.animations[0];
    if (diabolusRexAnimation) {
      diabolusRexMixer.clipAction(diabolusRexAnimation)
        .setEffectiveTimeScale(0.75)
        .setLoop(LoopRepeat, Infinity)
        .play();
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
    let animatronicDeathStartedAt = null;
    let animatronicDead = false;
    const animatronicStartPosition = animatronicRoot.position.clone();
    const diabolusRexStartPosition = diabolusRexRoot.position.clone();
    const diabolusRexStartRotationY = diabolusRexRoot.rotation.y;
    const animatronicDeathPosition = new Vector3();
    const animatronicLungeDirection = new Vector3();
    let deathThreatRoot = null;
    const techRoomDoors = [];
    let interiorWalls = [];
    const beginEncounter = () => {
      setMaskWorn(false);
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
      animatronicDeathStartedAt = null;
      animatronicDead = false;
      deathThreatRoot = null;
      animatronicRoot.position.copy(animatronicStartPosition);
      diabolusRexRoot.position.copy(diabolusRexStartPosition);
      diabolusRexRoot.rotation.y = diabolusRexStartRotationY;
      animatronicDeath.hidden = true;
      techRoomDoors.forEach((door) => {
        door.isOpen = false;
        door.hinge.rotation.y = 0;
      });
      rifleGrip.visible = false;
      muzzleFlash.visible = false;
      character.root.position.set(0, 0, encounterStartZ);
      gameStatus.textContent = 'He grabs you...';
      gameStatus.removeAttribute('data-error');
    };

    const killPlayerWithAnimatronic = (time, threatRoot) => {
      if (maskWorn || animatronicDead) return;

      animatronicDead = true;
      animatronicDeathStartedAt = time;
      deathThreatRoot = threatRoot;
      animatronicDeathPosition.copy(threatRoot.position);
      animatronicLungeDirection
        .set(
          gameScene.camera.position.x - threatRoot.position.x,
          0,
          gameScene.camera.position.z - threatRoot.position.z
        )
        .normalize();
      movementKeys.clear();
      gameStatus.textContent = 'It caught you!';
    };

    const diabolusRexMoveSpeed = 2.1;
    const animatronicMoveSpeed = 2.1;
    const creatureMinimumSeparation = 2.6;
    const canMoveCreatureTo = (creature, otherCreature, fromX, fromZ, x, z) =>
      canMoveTo(fromX, fromZ, x, z)
      && Math.hypot(x - otherCreature.position.x, z - otherCreature.position.z)
        >= creatureMinimumSeparation;

    const turnCreatureToward = (creature, directionX, directionZ, delta) => {
      const targetYaw = Math.atan2(directionX, directionZ) - Math.PI / 2;
      const yawDifference = Math.atan2(
        Math.sin(targetYaw - creature.rotation.y),
        Math.cos(targetYaw - creature.rotation.y)
      );
      const turnAmount = Math.min(Math.abs(yawDifference), 2.4 * delta);
      creature.rotation.y += Math.sign(yawDifference) * turnAmount;
    };

    const getRoomCell = (x, z) => ({
      column: Math.max(0, Math.min(
        roomColumnCenters.length - 1,
        Math.floor((x + buildingHalfWidth) / roomSize)
      )),
      row: Math.max(0, Math.min(
        roomRowCenters.length - 1,
        Math.floor((z + buildingHalfDepth) / roomSize)
      ))
    });

    const getCreatureChaseTarget = (creature, targetX, targetZ) => {
      const currentCell = getRoomCell(creature.position.x, creature.position.z);
      const targetCell = getRoomCell(targetX, targetZ);
      const currentRoom = currentCell.row * roomColumnCenters.length + currentCell.column;
      const targetRoom = targetCell.row * roomColumnCenters.length + targetCell.column;
      if (currentRoom === targetRoom) return { x: targetX, z: targetZ };

      const queue = [currentRoom];
      const previousRooms = new Map([[currentRoom, null]]);
      while (queue.length > 0 && !previousRooms.has(targetRoom)) {
        const room = queue.shift();
        const column = room % roomColumnCenters.length;
        const row = Math.floor(room / roomColumnCenters.length);
        const neighbors = [];
        if (column > 0) neighbors.push({
          room: room - 1,
          axis: 'x',
          wallPosition: roomColumnCenters[column] - roomSize / 2,
          doorwayCenter: roomRowCenters[row],
          direction: -1
        });
        if (column < roomColumnCenters.length - 1) neighbors.push({
          room: room + 1,
          axis: 'x',
          wallPosition: roomColumnCenters[column] + roomSize / 2,
          doorwayCenter: roomRowCenters[row],
          direction: 1
        });
        if (row < roomRowCenters.length - 1) neighbors.push({
          room: room + roomColumnCenters.length,
          axis: 'z',
          wallPosition: roomRowCenters[row] + roomSize / 2,
          doorwayCenter: roomColumnCenters[column],
          direction: 1
        });
        if (row > 0) neighbors.push({
          room: room - roomColumnCenters.length,
          axis: 'z',
          wallPosition: roomRowCenters[row] - roomSize / 2,
          doorwayCenter: roomColumnCenters[column],
          direction: -1
        });

        neighbors.forEach((neighbor) => {
          if (previousRooms.has(neighbor.room)
            || isClosedTechRoomDoor(neighbor.axis, neighbor.wallPosition, neighbor.doorwayCenter)) {
            return;
          }
          previousRooms.set(neighbor.room, { from: room, ...neighbor });
          queue.push(neighbor.room);
        });
      }

      const firstStep = [];
      let room = targetRoom;
      while (room !== currentRoom && previousRooms.has(room)) {
        firstStep.unshift(previousRooms.get(room));
        room = previousRooms.get(room).from;
      }
      const nextRoom = firstStep[0];
      if (!nextRoom) return { x: targetX, z: targetZ };

      if (nextRoom.axis === 'x') {
        return {
          x: nextRoom.wallPosition + nextRoom.direction * 0.7,
          z: nextRoom.doorwayCenter
        };
      }
      return {
        x: nextRoom.doorwayCenter,
        z: nextRoom.wallPosition + nextRoom.direction * 0.7
      };
    };

    const moveCreatureToward = (creature, otherCreature, targetX, targetZ, delta, moveSpeed) => {
      const dx = targetX - creature.position.x;
      const dz = targetZ - creature.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 0.0001) return;

      const moveDistance = Math.min(moveSpeed * delta, distance);
      const stepX = (dx / distance) * moveDistance;
      const stepZ = (dz / distance) * moveDistance;
      const startX = creature.position.x;
      const startZ = creature.position.z;
      if (canMoveCreatureTo(
        creature,
        otherCreature,
        startX,
        startZ,
        startX + stepX,
        startZ
      )) {
        creature.position.x += stepX;
      }
      const movedX = creature.position.x;
      const movedZ = creature.position.z;
      if (canMoveCreatureTo(
        creature,
        otherCreature,
        movedX,
        movedZ,
        movedX,
        movedZ + stepZ
      )) {
        creature.position.z += stepZ;
      }

      const displacementX = creature.position.x - startX;
      const displacementZ = creature.position.z - startZ;
      const displacement = Math.hypot(displacementX, displacementZ);
      turnCreatureToward(
        creature,
        displacement > 0.0001 ? displacementX : dx,
        displacement > 0.0001 ? displacementZ : dz,
        delta
      );
    };

    const updateDiabolusRex = (delta, time) => {
      if (!destinationActive || animatronicDead) return;

      const dx = gameScene.camera.position.x - diabolusRexRoot.position.x;
      const dz = gameScene.camera.position.z - diabolusRexRoot.position.z;
      let distance = Math.hypot(dx, dz);
      if (distance > 1.2) {
        const chaseTarget = getCreatureChaseTarget(
          diabolusRexRoot,
          gameScene.camera.position.x,
          gameScene.camera.position.z
        );
        moveCreatureToward(
          diabolusRexRoot,
          animatronicRoot,
          chaseTarget.x,
          chaseTarget.z,
          delta,
          diabolusRexMoveSpeed
        );
        distance = Math.hypot(
          gameScene.camera.position.x - diabolusRexRoot.position.x,
          gameScene.camera.position.z - diabolusRexRoot.position.z
        );
      }

      if (distance <= 1.2) {
        killPlayerWithAnimatronic(time, diabolusRexRoot);
      }
    };

    const updateAnimatronic = (delta, time) => {
      const dustPosition = dustGeometry.attributes.position;
      for (let index = 0; index < dustCount; index += 1) {
        const height = dustPosition.getY(index) + delta * (0.025 + index % 5 * 0.008);
        dustPosition.setY(index, height > 5.2 ? 0.35 + index % 10 * 0.08 : height);
      }
      dustPosition.needsUpdate = true;

      if (destinationActive) {
        sharkMixer.update(delta);
        diabolusRexMixer.update(delta);
      }
      updateDiabolusRex(delta, time);
      teethJaw.rotation.z = Math.sin(time * 0.004) * 0.14;
      animatronicGlow.intensity = 1.1 + Math.sin(time * 0.006) * 0.3;

      if (!destinationActive || animatronicDead) {
        if (animatronicDeathStartedAt !== null) {
          const lungeProgress = Math.min(1, (time - animatronicDeathStartedAt) / 420);
          deathThreatRoot.position
            .copy(animatronicDeathPosition)
            .addScaledVector(animatronicLungeDirection, lungeProgress * 2.1);
          if (time - animatronicDeathStartedAt >= 650 && animatronicDeath.hidden) {
            animatronicDeath.hidden = false;
            deathRestartButton.focus();
          }
        }
        return;
      }

      // Calculate distance between player and shark
      const dx = gameScene.camera.position.x - animatronicRoot.position.x;
      const dz = gameScene.camera.position.z - animatronicRoot.position.z;
      const distanceToPlayer = Math.hypot(dx, dz);

      if (distanceToPlayer < 1.3) {
        killPlayerWithAnimatronic(time, animatronicRoot);
        return;
      }

      if (time - lastAnimatronicLookCheck >= 100) {
        gameScene.camera.updateMatrixWorld();
        gameScene.gazeRaycaster.setFromCamera(gameScene.screenCenter, gameScene.camera);
        isLookingAtAnimatronic = gameScene.gazeRaycaster
          .intersectObject(animatronicRoot, true)
          .length > 0;
        lastAnimatronicLookCheck = time;
      }

      if (isLookingAtAnimatronic) {
        if (sharkSound.paused) {
          if (voiceAudioContext?.state === 'suspended') {
            void voiceAudioContext.resume().catch(() => {});
          }
          sharkSound.currentTime = 0;
          sharkSound.play().catch((error) => {
            console.warn('Shark audio playback error caught:', error);
          });
        }
      } else {
        if (!sharkSound.paused) {
          sharkSound.pause();
          sharkSound.currentTime = 0;
        }
      }

      const chaseTarget = getCreatureChaseTarget(
        animatronicRoot,
        gameScene.camera.position.x,
        gameScene.camera.position.z
      );
      moveCreatureToward(
        animatronicRoot,
        diabolusRexRoot,
        chaseTarget.x,
        chaseTarget.z,
        delta,
        animatronicMoveSpeed
      );
    };

    const respawnFromAnimatronic = () => {
      setMaskWorn(false);
      animatronicDeath.hidden = true;
      resetBleedingEffect();
      animatronicDeathStartedAt = null;
      animatronicDead = false;
      deathThreatRoot = null;
      animatronicRoot.position.copy(animatronicStartPosition);
      diabolusRexRoot.position.copy(diabolusRexStartPosition);
      diabolusRexRoot.rotation.y = diabolusRexStartRotationY;
      destinationActive = true;
      transportStartedAt = performance.now() - 3000;
      movementKeys.clear();
      gameScene.camera.position.set(-8, 1.65, -4);
      cameraYaw = Math.PI;
      cameraPitch = 0;
      gameStatus.textContent = '';
      gameControls.textContent = "WASD / arrows · drag to look · E doors · M mask";
    };

    const updateEncounter = (time) => {
      if (encounterStartTime === null) return 0;
      if (transportStartedAt !== null) {
        const transportElapsed = (time - transportStartedAt) / 1000;
        if (!destinationActive && transportElapsed >= 1.55) {
          destinationActive = true;
          movementKeys.clear();
          gameScene.camera.position.set(-8, 1.65, -4);
          cameraYaw = Math.PI;
          cameraPitch = 0;
        }
        if (transportElapsed >= 2.6) {
          visionBlink.classList.remove('is-blinking');
          gameStatus.textContent = 'You wake up in the tech room.';
          gameControls.textContent = "WASD / arrows · drag to look · E doors · M mask";
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
        gameStatus.textContent = 'The man is speaking...';
        void playCharacterVoice().catch((error) => {
          console.error('Could not play the character voice:', error);
          voiceError = true;
          gameStatus.textContent = 'Could not play the character audio. Check your browser audio settings.';
          gameStatus.dataset.error = 'true';
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
        gameStatus.textContent = 'He raises his rifle...';
      }

      if (speechFinishedElapsed !== null && shotElapsed === null && elapsed - speechFinishedElapsed >= 1.2) {
        shotElapsed = elapsed;
        muzzleFlash.visible = true;
        gameStatus.textContent = 'You have been shot. You are bleeding...';
        showBleedingEffect();
        playShotSound();
        transportStartedAt = time;
        visionBlink.classList.remove('is-blinking');
        void visionBlink.offsetWidth;
        visionBlink.classList.add('is-blinking');
        gameStatus.textContent = 'You have been shot. Your vision flickers...';
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

    interiorWalls = [
      ...roomColumnCenters.slice(0, -1).map((center) => ({
        axis: 'x',
        position: center + roomSize / 2,
        doorways: roomRowCenters
      })),
      ...roomRowCenters.slice(0, -1).map((center) => ({
        axis: 'z',
        position: center + roomSize / 2,
        doorways: roomColumnCenters
      }))
    ];

    const addTechRoomDoor = (axis, position, center, hingeRotation) => {
      const hinge = new Group();
      hinge.name = 'tech-room exit door hinge';

      if (axis === 'x') {
        hinge.position.set(position, 0, center - 0.8);
      } else {
        hinge.position.set(center - 0.8, 0, position);
      }

      const doorHeight = 2.95;

      const doorModel = new Group();
      doorModel.name = 'industrial double metal door';
      const doorMesh = techRoomDoorGltf.scene.clone(true);
      const modelBounds = new Box3().setFromObject(doorMesh);
      const modelScale = doorHeight / modelBounds.getSize(new Vector3()).y;
      doorMesh.scale.setScalar(modelScale);
      doorMesh.position.set(
        -modelBounds.min.x * modelScale,
        -modelBounds.min.y * modelScale,
        -modelBounds.getCenter(new Vector3()).z * modelScale
      );
      doorModel.rotation.y = axis === 'x' ? -Math.PI / 2 : 0;
      doorModel.add(doorMesh);
      hinge.add(doorModel);

      destinationScene.add(hinge);
      techRoomDoors.push({ axis, position, center, hinge, hingeRotation, isOpen: false });
    };

    addTechRoomDoor('x', -6, -6, Math.PI / 2);
    addTechRoomDoor('z', 0, -12, -Math.PI / 2);

    // TOGGLE DOOR (OPEN / CLOSE)
    const toggleNearbyTechRoomDoor = (x, z) => {
      const nearbyDoor = techRoomDoors.find((door) =>
        Math.hypot(x - (door.axis === 'x' ? door.position : door.center),
          z - (door.axis === 'x' ? door.center : door.position)) < 2.2
      );
      if (!nearbyDoor) return { found: false };

      nearbyDoor.isOpen = !nearbyDoor.isOpen;
      nearbyDoor.hinge.rotation.y = nearbyDoor.isOpen ? nearbyDoor.hingeRotation : 0;
      return { found: true, isOpen: nearbyDoor.isOpen };
    };

    const isClosedTechRoomDoor = (axis, position, center) =>
      techRoomDoors.some((door) =>
        !door.isOpen
        && door.axis === axis
        && door.position === position
        && Math.abs(door.center - center) < 0.01
      );

    const canMoveTo = (fromX, fromZ, toX, toZ, wallClearance = 0.3) => interiorWalls.every((wall) => {
      const from = wall.axis === 'x' ? fromX : fromZ;
      const to = wall.axis === 'x' ? toX : toZ;
      const movingTowardWall = Math.abs(to - wall.position) < Math.abs(from - wall.position);
      const reachesWall = Math.min(
        Math.abs(from - wall.position),
        Math.abs(to - wall.position)
      ) < wallClearance || (from - wall.position) * (to - wall.position) < 0;
      if (!movingTowardWall || !reachesWall) return true;

      const openingPosition = wall.axis === 'x' ? toZ : toX;
      const doorway = wall.doorways.find((center) => Math.abs(openingPosition - center) < 0.8);
      return doorway !== undefined && !isClosedTechRoomDoor(wall.axis, wall.position, doorway);
    });

    configureSceneShadows(roomScene);
    configureSceneShadows(destinationScene);
    surfaceDetail.applyScene(roomScene, { environmentLighting: true });
    surfaceDetail.applyScene(destinationScene, { environmentLighting: true });

    return {
      scene: roomScene,
      minX: roomBounds.min.x + 0.25,
      maxX: roomBounds.max.x - 0.25,
      minZ: roomBounds.min.z + 0.25,
      maxZ: roomBounds.max.z - 0.25,
      destinationScene,
      destinationBounds: {
        minX: -buildingHalfWidth + 0.75,
        maxX: buildingHalfWidth - 0.75,
        minZ: -buildingHalfDepth + 0.75,
        maxZ: buildingHalfDepth - 0.75
      },
      canMoveTo,
      toggleNearbyTechRoomDoor,
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

  return {
    renderer,
    camera,
    gazeRaycaster,
    screenCenter,
    loadLivingRoom,
    livingRoom: null
  };
}

function setSeatedLivingRoomView() {
  if (!gameScene) return;

  gameScene.camera.position.set(0, 0.82, 1.6);
  cameraYaw = 0;
  cameraPitch = Math.atan2(0.7 - 0.82, 2.2);
}

function resizeGameScene() {
  if (!gameScene) return;

  const width = gameCanvas.clientWidth;
  const height = gameCanvas.clientHeight;
  if (width === 0 || height === 0) return;

  gameScene.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, gamePixelRatioLimit));
  gameScene.renderer.setSize(width, height, false);
  gameScene.camera.aspect = width / height;
  gameScene.camera.updateProjectionMatrix();
}

function renderGame(time) {
  gameAnimationFrame = 0;
  if (gameScreen.hidden || document.hidden || !gameScene?.livingRoom) return;

  const livingRoom = gameScene.livingRoom;
  const isInDestination = livingRoom.isDestinationActive;
  if (isInDestination && lastGameFrame !== 0 && time - lastGameFrame < 1000 / 30) {
    gameAnimationFrame = requestAnimationFrame(renderGame);
    return;
  }

  const delta = lastGameFrame === 0 ? 0 : Math.min((time - lastGameFrame) / 1000, 0.05);
  lastGameFrame = time;
  const grabIntensity = livingRoom.updateEncounter(time);
  let forward = Number(movementKeys.has('KeyW') || movementKeys.has('ArrowUp'))
    - Number(movementKeys.has('KeyS') || movementKeys.has('ArrowDown'));
  let strafe = Number(movementKeys.has('KeyD') || movementKeys.has('ArrowRight'))
    - Number(movementKeys.has('KeyA') || movementKeys.has('ArrowLeft'));
  if (isInDestination) {
    const bounds = livingRoom.destinationBounds;
    const wallClearance = 0.55;
    const length = Math.hypot(forward, strafe) || 1;
    const speed = 4 * delta / length;
    const forwardX = -Math.sin(cameraYaw);
    const forwardZ = -Math.cos(cameraYaw);
    const rightX = Math.cos(cameraYaw);
    const rightZ = -Math.sin(cameraYaw);
    const nextX = Math.max(
      bounds.minX,
      Math.min(bounds.maxX, gameScene.camera.position.x + (forward * forwardX + strafe * rightX) * speed)
    );
    const nextZ = Math.max(
      bounds.minZ,
      Math.min(bounds.maxZ, gameScene.camera.position.z + (forward * forwardZ + strafe * rightZ) * speed)
    );
    const canMoveTo = livingRoom.canMoveTo;
    if (canMoveTo(
      gameScene.camera.position.x,
      gameScene.camera.position.z,
      nextX,
      gameScene.camera.position.z,
      wallClearance
    )) {
      gameScene.camera.position.x = nextX;
    }
    if (canMoveTo(
      gameScene.camera.position.x,
      gameScene.camera.position.z,
      gameScene.camera.position.x,
      nextZ,
      wallClearance
    )) {
      gameScene.camera.position.z = nextZ;
    }
  } else {
    movementKeys.clear();
    forward = 0;
    strafe = 0;
    gameScene.camera.position.x = 0;
    gameScene.camera.position.z = 1.6;
    gameScene.camera.position.y = 0.82;
  }

  gameScene.camera.rotation.set(cameraPitch, cameraYaw, 0, 'YXZ');
  if (isInDestination) {
    livingRoom.updateAnimatronic(delta, time);
    if (livingRoom.isPlayerDead) {
      movementKeys.clear();
      forward = 0;
      strafe = 0;
    }
  }
  if (!isInDestination) {
    const approach = Math.max(0, Math.min(1, (livingRoom.characterPositionZ + 0.65) / 1.35));
    gameScene.camera.rotation.x += approach * 0.4;
    gameScene.camera.position.x += Math.sin(time * 0.035) * grabIntensity * 0.045;
    gameScene.camera.position.y += (Math.sin(time * 0.027) - 0.5) * grabIntensity * 0.06;
    gameScene.camera.position.z += (Math.cos(time * 0.031) - 1) * grabIntensity * 0.07;
    gameScene.camera.rotation.x += Math.sin(time * 0.035) * grabIntensity * 0.045;
    gameScene.camera.rotation.y += Math.sin(time * 0.027) * grabIntensity * 0.035;
  }
  const activeScene = isInDestination ? livingRoom.destinationScene : livingRoom.scene;
  gameScene.renderer.render(activeScene, gameScene.camera);
  gameAnimationFrame = requestAnimationFrame(renderGame);
}

function startGameScene() {
  if (document.hidden) return;

  resizeGameScene();
  if (!gameAnimationFrame) {
    lastGameFrame = 0;
    gameAnimationFrame = requestAnimationFrame(renderGame);
  }
}

function validatePlayAccess() {
  if (!passcodeInput) return true;

  const isValid = passcodeInput.value.trim() === '72303';
  if (passcodeError) {
    passcodeError.hidden = isValid;
  }

  if (!isValid) {
    passcodeInput.value = '';
    passcodeInput.focus();
    return false;
  }

  return true;
}

playButton.addEventListener('click', async () => {
  if (!validatePlayAccess()) {
    return;
  }

  unlockCharacterVoice();
  menu.hidden = true;
  gameScreen.hidden = false;
  movementKeys.clear();
  gameStatus.textContent = '';
  gameStatus.removeAttribute('data-error');

  if (gameScene) {
    if (gameScene.livingRoom) {
      setSeatedLivingRoomView();
      gameScene.livingRoom.beginEncounter();
      gameControls.textContent = 'Drag to look around · M wears the mask';
    }
    if (gameScene.livingRoom) {
      startGameScene();
      return;
    }
  }

  if (gameLoading) return;
  gameLoading = true;
  gameStatus.textContent = 'Loading the living room...';

  try {
    gameScene ??= await createGameScene();
    gameScene.livingRoom = await gameScene.loadLivingRoom();
    setSeatedLivingRoomView();
    gameScene.livingRoom.beginEncounter();
    gameControls.textContent = 'Drag to look around · M wears the mask';
    gameStatus.textContent = '';
    startGameScene();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Could not load the living room:', error);
    gameStatus.textContent = `Could not load the living room: ${message}`;
    gameStatus.dataset.error = 'true';
  } finally {
    gameLoading = false;
  }
});

passcodeInput?.addEventListener('input', () => {
  if (passcodeError) {
    passcodeError.hidden = true;
  }
});

passcodeInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    playButton.click();
  }
});

deathRestartButton.addEventListener('click', () => {
  gameScene?.livingRoom?.respawnFromAnimatronic();
});

maskToggleButton.addEventListener('click', () => {
  setMaskWorn(!maskWorn);
});

backButton.addEventListener('click', () => {
  setMaskWorn(false);
  gameScreen.hidden = true;
  menu.hidden = false;
  stopCharacterVoice();
  visionBlink.classList.remove('is-blinking');
  movementKeys.clear();
  lookPointerId = null;
  gameCanvas.classList.remove('is-looking');
  cancelAnimationFrame(gameAnimationFrame);
  gameAnimationFrame = 0;
  lastGameFrame = 0;
});

gameCanvas.addEventListener('pointerdown', (event) => {
  if (!event.isPrimary || event.button !== 0) return;

  lookPointerId = event.pointerId;
  lastLookX = event.clientX;
  lastLookY = event.clientY;
  gameCanvas.classList.add('is-looking');
  gameCanvas.setPointerCapture(event.pointerId);
  event.preventDefault();
});

gameCanvas.addEventListener('pointermove', (event) => {
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
  gameCanvas.classList.remove('is-looking');
  if (gameCanvas.hasPointerCapture(event.pointerId)) {
    gameCanvas.releasePointerCapture(event.pointerId);
  }
}

gameCanvas.addEventListener('pointerup', stopLooking);
gameCanvas.addEventListener('pointercancel', stopLooking);

window.addEventListener('keydown', (event) => {
  if (gameScreen.hidden) return;
  if (event.code === 'KeyM') {
    if (!event.repeat) {
      event.preventDefault();
      setMaskWorn(!maskWorn);
    }
    return;
  }
  if (event.code === 'KeyE') {
    if (!event.repeat && gameScene?.livingRoom?.isDestinationActive) {
      event.preventDefault();
      const result = gameScene.livingRoom.toggleNearbyTechRoomDoor(
        gameScene.camera.position.x,
        gameScene.camera.position.z
      );
      if (result.found) {
        gameStatus.textContent = result.isOpen
          ? 'The tech-room door creaks open.'
          : 'The tech-room door shuts tightly.';
      } else {
        gameStatus.textContent = 'Move closer to a door to interact with it.';
      }
    }
    return;
  }
  const movementCode = /^(Key[WASD]|Arrow(?:Up|Down|Left|Right))$/.test(event.code);
  if (!movementCode) return;

  event.preventDefault();
  if (gameScene?.livingRoom
    && (!gameScene.livingRoom.isDestinationActive || gameScene.livingRoom.isPlayerDead)) return;
  movementKeys.add(event.code);
});

window.addEventListener('keyup', (event) => {
  movementKeys.delete(event.code);
});

window.addEventListener('blur', () => movementKeys.clear());
window.addEventListener('resize', resizeGameScene);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelAnimationFrame(gameAnimationFrame);
    gameAnimationFrame = 0;
    lastGameFrame = 0;
    movementKeys.clear();
  } else if (!gameScreen.hidden) {
    startGameScene();
  }
});
gameCanvas.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  cancelAnimationFrame(gameAnimationFrame);
  gameAnimationFrame = 0;
  lastGameFrame = 0;

  if (!gameScreen.hidden) {
    gameStatus.textContent = graphicsResetMessage;
    gameStatus.dataset.error = 'true';
  }
});
gameCanvas.addEventListener('webglcontextrestored', () => {
  if (!gameScene) return;

  if (gameStatus.textContent === graphicsResetMessage) {
    gameStatus.textContent = '';
    gameStatus.removeAttribute('data-error');
  }
  resizeGameScene();
  startGameScene();
});
