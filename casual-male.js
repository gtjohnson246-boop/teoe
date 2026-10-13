import {
  BoxGeometry,
  CapsuleGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry
} from 'three';

export function createCasualMale() {
  const root = new Group();
  root.name = 'casual male';

  const shirt = new MeshStandardMaterial({ color: 0x526a78, roughness: 0.92 });
  const pants = new MeshStandardMaterial({ color: 0x292b31, roughness: 0.95 });
  const skin = new MeshStandardMaterial({ color: 0xb98567, roughness: 0.88 });
  const hair = new MeshStandardMaterial({ color: 0x26201c, roughness: 1 });
  const shoes = new MeshStandardMaterial({ color: 0x171719, roughness: 0.9 });
  const dark = new MeshStandardMaterial({ color: 0x171011, roughness: 1 });
  const eye = new MeshStandardMaterial({ color: 0x211b19, roughness: 0.7 });

  const addCapsule = (parent, radius, length, material, position) => {
    const mesh = new Mesh(new CapsuleGeometry(radius, length, 4, 8), material);
    mesh.position.set(...position);
    parent.add(mesh);
    return mesh;
  };
  const addSphere = (parent, material, position, scale) => {
    const mesh = new Mesh(new SphereGeometry(1, 12, 10), material);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    parent.add(mesh);
    return mesh;
  };

  addCapsule(root, 0.23, 0.42, shirt, [0, 1.06, 0]);
  addSphere(root, shirt, [0, 0.73, 0], [0.235, 0.17, 0.14]);

  for (const side of [-1, 1]) {
    addCapsule(root, 0.085, 0.68, pants, [side * 0.12, 0.43, 0]);
    const shoe = new Mesh(new BoxGeometry(0.17, 0.1, 0.28), shoes);
    shoe.position.set(side * 0.12, 0.07, 0.05);
    root.add(shoe);
  }

  const head = new Group();
  head.position.set(0, 1.65, 0);
  root.add(head);
  addSphere(head, skin, [0, 0, 0], [0.18, 0.23, 0.17]);
  addSphere(head, hair, [0, 0.12, -0.005], [0.185, 0.12, 0.18]);
  addSphere(head, hair, [-0.16, 0.02, 0], [0.04, 0.11, 0.15]);
  addSphere(head, hair, [0.16, 0.02, 0], [0.04, 0.11, 0.15]);

  for (const side of [-1, 1]) {
    addSphere(head, eye, [side * 0.065, 0.03, 0.148], [0.018, 0.025, 0.012]);
  }
  addSphere(head, skin, [0, -0.035, 0.17], [0.035, 0.05, 0.035]);
  const mouth = addSphere(head, dark, [0, -0.105, 0.148], [0.053, 0.018, 0.014]);

  const createArm = (side) => {
    const shoulder = new Group();
    shoulder.position.set(side * 0.25, 1.32, 0);
    root.add(shoulder);
    addCapsule(shoulder, 0.075, 0.29, shirt, [0, -0.2, 0]);

    const elbow = new Group();
    elbow.position.y = -0.38;
    shoulder.add(elbow);
    addCapsule(elbow, 0.062, 0.28, skin, [0, -0.17, 0]);

    const hand = new Group();
    hand.position.y = -0.36;
    elbow.add(hand);
    addSphere(hand, skin, [0, -0.015, 0], [0.07, 0.085, 0.055]);
    for (let finger = 0; finger < 4; finger += 1) {
      addCapsule(
        hand,
        0.014,
        0.07,
        skin,
        [(finger - 1.5) * 0.031, -0.085, 0.018]
      );
    }

    return { shoulder, elbow, hand };
  };

  const leftArm = createArm(-1);
  const rightArm = createArm(1);

  return {
    root,
    head,
    mouth,
    leftShoulder: leftArm.shoulder,
    rightShoulder: rightArm.shoulder,
    leftElbow: leftArm.elbow,
    rightElbow: rightArm.elbow,
    leftHand: leftArm.hand,
    rightHand: rightArm.hand
  };
}
