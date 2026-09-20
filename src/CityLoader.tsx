import { useEffect, useState } from 'react';
import type { CityScene } from './core/model';
import { sceneSchema } from './core/config';
import App from './App';

export default function CityLoader() {
  const [scene, setScene] = useState<CityScene | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    fetch(`${import.meta.env.BASE_URL}assets/scene.json`, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then((response) => {
        if (!response.ok) throw new Error('Scene unavailable');
        return response.json();
      })
      .then((data) => setScene(sceneSchema.parse(data)))
      .catch((cause) => {
        if (cause.name !== 'AbortError') setError(true);
      });
    return () => controller.abort();
  }, [attempt]);
  if (scene) return <App scene={scene} />;
  return (
    <main className="loading-screen">
      <h1>
        Code City<span>.</span>
      </h1>
      {error ? (
        <>
          <p>The city data could not be loaded. Your static skyline is still available.</p>
          <img
            src={`${import.meta.env.BASE_URL}assets/profile.svg`}
            alt="Code City static skyline"
          />
          <button className="primary-button" onClick={() => setAttempt(attempt + 1)}>
            Try again
          </button>
        </>
      ) : (
        <p role="status">Bringing your skyline into view…</p>
      )}
    </main>
  );
}
