import {
  BoxGeometry,
  Box3,
  CapsuleGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3
} from 'three';

function createProceduralCasualMale() {
  const root = new Group();
  root.name = 'casual male';

  const shirt = new MeshStandardMaterial({ color: 0x394d5c, roughness: 0.8 });
  const shirtTrim = new MeshStandardMaterial({ color: 0x243541, roughness: 0.82 });
  const pants = new MeshStandardMaterial({ color: 0x292b31, roughness: 0.91 });
  const skin = new MeshStandardMaterial({ color: 0xb98569, roughness: 0.76 });
  const lip = new MeshStandardMaterial({ color: 0x89584f, roughness: 0.72 });
  const hair = new MeshStandardMaterial({ color: 0x27211e, roughness: 0.94 });
  const shoes = new MeshStandardMaterial({ color: 0x171719, roughness: 0.86 });
  const dark = new MeshStandardMaterial({ color: 0x241819, roughness: 0.9 });
  const eyeWhite = new MeshStandardMaterial({ color: 0xd9d1c4, roughness: 0.62 });
  const iris = new MeshStandardMaterial({ color: 0x554335, roughness: 0.58 });
  const teeth = new MeshStandardMaterial({ color: 0xe4d9c4, roughness: 0.55 });
  const tongue = new MeshStandardMaterial({ color: 0x95525a, roughness: 0.76 });
  const button = new MeshStandardMaterial({ color: 0xa39377, roughness: 0.45, metalness: 0.12 });

  const addCapsule = (parent, radius, length, material, position) => {
    const mesh = new Mesh(new CapsuleGeometry(radius, length, 6, 12), material);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const addSphere = (parent, material, position, scale, geometry = new SphereGeometry(1, 20, 16)) => {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  const torso = new Group();
  torso.position.set(0, 1.05, 0);
  root.add(torso);
  addCapsule(torso, 0.235, 0.48, shirt, [0, 0.02, 0]);
  addSphere(torso, shirtTrim, [0, 0.2, 0.015], [0.075, 0.27, 0.225]);
  addCapsule(root, 0.12, 0.14, skin, [0, 1.46, 0]);

  for (const side of [-1, 1]) {
    addCapsule(root, 0.087, 0.68, pants, [side * 0.12, 0.43, 0]);
    const shoe = new Mesh(new BoxGeometry(0.17, 0.1, 0.28), shoes);
    shoe.position.set(side * 0.12, 0.07, 0.05);
    shoe.castShadow = true;
    root.add(shoe);
  }

  const head = new Group();
  head.position.set(0, 1.65, 0);
  root.add(head);
  addSphere(head, skin, [0, 0, 0], [0.177, 0.225, 0.164]);
  addSphere(head, hair, [0, 0.118, -0.012], [0.183, 0.115, 0.171]);
  addSphere(head, hair, [-0.162, 0.015, 0.005], [0.034, 0.09, 0.135]);
  addSphere(head, hair, [0.162, 0.015, 0.005], [0.034, 0.09, 0.135]);
  addSphere(head, skin, [-0.178, -0.015, 0], [0.045, 0.07, 0.035]);
  addSphere(head, skin, [0.178, -0.015, 0], [0.045, 0.07, 0.035]);

  for (const side of [-1, 1]) {
    addSphere(head, dark, [side * 0.07, 0.055, 0.139], [0.052, 0.026, 0.018]);
    addSphere(head, eyeWhite, [side * 0.07, 0.05, 0.153], [0.033, 0.016, 0.01]);
    addSphere(head, iris, [side * 0.07, 0.05, 0.162], [0.011, 0.013, 0.006]);
    addSphere(head, dark, [side * 0.07, 0.05, 0.167], [0.005, 0.008, 0.004]);
    const brow = addCapsule(head, 0.012, 0.065, hair, [side * 0.07, 0.093, 0.154]);
    brow.rotation.z = side * -0.08;
  }

  addSphere(head, skin, [0, -0.006, 0.163], [0.029, 0.045, 0.04]);
  addSphere(head, lip, [-0.072, -0.052, 0.133], [0.038, 0.009, 0.026]);
  addSphere(head, lip, [0.072, -0.052, 0.133], [0.038, 0.009, 0.026]);
  addSphere(head, skin, [-0.096, -0.07, 0.118], [0.014, 0.021, 0.01]);
  addSphere(head, skin, [0.096, -0.07, 0.118], [0.014, 0.021, 0.01]);

  const mouth = addSphere(head, dark, [0, -0.095, 0.147], [0.052, 0.024, 0.018]);
  addSphere(head, teeth, [0, -0.087, 0.163], [0.036, 0.009, 0.008]);
  addSphere(head, tongue, [0, -0.111, 0.162], [0.025, 0.007, 0.008]);
  const jaw = new Group();
  jaw.position.set(0, -0.1, 0.124);
  head.add(jaw);
  addSphere(jaw, skin, [0, -0.022, 0.006], [0.067, 0.04, 0.037]);
  addSphere(jaw, lip, [0, -0.006, 0.035], [0.047, 0.009, 0.012]);

  const createArm = (side) => {
    const shoulder = new Group();
    shoulder.position.set(side * 0.225, 1.27, 0);
    root.add(shoulder);
    addCapsule(shoulder, 0.105, 0.25, shirt, [0, -0.18, 0]);

    const elbow = new Group();
    elbow.position.y = -0.34;
    shoulder.add(elbow);
    addCapsule(elbow, 0.073, 0.27, skin, [0, -0.17, 0]);
    addSphere(elbow, skin, [0, -0.33, 0], [0.071, 0.075, 0.07]);

    const hand = new Group();
    hand.position.y = -0.35;
    elbow.add(hand);
    addSphere(hand, skin, [0, -0.012, 0], [0.075, 0.095, 0.052]);
    const fingers = [];
    for (let finger = 0; finger < 4; finger += 1) {
      const digit = new Group();
      digit.position.set((finger - 1.5) * 0.035, -0.04, 0.018);
      hand.add(digit);
      addCapsule(digit, 0.014, 0.055, skin, [0, -0.04, 0.012]);
      addSphere(digit, skin, [0, -0.073, 0.012], [0.014, 0.018, 0.014]);
      fingers.push(digit);
    }
    const thumb = new Group();
    thumb.position.set(side * -0.07, -0.005, 0.014);
    hand.add(thumb);
    addCapsule(thumb, 0.018, 0.065, skin, [side * -0.018, -0.033, 0.018]);

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
