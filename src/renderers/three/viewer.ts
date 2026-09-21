import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Building, CityScene } from '../../core/model';
import { cityPalette } from '../../core/theme';
import { buildingArchitecture } from '../../core/architecture';
import { canvasToPng } from '../../core/image-export';
import { windowColor } from '../../core/activity';
import { archivedColor, spireBase } from '../../core/repository-signals';
import { districtAnchors, labelLeader, placeDistrictLabels } from '../../core/district-labels';

export interface ViewerState {
  selectedId: string;
  repository: string;
  showLabels: boolean;
  zoom: number;
  reset: number;
}
export interface ViewerEvents {
  hover: (id: string | null) => void;
  select: (id: string) => void;
  zoom: (value: number) => void;
  failed: () => void;
}

/** The scene's ground Y axis becomes Three.js Z. Dimensions are never relaid out. */
export function createViewer(host: HTMLDivElement, data: CityScene, events: ViewerEvents) {
  const archived = new Set(
    data.repositories.filter((repo) => repo.archived).map((repo) => repo.name),
  );
  const palette = cityPalette(data);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0, 0);
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'application');
  canvas.setAttribute(
    'aria-label',
    '3D city. Drag to rotate, right-drag to pan, scroll to zoom. Arrow keys rotate; Home resets.',
  );
  host.append(canvas);
  const world = new THREE.Scene();
  world.add(new THREE.HemisphereLight('#dceeff', '#314353', 1.5));
  const light = new THREE.DirectionalLight('#ffffff', 2.0);
  light.position.set(-150, 240, 180);
  world.add(light);
  const bounds = data.bounds ?? { x: 0, y: 0, width: 168, depth: 168 };
  const center = new THREE.Vector3(bounds.x + bounds.width / 2, 8, bounds.y + bounds.depth / 2);
  const span = Math.max(bounds.width, bounds.depth, 50);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, span * 20);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = false;
  controls.minPolarAngle = Math.PI / 12;
  controls.maxPolarAngle = Math.PI / 2.15;
  controls.screenSpacePanning = true;
  // Render only after user input or a scene change; no idle animation loop.
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const materials: THREE.Material[] = [];
  const meshes: THREE.InstancedMesh[] = [];
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  type Part = {
    x: number;
    y: number;
    z: number;
    w: number;
    h: number;
    d: number;
    color: string;
    repo: string;
    buildingIndex?: number;
  };
  function batch(parts: Part[], unlit = false, shape: THREE.BufferGeometry = geometry) {
    const material = unlit ? new THREE.MeshBasicMaterial() : new THREE.MeshLambertMaterial();
    materials.push(material);
    const mesh = new THREE.InstancedMesh(shape, material, parts.length);
    parts.forEach((p, index) => {
      p.color = archivedColor(p.color, archived.has(p.repo));
      position.set(p.x + p.w / 2, p.y + p.h / 2, p.z + p.d / 2);
      scale.set(p.w, p.h, p.d);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(index, matrix);
      mesh.setColorAt(index, new THREE.Color(p.color));
    });
    mesh.computeBoundingSphere();
    world.add(mesh);
    meshes.push(mesh);
    return mesh;
  }
  const groundParts: Part[] = [
    {
      x: bounds.x - 5,
      y: -5,
      z: bounds.y - 5,
      w: bounds.width + 10,
      h: 5,
      d: bounds.depth + 10,
      color: palette.slab,
      repo: '',
    },
    {
      x: bounds.x - 5,
      y: 0,
      z: bounds.y - 5,
      w: bounds.width + 10,
      h: 0.1,
      d: bounds.depth + 10,
      color: palette.ground,
      repo: '',
    },
  ];
  if (data.isFixture && data.repositories.length > 1) {
    groundParts.push(
      { x: 79, y: 0.12, z: -3, w: 10, h: 0.1, d: 174, color: palette.road, repo: '' },
      { x: -3, y: 0.12, z: 79, w: 174, h: 0.1, d: 10, color: palette.road, repo: '' },
    );
  }
  const buildings = data.repositories.flatMap((repo) =>
    repo.buildings.map((b) => ({ ...b, repo: repo.name, cityOnly: repo.privacy === 'city-only' })),
  );
  const bodies: Part[] = [];
  const details: Part[] = [];
  const windows: Part[] = [];
  const roofs: Part[] = [];
  for (const repo of data.repositories) {
    const r = repo.bounds;
    groundParts.push({
      x: r.x,
      y: 0.2,
      z: r.y,
      w: r.width,
      h: 0.1,
      d: r.depth,
      color: palette.district,
      repo: repo.name,
    });
    const border = Math.min(2, r.width * 0.08, r.depth * 0.08);
    groundParts.push({
      x: r.x + border,
      y: 0.31,
      z: r.y + border,
      w: r.width - 2 * border,
      h: 0.03,
      d: r.depth - 2 * border,
      color: repo.name === 'docs' ? palette.park : palette.pavement,
      repo: repo.name,
    });
    for (const block of repo.blocks ?? []) {
      const b = block.bounds;
      groundParts.push({
        x: b.x,
        y: 0.35,
        z: b.y,
        w: b.width,
        h: 0.1,
        d: b.depth,
        color: palette.block,
        repo: repo.name,
      });
    }
    if (Math.min(r.width, r.depth) > 20) {
      for (let i = 0; i < 7; i++) {
        const x = r.x + 3 + ((r.width - 6) * i) / 6;
        details.push({
          x,
          y: 0.5,
          z: r.y + r.depth - 3,
          w: 0.6,
          h: 3,
          d: 0.6,
          color: '#7b7361',
          repo: repo.name,
        });
        details.push({
          x: x - 1,
          y: 2.4,
          z: r.y + r.depth - 4,
          w: 2.6,
          h: 3 + (i % 3),
          d: 2.6,
          color: '#426d57',
          repo: repo.name,
        });
      }
    }
  }
  buildings.forEach((b, buildingIndex) => {
    const design = buildingArchitecture(b, buildings.length);
    const { x, y: z } = b.position;
    const repo = b.repo;
    const convert = (part: (typeof design.solids)[number]): Part => ({
      x: x + part.x,
      y: part.z,
      z: z + part.y,
      w: part.width,
      h: part.height,
      d: part.depth,
      color: part.color,
      repo,
      buildingIndex,
    });
    bodies.push(...design.solids.map(convert));
    windows.push(
      ...design.windows.map((pane) => ({ ...convert(pane), color: windowColor(b, pane.color) })),
    );
    if (design.pitchedRoof) roofs.push(convert(design.pitchedRoof));
    if (b.spireHeight) {
      const base = spireBase(b);
      const thickness = Math.min(b.width, b.depth, 8) * 0.09;
      details.push({
        x: x + b.width / 2 - thickness / 2,
        y: base,
        z: z + b.depth / 2 - thickness / 2,
        w: thickness,
        h: b.spireHeight,
        d: thickness,
        color: '#e1bf74',
        repo,
      });
      details.push({
        x: x + b.width / 2 - thickness,
        y: base + b.spireHeight,
        z: z + b.depth / 2 - thickness,
        w: thickness * 2,
        h: 0.6,
        d: thickness * 2,
        color: '#e1bf74',
        repo,
      });
    }
  });
  const roofGeometry = new THREE.BufferGeometry();
  const corners = [
    [-0.5, -0.5, -0.5],
    [0.5, -0.5, -0.5],
    [0, 0.5, -0.5],
    [-0.5, -0.5, 0.5],
    [0.5, -0.5, 0.5],
    [0, 0.5, 0.5],
  ];
  const faces = [0, 2, 1, 3, 4, 5, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4, 0, 1, 4, 0, 4, 3];
  roofGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      faces.flatMap((index) => corners[index]),
      3,
    ),
  );
  roofGeometry.computeVertexNormals();
  batch(groundParts);
  const bodyMesh = batch(bodies);
  const roofMesh = batch(roofs, false, roofGeometry);
  batch(details);
  batch(windows, true);
  const edges = new THREE.EdgesGeometry(geometry);
  const edgeMaterial = new THREE.LineBasicMaterial({ color: palette.highlight });
  const selection = new THREE.LineSegments(edges, edgeMaterial);
  world.add(selection);
  const multiDistrict = data.repositories.length > 1;
  const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  overlay.classList.add('three-leaders');
  overlay.setAttribute('aria-hidden', 'true');
  host.append(overlay);
  const repoNames = data.repositories.map((repo) => repo.name).sort();
  const labels = data.repositories.map((repo) => {
    const label = document.createElement('span');
    label.className = 'three-label';
    label.textContent = repo.name;
    const number = String(repoNames.indexOf(repo.name) + 1).padStart(2, '0');
    if (multiDistrict) label.dataset.districtNumber = number;
    host.append(label);
    const leader = document.createElementNS(overlay.namespaceURI, 'polyline');
    leader.setAttribute('fill', 'none');
    leader.setAttribute('stroke', data.theme.muted);
    leader.setAttribute('stroke-width', '1');
    const marker = document.createElementNS(overlay.namespaceURI, 'circle');
    marker.setAttribute('r', '8');
    marker.setAttribute('fill', palette.label);
    marker.setAttribute('stroke', data.theme.muted);
    const caption = document.createElementNS(overlay.namespaceURI, 'text');
    caption.textContent = number;
    caption.setAttribute('fill', data.theme.text);
    caption.setAttribute('font-size', '7');
    caption.setAttribute('font-family', 'system-ui,sans-serif');
    caption.setAttribute('text-anchor', 'middle');
    overlay.append(leader, marker, caption);
    return {
      label,
      leader,
      marker,
      caption,
      number,
      anchors: districtAnchors(repo),
      repo: repo.name,
      position: new THREE.Vector3(
        repo.bounds.x + repo.bounds.width / 2,
        0.6,
        repo.bounds.y + repo.bounds.depth + 3,
      ),
    };
  });
  let disposed = false;
  let frame = 0;
  let state: ViewerState = { selectedId: '', repository: '', showLabels: true, zoom: 1, reset: 0 };
  let fitZoom = 1;
  let width = 1;
  let height = 1;
  function labelPositions() {
    const screen = (point: { x: number; y: number }) => {
      const p = new THREE.Vector3(point.x, 0.6, point.y).project(camera);
      return { x: ((p.x + 1) * width) / 2, y: ((1 - p.y) * height) / 2 };
    };
    if (multiDistrict)
      return placeDistrictLabels(
        labels.map((item) => ({
          key: item.repo,
          center: screen(item.anchors.center),
          left: screen(item.anchors.left),
          right: screen(item.anchors.right),
        })),
        width,
        height,
      );
    return labels.map((item) => {
      const p = item.position.clone().project(camera);
      const labelWidth = Math.min(182, width * 0.6);
      return {
        key: item.repo,
        x: ((p.x + 1) * width) / 2 - labelWidth / 2,
        y: ((1 - p.y) * height) / 2,
        width: labelWidth,
        height: 26,
        side: 'left' as const,
        anchor: screen(item.anchors.left),
      };
    });
  }
  function render() {
    frame = 0;
    if (disposed) return;
    renderer.render(world, camera);
    overlay.setAttribute('viewBox', `0 0 ${width} ${height}`);
    overlay.style.display = state.showLabels && multiDistrict ? '' : 'none';
    for (const c of labelPositions()) {
      const item = labels.find((item) => item.repo === c.key)!;
      item.label.style.left = `${c.x}px`;
      item.label.style.top = `${c.y}px`;
      item.label.style.width = `${c.width}px`;
      item.label.style.height = `${c.height}px`;
      item.label.hidden = !state.showLabels;
      item.leader.setAttribute(
        'points',
        labelLeader(c)
          .map((p) => `${p.x},${p.y}`)
          .join(' '),
      );
      item.marker.setAttribute('cx', String(c.anchor.x));
      item.marker.setAttribute('cy', String(c.anchor.y));
      item.caption.setAttribute('x', String(c.anchor.x));
      item.caption.setAttribute('y', String(c.anchor.y + 2.5));
    }
  }
  function invalidate() {
    if (!frame && !disposed) frame = requestAnimationFrame(render);
  }
  function resetCamera() {
    controls.target.copy(center);
    camera.position
      .copy(center)
      .add(new THREE.Vector3(span * 2, span * Math.sqrt(8 / 3), span * 2));
    camera.lookAt(center);
    controls.update();
  }
  function resize() {
    width = host.clientWidth || 1;
    height = host.clientHeight || 1;
    renderer.setSize(width, height);
    camera.left = -width / 2;
    camera.right = width / 2;
    camera.top = height / 2;
    camera.bottom = -height / 2;
    fitZoom = Math.min(
      (width * (multiDistrict ? 0.58 : 1)) / ((bounds.width + bounds.depth + 25) * 0.76),
      height / (span * 1.3),
    );
    camera.zoom = fitZoom * state.zoom;
    controls.minZoom = fitZoom * 0.8;
    controls.maxZoom = fitZoom * 1.5;
    camera.updateProjectionMatrix();
    invalidate();
  }
  function highlight(building: Building | undefined) {
    selection.visible = !!building;
    if (!building) return;
    selection.position.set(
      building.position.x + building.width / 2,
      building.height / 2,
      building.position.y + building.depth / 2,
    );
    selection.scale.set(building.width + 0.15, building.height + 0.15, building.depth + 0.15);
  }
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  function hit(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects([bodyMesh, roofMesh], false)[0];
    const part =
      hit?.instanceId === undefined
        ? undefined
        : (hit.object === roofMesh ? roofs : bodies)[hit.instanceId];
    const building = part?.buildingIndex === undefined ? undefined : buildings[part.buildingIndex];
    return state.repository && building?.repo !== state.repository ? undefined : building;
  }
  let start = { x: 0, y: 0 };
  let dragging = false;
  function down(event: PointerEvent) {
    start = { x: event.clientX, y: event.clientY };
    dragging = true;
    events.hover(hit(event)?.id ?? null);
  }
  function move(event: PointerEvent) {
    if (dragging) return;
    const building = hit(event);
    canvas.style.cursor = building && !building.cityOnly ? 'pointer' : 'grab';
    events.hover(building?.id ?? null);
  }
  function up(event: PointerEvent) {
    dragging = false;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) return;
    const building = hit(event);
    if (building) {
      events.hover(building.cityOnly ? building.id : null);
      events.select(building.cityOnly ? '' : building.id);
    }
  }
  function leave() {
    dragging = false;
    events.hover(null);
  }
  function changed() {
    const zoom = Math.round((camera.zoom / fitZoom) * 100) / 100;
    if (Math.abs(zoom - state.zoom) > 0.005) events.zoom(Math.max(0.8, Math.min(1.5, zoom)));
    invalidate();
  }
  function key(event: KeyboardEvent) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') {
      resetCamera();
      events.zoom(1);
      return;
    }
    const offset = camera.position.clone().sub(controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    if (event.key === 'ArrowLeft') spherical.theta -= 0.15;
    if (event.key === 'ArrowRight') spherical.theta += 0.15;
    if (event.key === 'ArrowUp') spherical.phi -= 0.1;
    if (event.key === 'ArrowDown') spherical.phi += 0.1;
    spherical.phi = THREE.MathUtils.clamp(
      spherical.phi,
      controls.minPolarAngle,
      controls.maxPolarAngle,
    );
    camera.position.copy(controls.target).add(offset.setFromSpherical(spherical));
    controls.update();
  }
  function lost(event: Event) {
    event.preventDefault();
    if (!disposed) events.failed();
  }
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointerleave', leave);
  canvas.addEventListener('pointercancel', leave);
  canvas.addEventListener('keydown', key);
  canvas.addEventListener('webglcontextlost', lost);
  controls.addEventListener('change', changed);
  resetCamera();
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  return {
    capture() {
      if (disposed) throw new Error('3D view is unavailable.');
      // Redraw and copy synchronously before WebGL discards its drawing buffer.
      renderer.render(world, camera);
      const image = document.createElement('canvas');
      image.width = canvas.width;
      image.height = canvas.height;
      const context = image.getContext('2d');
      if (!context) throw new Error('Image export is unavailable.');
      context.fillStyle = data.theme.background;
      context.fillRect(0, 0, image.width, image.height);
      context.drawImage(canvas, 0, 0);
      const ratio = image.width / width;
      context.scale(ratio, ratio);
      context.font = '12px system-ui, sans-serif';
      context.textAlign = 'center';
      for (const c of labelPositions()) {
        if (!state.showLabels) continue;
        const item = labels.find((item) => item.repo === c.key)!;
        if (multiDistrict) {
          context.strokeStyle = data.theme.muted;
          context.beginPath();
          labelLeader(c).forEach((p, i) =>
            i ? context.lineTo(p.x, p.y) : context.moveTo(p.x, p.y),
          );
          context.stroke();
          context.beginPath();
          context.arc(c.anchor.x, c.anchor.y, 8, 0, Math.PI * 2);
          context.fillStyle = palette.label;
          context.fill();
          context.stroke();
          context.font = '7px system-ui, sans-serif';
          context.fillStyle = data.theme.text;
          context.fillText(item.number, c.anchor.x, c.anchor.y + 2.5);
        }
        context.fillStyle = palette.label;
        context.fillRect(c.x, c.y, c.width, c.height);
        context.fillStyle = data.theme.text;
        context.font = `${width < 600 ? 8 : 10}px system-ui, sans-serif`;
        let text = (multiDistrict ? item.number + '  ' : '') + item.repo;
        while (context.measureText(text).width > c.width - 12 && text.length > 1)
          text = text.slice(0, -2) + '…';
        context.fillText(text, c.x + c.width / 2, c.y + c.height / 2 + 3);
      }
      return canvasToPng(image);
    },
    update(next: ViewerState) {
      const reset = next.reset !== state.reset;
      const rezoom = next.zoom !== state.zoom;
      state = next;
      if (rezoom) {
        camera.zoom = fitZoom * state.zoom;
        camera.updateProjectionMatrix();
      }
      if (reset) resetCamera();
      highlight(buildings.find((b) => !b.cityOnly && b.id === state.selectedId));
      invalidate();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.removeEventListener('change', changed);
      controls.dispose();
      canvas.removeEventListener('webglcontextlost', lost);
      geometry.dispose();
      roofGeometry.dispose();
      edges.dispose();
      edgeMaterial.dispose();
      materials.forEach((material) => material.dispose());
      meshes.forEach((mesh) => mesh.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      overlay.remove();
      labels.forEach(({ label }) => label.remove());
    },
  };
}
