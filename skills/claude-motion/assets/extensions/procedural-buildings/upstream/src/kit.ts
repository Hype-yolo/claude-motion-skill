/**
 * Loads the exported module kit (public/assets/kit.glb, tools/export_kit.py) and
 * renders instance lists as InstancedMeshes — one per module × material slot.
 * The GLB's placeholder materials are swapped for the rebuilt ones by name
 * (materials.ts); the node transforms (the kit's layout row in the .blend) are
 * ignored, exactly like the graph's ORIGINAL-space Object/Collection Info.
 */
import { BufferGeometry, Group, InstancedMesh, Material, Matrix4, Mesh } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { Instance } from "./generator";

interface Part {
  geometry: BufferGeometry;
  material: string;
}

/** whether a column-major 4×4 collapses an axis */
const flat = (m: number[]) =>
  [0, 4, 8].some(c => m[c] * m[c] + m[c + 1] * m[c + 1] + m[c + 2] * m[c + 2] < 1e-8);

export class Kit {
  private parts = new Map<string, Part[]>();
  private warned = new Set<string>();
  /** when set, buildGroup adds a snow-shell pass (child group "snowShell") that
   *  shares geometry + instanceMatrix with the opaque meshes — zero extra memory */
  snowShellMaterial: Material | null = null;

  constructor(private materials: Map<string, Material>) {}

  async load(glbUrl: string): Promise<void> {
    const gltf = await new GLTFLoader().loadAsync(glbUrl);
    for (const node of gltf.scene.children) {
      const list: Part[] = [];
      node.traverse(o => {
        const mesh = o as Mesh;
        if (!mesh.isMesh) return;
        // multi-material modules load as one child mesh per primitive, all at
        // identity under the node — the mesh data is already module-local
        list.push({ geometry: mesh.geometry, material: (mesh.material as Material).name });
      });
      this.parts.set(node.name, list);
    }
  }

  /** Build a Group of InstancedMeshes from instances (matrices in Blender Z-up space). */
  buildGroup(instances: Instance[]): Group {
    const group = new Group();
    const byKey = new Map<string, Matrix4[]>();
    for (const inst of instances) {
      // a zero-scale axis (Detail Depth 0) has nothing to show, and three's
      // instanced normal divides by each axis' squared length: NaN pixels
      if (flat(inst.m)) continue;
      let list = byKey.get(inst.key);
      if (!list) byKey.set(inst.key, (list = []));
      list.push(new Matrix4().fromArray(inst.m));
    }

    // separate layer of duplicated (buffer-shared) meshes that the snow shader
    // extrudes — the base building geometry stays untouched
    const snowLayer = new Group();
    snowLayer.name = "snowShell";
    snowLayer.visible = false;

    for (const [key, matrices] of byKey) {
      const parts = this.parts.get(key);
      if (!parts) {
        if (!this.warned.has(key)) {
          this.warned.add(key);
          console.warn(`kit: missing module ${key}`);
        }
        continue;
      }
      for (const part of parts) {
        const material = this.materials.get(part.material);
        if (!material) {
          console.warn(`kit: no material ${part.material} for ${key}`);
          continue;
        }
        const im = new InstancedMesh(part.geometry, material, matrices.length);
        im.name = `${key}:${part.material}`;
        const glass = material.transparent;
        im.castShadow = !glass;
        im.receiveShadow = !glass;
        matrices.forEach((m, i) => im.setMatrixAt(i, m));
        im.instanceMatrix.needsUpdate = true;
        im.computeBoundingSphere();
        if (glass) {
          im.renderOrder = 2; // after the curtains behind it
          im.userData.noAO = true; // transparent: must not occlude the AO pass
        }
        group.add(im);

        // snow shell pass: same geometry, SAME instanceMatrix buffer — only the
        // vertex shader extrudes it, and fragments off the snow cap are discarded
        if (this.snowShellMaterial && !glass) {
          const shell = new InstancedMesh(part.geometry, this.snowShellMaterial, matrices.length);
          shell.instanceMatrix = im.instanceMatrix;
          shell.castShadow = false;
          shell.receiveShadow = true;
          snowLayer.add(shell);
        }
      }
    }
    if (snowLayer.children.length) group.add(snowLayer);
    return group;
  }
}
