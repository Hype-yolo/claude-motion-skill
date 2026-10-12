// Debug free camera: WASD + Q/E, drag to look, shift for speed.
import * as THREE from 'three/webgpu';

export class FlyCam {
  constructor(camera, dom) {
    this.camera = camera;
    this.yaw = 0;
    this.pitch = 0;
    this.keys = new Set();
    this.enabled = true;
    this.speed = 20;
    addEventListener('keydown', (e) => this.keys.add(e.code));
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    let drag = false, lx = 0, ly = 0;
    dom.addEventListener('pointerdown', (e) => { drag = true; lx = e.clientX; ly = e.clientY; });
    addEventListener('pointerup', () => (drag = false));
    addEventListener('pointermove', (e) => {
      if (!drag || !this.enabled) return;
      this.yaw -= (e.clientX - lx) * 0.003;
      this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch - (e.clientY - ly) * 0.003));
      lx = e.clientX; ly = e.clientY;
    });
  }

  set(x, y, z, yaw = 0, pitch = 0) {
    this.camera.position.set(x, y, z);
    this.yaw = yaw;
    this.pitch = pitch;
    this.apply();
  }

  apply() {
    this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
  }

  update(dt) {
    if (!this.enabled) return;
    const k = this.keys;
    const f = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
    const s = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    const u = (k.has('KeyE') ? 1 : 0) - (k.has('KeyQ') ? 1 : 0);
    const sp = this.speed * (k.has('ShiftLeft') ? 8 : 1) * dt;
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this.camera.position.addScaledVector(fwd, f * sp).addScaledVector(right, s * sp);
    this.camera.position.y += u * sp;
    this.apply();
  }
}
