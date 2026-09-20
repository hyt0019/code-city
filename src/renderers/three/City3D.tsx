import { useEffect, useRef, useState } from 'react';
import type { CityScene } from '../../core/model';
import type { ViewerState, ViewerEvents } from './viewer';

export default function City3D({
  scene,
  state,
  events,
}: {
  scene: CityScene;
  state: ViewerState;
  events: ViewerEvents;
}) {
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<ReturnType<typeof import('./viewer').createViewer> | null>(null);
  const latest = useRef({ state, events });
  const [ready, setReady] = useState(false);
  latest.current = { state, events };
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    import('./viewer')
      .then(({ createViewer }) => {
        if (cancelled || !host.current) return;
        viewer.current = createViewer(host.current, scene, {
          hover: (id) => latest.current.events.hover(id),
          select: (id) => latest.current.events.select(id),
          zoom: (zoom) => latest.current.events.zoom(zoom),
          failed: () => latest.current.events.failed(),
        });
        viewer.current.update(latest.current.state);
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) latest.current.events.failed();
      });
    return () => {
      cancelled = true;
      viewer.current?.dispose();
      viewer.current = null;
    };
  }, [scene]);
  useEffect(() => {
    viewer.current?.update(state);
  }, [state]);
  return (
    <div className="city-three" ref={host} aria-busy={!ready}>
      {!ready && (
        <span className="three-loading" role="status">
          Opening your city in 3D…
        </span>
      )}
    </div>
  );
}
