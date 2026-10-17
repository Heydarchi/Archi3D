// Step 0 smoke view: one lit, rotated cube on a fixed background.
import * as THREE from 'three';

export function renderCube(root: HTMLElement): void {
  const w = root.clientWidth, h = root.clientHeight;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(w, h);
  root.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xeef1f5);
  const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
  camera.position.set(0, 0, 6);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 0.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(3, 5, 4);
  scene.add(sun);

  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(2, 2, 2),
    new THREE.MeshStandardMaterial({ color: 0x3b82c4, roughness: 0.6, metalness: 0 }),
  );
  cube.rotation.set(0.5, 0.7, 0);
  scene.add(cube);

  renderer.render(scene, camera);
}
