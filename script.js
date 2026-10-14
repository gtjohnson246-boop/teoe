const intro = document.getElementById('intro');
const menu = document.getElementById('menu');
const playButton = document.getElementById('play-button');
const grassGame = document.getElementById('grass-game');
const grassCanvas = document.getElementById('grass-canvas');
const bloodOverlay = document.getElementById('blood-overlay');
const visionBlink = document.getElementById('vision-blink');
const grassStatus = document.getElementById('grass-status');
const grassControls = document.getElementById('grass-controls');
const backButton = document.getElementById('back-button');
const characterVoice = new Audio('audio/casual-male-voice.mp3');
characterVoice.preload = 'auto';
const grabSound = new Audio('audio/grab-sound.mp3');
grabSound.preload = 'auto';
grabSound.volume = 0.9;

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
      voiceAudioContext = new AudioContext();
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
      BoxGeometry,
      Box3,
      BufferGeometry,
      CanvasTexture,
      Color,
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
      SphereGeometry,
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
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
    const [roomGltf, couchGltf, rifleGltf, brickStackGltf] = await Promise.all([
      loadModel('living-room/scene.gltf'),
      loadModel('couch/scene.gltf'),
      loadModel('hunting-rifle/scene.gltf'),
      loadModel('brick-stack/scene.gltf')
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
    const buildingFloor = new Mesh(new PlaneGeometry(15, 15), concreteMaterial);
    buildingFloor.rotation.x = -Math.PI / 2;
    buildingFloor.position.y = -0.08;
    destinationScene.add(buildingFloor);

    brickStackGltf.scene.updateMatrixWorld(true);
    let brickStackSource = null;
    brickStackGltf.scene.traverse((object) => {
      if (!brickStackSource && object.isMesh) brickStackSource = object;
    });
    if (!brickStackSource) {
      throw new Error('The brick stack model contains no usable mesh.');
    }

    const brickGeometry = brickStackSource.geometry.clone()
      .applyMatrix4(brickStackSource.matrixWorld);
    const brickBounds = new Box3().setFromBufferAttribute(brickGeometry.attributes.position);
    const brickCenter = brickBounds.getCenter(new Vector3());
    const brickSize = brickBounds.getSize(new Vector3());
    brickGeometry.translate(-brickCenter.x, -brickCenter.y, -brickCenter.z);
    brickGeometry.computeBoundingBox();
    brickGeometry.computeBoundingSphere();
    const brickMaterial = Array.isArray(brickStackSource.material)
      ? brickStackSource.material.map((material) => material.clone())
      : brickStackSource.material.clone();
    for (const material of Array.isArray(brickMaterial) ? brickMaterial : [brickMaterial]) {
      material.roughness = 0.98;
    }

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
          if (row >= 3 && random() < 0.17) continue;
          if (row > 0 && random() < 0.025) continue;

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

    wallBrick('x', -6.25, 12.5, 5, [
      (x, row) => Math.abs(x + 3.1) < 1.05 && row >= 2 && row <= 3
    ]);
    wallBrick('x', 6.25, 12.5, 5, [
      (x, row) => Math.abs(x - 3.2) < 0.95 && row >= 2 && row <= 3
    ]);
    wallBrick('z', -6.25, 12.5, 5, [
      (z, row) => Math.abs(z - 0.5) < 1.05 && row >= 2 && row <= 3
    ]);
    wallBrick('z', 6.25, 12.5, 5, [
      (x, row) => (Math.abs(x) < 0.82 && row < 4)
        || (Math.abs(x + 3.2) < 1.0 && row >= 2 && row <= 3)
    ]);

    const roofBeamMaterial = new MeshStandardMaterial({ color: 0x30271d, roughness: 1 });
    for (const [z, lean] of [[-4.4, -0.04], [-1.6, 0.03], [2.9, -0.08]]) {
      const beam = new Mesh(new BoxGeometry(5.2, 0.16, 0.19), roofBeamMaterial);
      beam.position.set(0.3, 3.72 + lean, z);
      beam.rotation.z = lean;
      destinationScene.add(beam);
    }

    const debrisCount = 38;
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
        x = (random() - 0.5) * 11;
        z = (random() - 0.5) * 11;
      } while (Math.hypot(x, z - 4.5) < 1.7);

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
      rifleGrip.visible = false;
      muzzleFlash.visible = false;
      character.root.position.set(0, 0, encounterStartZ);
      grassStatus.textContent = 'He grabs you...';
      grassStatus.removeAttribute('data-error');
    };
    const updateEncounter = (time) => {
      if (encounterStartTime === null) return 0;
      if (transportStartedAt !== null) {
        const transportElapsed = (time - transportStartedAt) / 1000;
        if (!destinationActive && transportElapsed >= 1.55) {
          destinationActive = true;
          movementKeys.clear();
          grassScene.camera.position.set(0, 1.65, 4.5);
          cameraYaw = 0;
          cameraPitch = 0;
        }
        if (transportElapsed >= 2.6) {
          visionBlink.classList.remove('is-blinking');
          grassStatus.textContent = 'You wake up inside an abandoned brick building.';
          grassControls.textContent = 'WASD / arrows to move · drag to look around the abandoned building';
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

    return {
      scene: roomScene,
      minX: roomBounds.min.x + 0.25,
      maxX: roomBounds.max.x - 0.25,
      minZ: roomBounds.min.z + 0.25,
      maxZ: roomBounds.max.z - 0.25,
      destinationScene,
      destinationBounds: { minX: -5.55, maxX: 5.55, minZ: -5.55, maxZ: 5.55 },
      beginEncounter,
      get isDestinationActive() {
        return destinationActive;
      },
      get characterPositionZ() {
        return character.root.position.z;
      },
      updateEncounter
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
  const fieldRows = 68;
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
  const bladeChunkRows = 8;
  const bladeChunkCount = bladeChunkRows * bladeChunkRows;
  const bladeCount = 20000;
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
    grassScene.camera.position.x = Math.max(
      bounds.minX,
      Math.min(bounds.maxX, grassScene.camera.position.x + (forward * forwardX + strafe * rightX) * speed)
    );
    grassScene.camera.position.z = Math.max(
      bounds.minZ,
      Math.min(bounds.maxZ, grassScene.camera.position.z + (forward * forwardZ + strafe * rightZ) * speed)
    );
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
  const movementCode = /^(Key[WASD]|Arrow(?:Up|Down|Left|Right))$/.test(event.code);
  if (!movementCode) return;

  event.preventDefault();
  if (grassScene?.livingRoom && !grassScene.livingRoom.isDestinationActive) return;
  movementKeys.add(event.code);
});

window.addEventListener('keyup', (event) => {
  movementKeys.delete(event.code);
});

window.addEventListener('blur', () => movementKeys.clear());
window.addEventListener('resize', resizeGrassScene);
