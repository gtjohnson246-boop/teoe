import {
  AmbientLight,
  Box3,
  BoxGeometry,
  Color,
  DirectionalLight,
  FogExp2,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Scene,
  SphereGeometry,
  Vector3
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const duration = 17.5;

function fitModel(root, model, maxDimension) {
  root.add(model);
  root.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(root);
  const size = bounds.getSize(new Vector3());
  const largestDimension = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(largestDimension) || largestDimension < 0.1) {
    throw new Error(`The ${model.name || 'cutscene'} model has no usable geometry.`);
  }

  const scale = maxDimension / largestDimension;
  const center = bounds.getCenter(new Vector3());
  root.scale.setScalar(scale);
  root.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
  root.updateMatrixWorld(true);
}

function smoothstep(value) {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
}

function addModel(scene, source, maxDimension, position) {
  const model = source.clone(true);
  const fittedModel = new Group();
  fitModel(fittedModel, model, maxDimension);
  const placement = new Group();
  placement.add(fittedModel);
  placement.position.set(...position);
  placement.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
  });
  scene.add(placement);
  return placement;
}

export async function createArrivalCutscene({ createCharacter }) {
  const loader = new GLTFLoader();
  const loadModel = (path) => loader.loadAsync(new URL(path, import.meta.url).href);
  const [grassGltf, carGltf, treeGltf, buildingGltf, character] = await Promise.all([
    loadModel('./grass_vegitation_mix_gltf/scene.gltf'),
    loadModel('./car2_gltf/scene.gltf'),
    loadModel('./fbx_gltf/scene.gltf'),
    loadModel('./modern_building_gltf/scene.gltf'),
    createCharacter()
  ]);

  const scene = new Scene();
  scene.background = new Color(0x101715);
  scene.fog = new FogExp2(0x18201d, 0.008);
  scene.add(new AmbientLight(0xb7c4c0, 0.65));

  const moonlight = new DirectionalLight(0xc0d0cc, 1.45);
  moonlight.position.set(-16, 28, 12);
  scene.add(moonlight);

  const ground = new Mesh(
    new PlaneGeometry(240, 240),
    new MeshStandardMaterial({ color: 0x394632, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.08;
  ground.receiveShadow = true;
  scene.add(ground);

  const road = new Mesh(
    new PlaneGeometry(8, 120),
    new MeshStandardMaterial({ color: 0x292d2d, roughness: 0.96 })
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, -0.035, -4);
  road.receiveShadow = true;
  scene.add(road);

  const markingMaterial = new MeshStandardMaterial({
    color: 0xb5aa7d,
    roughness: 0.92,
    emissive: 0x262318
  });
  for (let z = 45; z > -48; z -= 10) {
    const marking = new Mesh(new BoxGeometry(0.13, 0.018, 4), markingMaterial);
    marking.position.set(0, 0.006, z);
    scene.add(marking);
  }

  const building = addModel(scene, buildingGltf.scene, 20, [0, 0, -45]);
  const buildingBounds = new Box3().setFromObject(building);
  const buildingSize = buildingBounds.getSize(new Vector3());
  const entryZ = Math.min(-32, buildingBounds.max.z + 1.6);
  const buildingLight = new PointLight(0xc38f58, 18, 30, 2);
  buildingLight.position.set(0, Math.min(3.2, buildingSize.y * 0.45), buildingBounds.max.z + 1.5);
  scene.add(buildingLight);

  const treePositions = [34, 18, 2, -14, -30];
  for (const z of treePositions) {
    for (const side of [-1, 1]) {
      addModel(scene, treeGltf.scene, 10, [side * 9, 0, z]);
    }
  }

  for (const z of [30, 8, -14, -32]) {
    for (const side of [-1, 1]) {
      addModel(scene, grassGltf.scene, 5, [side * 5.2, 0, z]);
    }
  }

  const car = addModel(scene, carGltf.scene, 5, [0, 0, 32]);
  const headlightMaterial = new MeshStandardMaterial({
    color: 0xffe6aa,
    emissive: 0xffc15c,
    emissiveIntensity: 3
  });
  for (const side of [-1, 1]) {
    const headlight = new Mesh(new SphereGeometry(0.09, 12, 8), headlightMaterial);
    headlight.position.set(side * 0.73, 0.55, -2.05);
    car.add(headlight);

    const beam = new PointLight(0xffd18a, 4, 17, 2);
    beam.position.set(side * 0.73, 0.55, -2.05);
    car.add(beam);
  }

  const characterRoot = character.root;
  characterRoot.position.set(-1.65, 0, -15.5);
  characterRoot.rotation.y = Math.PI;
  scene.add(characterRoot);

  const camera = new PerspectiveCamera(58, 1, 0.1, 220);
  camera.position.set(5, 5, 43);
  camera.lookAt(0, 1, 15);

  let elapsed = 0;
  let active = false;
  const cameraLookTarget = new Vector3();

  const setCamera = (position, target) => {
    camera.position.copy(position);
    cameraLookTarget.copy(target);
    camera.lookAt(cameraLookTarget);
  };

  const dispose = () => {
    const geometries = new Set();
    const materials = new Set();
    const textures = new Set();
    scene.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      if (!object.material) return;
      const objectMaterials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      objectMaterials.forEach((material) => {
        materials.add(material);
        Object.values(material).forEach((value) => {
          if (value?.isTexture) textures.add(value);
        });
      });
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    textures.forEach((texture) => texture.dispose());
    scene.clear();
  };

  return {
    camera,
    scene,
    get active() {
      return active;
    },
    get isFading() {
      return elapsed >= 15.1;
    },
    start() {
      elapsed = 0;
      active = true;
      characterRoot.visible = true;
      characterRoot.position.set(-1.65, 0, -15.5);
      car.position.set(0, 0, 32);
    },
    skip() {
      elapsed = duration;
    },
    update(delta) {
      if (!active) return { active: false, caption: '' };
      elapsed += delta;

      const driveProgress = smoothstep(elapsed / 5.8);
      car.position.z = 32 + (-15.5 - 32) * driveProgress;

      if (elapsed < 5.8) {
        setCamera(
          new Vector3(car.position.x + 5.5, 4.6, car.position.z + 9),
          new Vector3(0, 1.1, car.position.z - 10)
        );
      } else if (elapsed < 7.3) {
        const exitProgress = smoothstep((elapsed - 5.8) / 1.5);
        characterRoot.position.z = -15.5 - exitProgress * 0.8;
        const chasePosition = new Vector3(5.5, 4.6, car.position.z + 9);
        const exitPosition = new Vector3(-5.3, 2.8, -9.5);
        const exitTarget = new Vector3(-1.5, 1.2, -15);
        setCamera(
          chasePosition.lerp(exitPosition, exitProgress),
          new Vector3(0, 1, -20).lerp(exitTarget, exitProgress)
        );
      } else {
        const walkProgress = smoothstep((elapsed - 7.3) / 8.1);
        const walkZ = -16.3 + (entryZ + 16.3) * walkProgress;
        characterRoot.position.z = walkZ;
        const stride = elapsed * 8;
        characterRoot.position.y = Math.abs(Math.sin(stride)) * 0.035;
        character.leftShoulder.rotation.x = Math.sin(stride) * 0.48;
        character.rightShoulder.rotation.x = -Math.sin(stride) * 0.48;
        character.leftElbow.rotation.x = -0.12;
        character.rightElbow.rotation.x = -0.12;

        if (elapsed < 15.1) {
          setCamera(
            new Vector3(characterRoot.position.x - 4.3, 2.7, walkZ + 6.3),
            new Vector3(characterRoot.position.x, 1.25, walkZ - 3.3)
          );
        } else {
          characterRoot.visible = false;
          setCamera(
            new Vector3(-4.3, 2.7, walkZ + 6.3),
            new Vector3(0, 1.25, buildingBounds.max.z)
          );
        }
      }

      if (elapsed >= duration) {
        active = false;
        return { active: false, caption: '' };
      }

      const caption = elapsed < 5.8
        ? 'The car follows the road toward the abandoned building...'
        : elapsed < 7.3
          ? 'You get out of the car...'
          : elapsed < 15.1
            ? 'You walk toward the abandoned building...'
            : 'You step inside...';
      return { active: true, caption };
    },
    dispose
  };
}
