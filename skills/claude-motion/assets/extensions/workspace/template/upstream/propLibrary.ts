import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';

/** Props exported by assets/blender/build_props.py into a single GLB (one named mesh per prop). */
export const PROP_NAMES = [
  'desk',
  'office_chair',
  'monitor',
  'keyboard',
  'mouse',
  'mug',
  'mug_blue',
  'mug_yellow',
  'desk_lamp',
  'plant_small',
  'notebook',
  'pen_holder',
  'headphones',
  'water_bottle',
  'paper_stack',
  'sticky_notes',
  'laptop',
  'bookshelf',
  'filing_cabinet',
  'trash_bin',
  'plant_tall',
  'plant_snake',
  'ceiling_light',
  'floor_lamp',
  'printer',
  'printer_stand',
  'coat_rack',
  'wall_clock',
  'radiator',
  'fire_extinguisher',
  'door',
  'storage_boxes',
  'umbrella_stand',
  'wall_shelf',
  'poster_a',
  'poster_b',
  'poster_c',
  'sofa',
  'armchair',
  'coffee_table',
  'rug',
  'water_cooler',
  'kitchen_counter',
  'coffee_machine',
  'fridge',
  'microwave',
  'bar_stool',
  'high_table',
  'meeting_table',
  'meeting_chair',
  'tv_screen',
  'bean_bag',
  'fruit_bowl',
  'planter_box',
  // Outdoors.
  'tree_round',
  'tree_birch',
  'tree_conifer',
  'bush',
  'hedge',
  'flower_bed',
  'bench',
  'street_lamp',
  'bollard',
  'bike_rack',
  'outdoor_bin',
  'car_red',
  'car_blue',
  'car_white',
  'outdoor_table',
  'outdoor_chair',
  'parasol',
  'entrance_canopy',
  'sign_monolith',
] as const;

export type PropName = (typeof PROP_NAMES)[number];

export const PROPS_URL = '/models/props.glb';

export interface PropModel {
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
}

/** Outdoor light materials (street lamps, bollards): lit at night only, see OutdoorLights. */
export const LAMP_MATERIALS = new Set<THREE.MeshStandardMaterial>();

/** Adapts the exported class materials (colors come from vertex colors) to the scene. */
function tuneMaterial(material: THREE.Material): THREE.Material {
  const standard = material as THREE.MeshStandardMaterial;
  standard.vertexColors = true;
  if (material.name === 'class_emissive') {
    standard.emissive = new THREE.Color('#fff1d6');
    standard.emissiveIntensity = 1.6;
    standard.toneMapped = false;
  }
  if (material.name === 'class_lamp') {
    standard.emissive = new THREE.Color('#ffe2a8');
    standard.emissiveIntensity = 0;
    standard.toneMapped = false;
    LAMP_MATERIALS.add(standard);
  }
  if (material.name === 'class_glass') {
    standard.transparent = true;
    standard.opacity = 0.35;
    standard.depthWrite = false;
  }
  return material;
}

export function usePropLibrary(): Map<PropName, PropModel> {
  const gltf = useGLTF(PROPS_URL);
  return useMemo(() => {
    const library = new Map<PropName, PropModel>();
    const tuned = new Set<THREE.Material>();
    gltf.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        if (!tuned.has(material)) {
          tuneMaterial(material);
          tuned.add(material);
        }
      }
      library.set(mesh.name as PropName, { geometry: mesh.geometry, material: mesh.material });
    });
    // A multi-material prop is exported as a group of one mesh per material: merge them back.
    gltf.scene.children.forEach((child) => {
      if ((child as THREE.Mesh).isMesh || child.children.length === 0) return;
      const meshes = child.children.filter((entry): entry is THREE.Mesh => (entry as THREE.Mesh).isMesh);
      if (meshes.length === 0) return;
      const geometries = meshes.map((mesh) => mesh.geometry);
      const merged = mergeWithGroups(geometries);
      library.set(child.name as PropName, {
        geometry: merged,
        material: meshes.map((mesh) => mesh.material as THREE.Material),
      });
    });
    return library;
  }, [gltf]);
}

/** Concatenates geometries sharing the same attributes, one draw group per source geometry. */
function mergeWithGroups(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = new THREE.BufferGeometry();
  const names = Object.keys(geometries[0]!.attributes);
  for (const name of names) {
    const sources = geometries.map((geometry) => geometry.getAttribute(name) as THREE.BufferAttribute);
    const itemSize = sources[0]!.itemSize;
    const total = sources.reduce((sum, attribute) => sum + attribute.count * itemSize, 0);
    const array = new Float32Array(total);
    let offset = 0;
    for (const attribute of sources) {
      for (let i = 0; i < attribute.count; i++) {
        for (let k = 0; k < itemSize; k++) array[offset + i * itemSize + k] = attribute.getComponent(i, k);
      }
      offset += attribute.count * itemSize;
    }
    merged.setAttribute(name, new THREE.BufferAttribute(array, itemSize));
  }
  const indices: number[] = [];
  let vertexOffset = 0;
  geometries.forEach((geometry, groupIndex) => {
    const index = geometry.getIndex();
    const start = indices.length;
    if (index) {
      for (let i = 0; i < index.count; i++) indices.push(index.getX(i) + vertexOffset);
    } else {
      for (let i = 0; i < geometry.getAttribute('position').count; i++) indices.push(i + vertexOffset);
    }
    merged.addGroup(start, indices.length - start, groupIndex);
    vertexOffset += geometry.getAttribute('position').count;
  });
  merged.setIndex(indices);
  merged.computeBoundingSphere();
  return merged;
}

useGLTF.preload(PROPS_URL);
