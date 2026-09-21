import { useEffect, useState } from 'react';
import { applyRepositorySignals } from './core/repository-signals';
import type { CityScene } from './core/model';
import { sceneSchema } from './core/config';
import App from './App';
import { pageRoute, sitePath } from './core/site-paths';
import { repositoryScene, repositorySlug } from './core/repository-scene';
import { redactScene } from './core/privacy';

export default function CityLoader() {
  const [scene, setScene] = useState<CityScene | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [missing, setMissing] = useState(false);
  const route = pageRoute(location.pathname);
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    fetch(sitePath('assets/scene.json'), {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then((response) => {
        if (!response.ok) throw new Error('Scene unavailable');
        return response.json();
      })
      .then((data) => {
        const city = applyRepositorySignals(redactScene(sceneSchema.parse(data)));
        const slug = pageRoute(location.pathname)?.slug;
        const repo = slug
          ? city.repositories.find((item) => repositorySlug(item.name) === slug)
          : undefined;
        if (slug && !repo) {
          setMissing(true);
          return;
        }
        setScene(repo ? repositoryScene(city, repo.name) : city);
      })
      .catch((cause) => {
        if (cause.name !== 'AbortError') setError(true);
      });
    return () => controller.abort();
  }, [attempt]);
  if (scene) return <App scene={scene} repositoryPage={!!route} />;
  if (missing)
    return (
      <main className="loading-screen">
        <h1>Repository not found</h1>
        <p>This repository is not part of the current city.</p>
        <a className="primary-button" href={sitePath('')}>
          All repositories
        </a>
      </main>
    );
  return (
    <main className="loading-screen">
      <h1>
        Code City<span>.</span>
      </h1>
      {error ? (
        <>
          <p>The city data could not be loaded. Your static skyline is still available.</p>
          <img
            src={sitePath(route ? `assets/repos/${route.slug}.svg` : 'assets/profile.svg')}
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
