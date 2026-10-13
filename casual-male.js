import {
  BoxGeometry,
  Box3,
  CapsuleGeometry,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3
} from 'three';

function createProceduralCasualMale() {
  const root = new Group();
  root.name = 'casual male';

  const shirt = new MeshPhysicalMaterial({ color: 0x40566a, roughness: 0.78, metalness: 0.06, clearcoat: 0.08, clearcoatRoughness: 0.9 });
  const shirtTrim = new MeshStandardMaterial({ color: 0x213844, roughness: 0.82 });
  const pants = new MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.9 });
  const skin = new MeshPhysicalMaterial({ color: 0xbf8a68, roughness: 0.7, clearcoat: 0.06, clearcoatRoughness: 0.9 });
  const lip = new MeshStandardMaterial({ color: 0x824a45, roughness: 0.6 });
  const hair = new MeshStandardMaterial({ color: 0x1f1a18, roughness: 0.94 });
  const shoes = new MeshStandardMaterial({ color: 0x171719, roughness: 0.86 });
  const dark = new MeshStandardMaterial({ color: 0x1f1719, roughness: 0.96 });
  const eyeWhite = new MeshPhysicalMaterial({ color: 0xdfd9ca, roughness: 0.65, clearcoat: 0.05 });
  const iris = new MeshStandardMaterial({ color: 0x47372b, roughness: 0.52 });
  const teeth = new MeshPhysicalMaterial({ color: 0xe4d9c4, roughness: 0.4, clearcoat: 0.12 });
  const tongue = new MeshStandardMaterial({ color: 0xa14f5d, roughness: 0.7 });

  const addCapsule = (parent, radius, length, material, position) => {
    const mesh = new Mesh(new CapsuleGeometry(radius, length, 6, 12), material);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const addSphere = (parent, material, position, scale, geometry = new SphereGeometry(1, 26, 18)) => {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  const torso = new Group();
  torso.position.set(0, 1.03, 0);
  root.add(torso);
  const torsoCore = addCapsule(torso, 0.24, 0.52, shirt, [0, 0.04, 0]);
  torsoCore.scale.z = 1.06;
  addSphere(torso, shirtTrim, [0, 0.2, 0.012], [0.08, 0.24, 0.21]);
  addSphere(root, skin, [0, 1.48, 0], [0.09, 0.12, 0.09]);

  for (const side of [-1, 1]) {
    addCapsule(root, 0.096, 0.66, pants, [side * 0.12, 0.41, 0]);
    const shoe = new Mesh(new BoxGeometry(0.17, 0.09, 0.3), shoes);
    shoe.position.set(side * 0.12, 0.07, 0.06);
    shoe.castShadow = true;
    shoe.receiveShadow = true;
    root.add(shoe);
  }

  const head = new Group();
  head.position.set(0, 1.68, 0);
  root.add(head);
  addSphere(head, skin, [0, 0, 0], [0.18, 0.224, 0.17]);

  const hairCap = addSphere(head, hair, [0, 0.12, -0.015], [0.188, 0.11, 0.175]);
  hairCap.scale.y = 1.2;
  addSphere(head, hair, [-0.162, 0.022, 0], [0.04, 0.095, 0.12]);
  addSphere(head, hair, [0.162, 0.022, 0], [0.04, 0.095, 0.12]);
  addSphere(head, hair, [0, 0.15, 0.03], [0.12, 0.05, 0.12]);

  for (const side of [-1, 1]) {
    const ear = addSphere(head, skin, [side * 0.177, 0.01, 0], [0.022, 0.056, 0.025]);
    ear.scale.x = 0.7;

    addSphere(head, dark, [side * 0.07, 0.055, 0.137], [0.05, 0.026, 0.018]);
    addSphere(head, eyeWhite, [side * 0.07, 0.05, 0.155], [0.034, 0.016, 0.01]);
    addSphere(head, iris, [side * 0.07, 0.05, 0.164], [0.011, 0.013, 0.006]);
    addSphere(head, dark, [side * 0.07, 0.05, 0.171], [0.006, 0.008, 0.004]);

    const brow = addCapsule(head, 0.011, 0.06, hair, [side * 0.07, 0.096, 0.156]);
    brow.rotation.z = side * -0.08;
    brow.rotation.y = side * 0.28;
  }

  const nose = new Mesh(new CapsuleGeometry(0.014, 0.08, 6, 12), skin);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, -0.022, 0.172);
  nose.castShadow = true;
  nose.receiveShadow = true;
  head.add(nose);

  addSphere(head, skin, [0, -0.005, 0.166], [0.028, 0.05, 0.04]);
  addSphere(head, lip, [-0.073, -0.062, 0.133], [0.038, 0.009, 0.024]);
  addSphere(head, lip, [0.073, -0.062, 0.133], [0.038, 0.009, 0.024]);
  addSphere(head, skin, [-0.098, -0.08, 0.118], [0.013, 0.02, 0.01]);
  addSphere(head, skin, [0.098, -0.08, 0.118], [0.013, 0.02, 0.01]);

  const mouth = addSphere(head, dark, [0, -0.096, 0.147], [0.055, 0.024, 0.018]);
  addSphere(head, teeth, [0, -0.086, 0.162], [0.038, 0.009, 0.008]);
  addSphere(head, tongue, [0, -0.112, 0.162], [0.024, 0.008, 0.008]);
  const jaw = new Group();
  jaw.position.set(0, -0.1, 0.124);
  head.add(jaw);
  addSphere(jaw, skin, [0, -0.022, 0.006], [0.068, 0.04, 0.037]);
  addSphere(jaw, lip, [0, -0.006, 0.035], [0.047, 0.009, 0.012]);

  const createArm = (side) => {
    const shoulder = new Group();
    shoulder.position.set(side * 0.225, 1.27, 0);
    root.add(shoulder);
    addCapsule(shoulder, 0.108, 0.25, shirt, [0, -0.18, 0]);

    const elbow = new Group();
    elbow.position.y = -0.34;
    shoulder.add(elbow);
    addCapsule(elbow, 0.07, 0.28, skin, [0, -0.16, 0]);
    addSphere(elbow, skin, [0, -0.33, 0], [0.071, 0.076, 0.07]);

    const hand = new Group();
    hand.position.y = -0.35;
    elbow.add(hand);
    addSphere(hand, skin, [0, -0.012, 0], [0.078, 0.096, 0.056]);
    const fingers = [];
    for (let finger = 0; finger < 4; finger += 1) {
      const digit = new Group();
      digit.position.set((finger - 1.5) * 0.035, -0.04, 0.018);
      hand.add(digit);
      addCapsule(digit, 0.013, 0.057, skin, [0, -0.04, 0.011]);
      addSphere(digit, skin, [0, -0.073, 0.012], [0.014, 0.018, 0.014]);
      fingers.push(digit);
    }
    const thumb = new Group();
    thumb.position.set(side * -0.07, -0.004, 0.014);
    hand.add(thumb);
    addCapsule(thumb, 0.018, 0.066, skin, [side * -0.018, -0.033, 0.018]);

    return { shoulder, elbow, hand, fingers, thumb };
  };

  const leftArm = createArm(-1);
  const rightArm = createArm(1);

  return {
    root,
    torso,
    head,
    mouth,
    jaw,
    leftShoulder: leftArm.shoulder,
    rightShoulder: rightArm.shoulder,
    leftElbow: leftArm.elbow,
    rightElbow: rightArm.elbow,
    leftHand: leftArm.hand,
    rightHand: rightArm.hand,
    leftFingers: leftArm.fingers,
    rightFingers: rightArm.fingers,
    leftThumb: leftArm.thumb,
    rightThumb: rightArm.thumb
  };
}

export async function createCasualMale() {
  const fallback = createProceduralCasualMale();

  try {
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(new URL('./freddie_single_camera_speedscan_gltf/scene.gltf', import.meta.url).href);

    const model = gltf.scene;
    model.name = 'freddie model';
    model.updateMatrixWorld(true);
    const modelBounds = new Box3().setFromObject(model);
    const size = modelBounds.getSize(new Vector3());
    const isLikelyBroken =
      !Number.isFinite(size.x) ||
      !Number.isFinite(size.y) ||
      !Number.isFinite(size.z) ||
      size.x < 0.1 ||
      size.y < 0.1 ||
      size.z < 0.1 ||
      model.children.length === 0;

    if (isLikelyBroken) {
      throw new Error('The Freddie model did not contain valid geometry.');
    }

    const root = new Group();
    root.name = 'freddie';

    model.scale.setScalar(0.042);
    model.rotation.set(0.08, 0, 0);
    model.position.set(0, 0, 0);
    model.updateMatrixWorld(true);
    const transformedBounds = new Box3().setFromObject(model);
    const modelCenter = transformedBounds.getCenter(new Vector3());

    const head = new Group();
    head.position.set(0, 1.68, 0);
    root.add(head);
    model.position.set(-modelCenter.x, -transformedBounds.min.y, -modelCenter.z);
    head.add(model);

    const pelvis = new Group();
    pelvis.position.set(0, 0.82, 0);
    root.add(pelvis);

    const torso = new Group();
    torso.position.set(0, 0.98, 0);
    root.add(torso);

    const shirtMaterial = new MeshStandardMaterial({ color: 0x3f4f5d, roughness: 0.78 });
    const torsoCore = new Mesh(
      new CapsuleGeometry(0.23, 0.52, 8, 16),
      shirtMaterial
    );
    torsoCore.position.set(0, 0.06, 0);
    torsoCore.castShadow = true;
    torsoCore.receiveShadow = true;
    torso.add(torsoCore);

    const shirtTrim = new Mesh(
      new BoxGeometry(0.18, 0.18, 0.22),
      new MeshStandardMaterial({ color: 0x253540, roughness: 0.82 })
    );
    shirtTrim.position.set(0, 0.24, 0.03);
    shirtTrim.castShadow = true;
    shirtTrim.receiveShadow = true;
    torso.add(shirtTrim);

    const neck = new Mesh(
      new CapsuleGeometry(0.085, 0.12, 6, 12),
      new MeshStandardMaterial({ color: 0xb98569, roughness: 0.76 })
    );
    neck.position.set(0, 1.54, 0);
    neck.castShadow = true;
    neck.receiveShadow = true;
    root.add(neck);

    for (const side of [-1, 1]) {
      const leg = new Group();
      leg.position.set(side * 0.12, -0.1, 0);
      root.add(leg);

      const thigh = new Mesh(
        new CapsuleGeometry(0.11, 0.48, 6, 12),
        new MeshStandardMaterial({ color: 0x2a2c31, roughness: 0.9 })
      );
      thigh.position.set(0, -0.28, 0);
      thigh.castShadow = true;
      thigh.receiveShadow = true;
      leg.add(thigh);

      const shoe = new Mesh(
        new BoxGeometry(0.18, 0.1, 0.3),
        new MeshStandardMaterial({ color: 0x171719, roughness: 0.86 })
      );
      shoe.position.set(0, -0.6, 0.05);
      shoe.castShadow = true;
      shoe.receiveShadow = true;
      leg.add(shoe);
    }

    const mouth = new Group();
    mouth.name = 'mouth';
    mouth.position.set(0, -0.09, 0.13);
    mouth.scale.y = 0.35;
    head.add(mouth);

    const jaw = new Group();
    jaw.name = 'jaw';
    jaw.position.set(0, -0.13, 0.12);
    head.add(jaw);

    const leftShoulder = new Group();
    leftShoulder.position.set(-0.22, 1.25, 0);
    root.add(leftShoulder);

    const rightShoulder = new Group();
    rightShoulder.position.set(0.22, 1.25, 0);
    root.add(rightShoulder);

    const skinMaterial = new MeshStandardMaterial({ color: 0xb98569, roughness: 0.76 });
    const addLimb = (parent, radius, length, material, y) => {
      const limb = new Mesh(new CapsuleGeometry(radius, length, 6, 12), material);
      limb.position.set(0, y, 0);
      limb.castShadow = true;
      limb.receiveShadow = true;
      parent.add(limb);
    };
    for (const shoulder of [leftShoulder, rightShoulder]) {
      addLimb(shoulder, 0.105, 0.25, shirtMaterial, -0.18);
    }

    const leftElbow = new Group();
    leftElbow.position.set(0, -0.28, 0);
    leftShoulder.add(leftElbow);

    const rightElbow = new Group();
    rightElbow.position.set(0, -0.28, 0);
    rightShoulder.add(rightElbow);

    for (const elbow of [leftElbow, rightElbow]) {
      addLimb(elbow, 0.073, 0.27, skinMaterial, -0.17);
    }

    const leftHand = new Group();
    leftHand.position.set(0, -0.34, 0);
    leftElbow.add(leftHand);

    const rightHand = new Group();
    rightHand.position.set(0, -0.34, 0);
    rightElbow.add(rightHand);

    for (const hand of [leftHand, rightHand]) {
      const palm = new Mesh(new SphereGeometry(1, 16, 12), skinMaterial);
      palm.position.set(0, -0.012, 0);
      palm.scale.set(0.075, 0.095, 0.052);
      palm.castShadow = true;
      palm.receiveShadow = true;
      hand.add(palm);
    }

    const leftFingers = Array.from({ length: 4 }, (_, index) => {
      const finger = new Group();
      finger.position.set((index - 1.5) * 0.035, -0.04, 0.02);
      leftHand.add(finger);
      addLimb(finger, 0.014, 0.055, skinMaterial, -0.04);
      return finger;
    });
    const rightFingers = Array.from({ length: 4 }, (_, index) => {
      const finger = new Group();
      finger.position.set((index - 1.5) * 0.035, -0.04, 0.02);
      rightHand.add(finger);
      addLimb(finger, 0.014, 0.055, skinMaterial, -0.04);
      return finger;
    });

    const leftThumb = new Group();
    leftThumb.position.set(-0.07, -0.01, 0.02);
    leftHand.add(leftThumb);
    addLimb(leftThumb, 0.018, 0.065, skinMaterial, -0.033);

    const rightThumb = new Group();
    rightThumb.position.set(0.07, -0.01, 0.02);
    rightHand.add(rightThumb);
    addLimb(rightThumb, 0.018, 0.065, skinMaterial, -0.033);

    return {
      root,
      torso,
      head,
      mouth,
      jaw,
      leftShoulder,
      rightShoulder,
      leftElbow,
      rightElbow,
      leftHand,
      rightHand,
      leftFingers,
      rightFingers,
      leftThumb,
      rightThumb
    };
  } catch (error) {
    console.warn('Freddie model failed validation; falling back to the procedural character.', error);
    return fallback;
  }
}
