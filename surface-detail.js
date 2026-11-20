import {
  DataTexture,
  PMREMGenerator,
  RepeatWrapping,
  RGBFormat,
  UnsignedByteType
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

function createMicroNormalMap() {
  const size = 128;
  const noise = new Float32Array(size * size);
  const smoothedNoise = new Float32Array(size * size);
  const pixels = new Uint8Array(size * size * 3);
  const wrap = (value) => (value + size) % size;
  const hash = (x, y) => {
    let value = Math.imul(x, 374761393) + Math.imul(y, 668265263);
    value = Math.imul(value ^ (value >>> 13), 1274126177);
    return ((value ^ (value >>> 16)) >>> 0) / 0xffffffff;
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      noise[y * size + x] = hash(x, y);
    }
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = y * size + x;
      const neighbors = noise[y * size + wrap(x - 1)]
        + noise[y * size + wrap(x + 1)]
        + noise[wrap(y - 1) * size + x]
        + noise[wrap(y + 1) * size + x];
      smoothedNoise[index] = noise[index] * 0.5 + neighbors * 0.125;
    }
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = y * size + x;
      const slopeX = (smoothedNoise[y * size + wrap(x + 1)]
        - smoothedNoise[y * size + wrap(x - 1)]) * 0.7;
      const slopeY = (smoothedNoise[wrap(y + 1) * size + x]
        - smoothedNoise[wrap(y - 1) * size + x]) * 0.7;
      const length = Math.hypot(slopeX, slopeY, 1);
      pixels[index * 3] = Math.round(((-slopeX / length) * 0.5 + 0.5) * 255);
      pixels[index * 3 + 1] = Math.round(((-slopeY / length) * 0.5 + 0.5) * 255);
      pixels[index * 3 + 2] = Math.round(((1 / length) * 0.5 + 0.5) * 255);
    }
  }

  const texture = new DataTexture(pixels, size, size, RGBFormat, UnsignedByteType);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(8, 8);
  texture.userData.keepAlive = true;
  texture.needsUpdate = true;
  return texture;
}

export function createSurfaceDetail(renderer) {
  const normalMap = createMicroNormalMap();
  normalMap.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const environment = new RoomEnvironment();
  const pmremGenerator = new PMREMGenerator(renderer);
  const environmentMap = pmremGenerator.fromScene(environment).texture;
  environment.dispose();
  pmremGenerator.dispose();

  const applyScene = (scene, { environmentLighting = false } = {}) => {
    scene.traverse((object) => {
      if (!object.isMesh) return;

      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      materials.forEach((material) => {
        Object.values(material).forEach((value) => {
          if (value?.isTexture) {
            value.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
          }
        });

        if (
          !material.normalMap
          && material.roughness >= 0.7
          && (material.metalness ?? 0) < 0.35
          && !material.transparent
          && !material.emissiveMap
          && !material.vertexColors
        ) {
          material.normalMap = normalMap;
          material.normalScale.set(0.055, 0.055);
          material.needsUpdate = true;
        }
      });
    });

    if (environmentLighting) {
      scene.environment = environmentMap;
      scene.environmentIntensity = 0.28;
    }
  };

  return { applyScene };
}
