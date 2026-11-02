import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, MouseEvent, ReactNode } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Info,
  Maximize,
  Minus,
  Moon,
  Plus,
  RotateCcw,
  Sun,
  Tag,
  X,
} from 'lucide-react';
import type { CityScene, HeightMetric } from './core/model';
import { applyTheme, cityLegend, daylightTheme, languageColor } from './core/theme';
import type { ThemeId } from './core/theme';
import { repositoryScene, repositorySlug } from './core/repository-scene';
import City3D from './renderers/three/City3D';
import type { City3DHandle } from './renderers/three/City3D';
import { downloadImage, svgToPng } from './core/image-export';
import { sitePath, siteUrl } from './core/site-paths';
import { sceneSource } from './core/source-label';
import { applyRepositorySignals } from './core/repository-signals';
import config from '../generated/display.json';
import { applyHeightMetric, compactNumber, sceneStats } from './core/metrics';
import {
  cityLayerImage,
  citySvgDocument,
  renderBanner,
  renderCityLayers,
  renderSelection,
} from './renderers/svg/city';

/** The isometric mark; its three faces follow the theme. */
function Logo() {
  return (
    <svg className="logo-mark" width="18" height="21" viewBox="0 0 20 23" aria-hidden="true">
      <path className="logo-top" d="M10 0 20 5.8 10 11.6 0 5.8Z" />
      <path className="logo-left" d="M0 5.8 10 11.6 10 23 0 17.2Z" />
      <path className="logo-right" d="M10 11.6 20 5.8 20 17.2 10 23Z" />
    </svg>
  );
}

function Dialog({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className={wide ? 'dialog-wide' : undefined}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      aria-label={title}
    >
      <div className="dialog-header">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export default function App({
  scene: sourceScene,
  repositoryPage = false,
}: {
  scene: CityScene;
  repositoryPage?: boolean;
}) {
  const pageRepository = repositoryPage ? (sourceScene.repositories[0]?.name ?? '') : '';
  // Demo data never borrows the owner's title, which would describe repositories it lacks.
  const profile = sourceScene.isFixture
    ? {
        title: 'Code City demo',
        subtitle: `${sourceScene.repositories.length} example repositories, one skyline`,
      }
    : config.profile;
  const [theme, setTheme] = useState<ThemeId>(
    sourceScene.theme.background === daylightTheme.background ? 'github-light' : 'github-dark',
  );
  const [heightMetric, setHeightMetric] = useState<HeightMetric>(
    sourceScene.heightMetric ?? 'lines',
  );
  const scene = useMemo(
    () => applyTheme(applyRepositorySignals(applyHeightMetric(sourceScene, heightMetric)), theme),
    [sourceScene, theme, heightMetric],
  );
  const source = sceneSource(scene);
  const [dimension, setDimension] = useState<'2.5D' | '3D'>('2.5D');
  const [reset, setReset] = useState(0);
  const [threeError, setThreeError] = useState('');
  const stats = useMemo(() => sceneStats(scene), [scene]);
  const allBuildings = useMemo(
    () =>
      scene.repositories.flatMap((repository) =>
        repository.buildings.map((building) => ({ ...building, repository: repository.name })),
      ),
    [scene],
  );
  const privateRepositories = new Set(
    scene.repositories.filter((repo) => repo.privacy === 'city-only').map((repo) => repo.name),
  );
  const inspectableBuildings = allBuildings.filter(
    (building) => !privateRepositories.has(building.repository),
  );
  const [repository, setRepository] = useState(() => {
    const requested = new URLSearchParams(location.search).get('repo');
    return scene.repositories.some((repo) => repo.name === requested) ? requested! : '';
  });
  const legend = useMemo(() => cityLegend(repositoryScene(scene, repository)), [scene, repository]);
  const detailsHidden = repository
    ? privateRepositories.has(repository)
    : privateRepositories.size > 0 && inspectableBuildings.length === 0;
  const [selectedId, setSelectedId] = useState(
    inspectableBuildings.find((building) =>
      repository ? building.repository === repository : building.landmark,
    )?.id ??
      (!repository ? inspectableBuildings[0]?.id : '') ??
      '',
  );
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState<boolean>(config.appearance.showLabels);
  const [zoom, setZoom] = useState(1);
  const [dialog, setDialog] = useState<'export' | 'mapping' | null>(null);
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const threeView = useRef<City3DHandle>(null);
  const hero = useRef<HTMLElement>(null);
  const [exportTitle, setExportTitle] = useState<string>(
    pageRepository ? pageRepository.slice(0, 28) : profile.title,
  );
  const [exportSubtitle, setExportSubtitle] = useState<string>(profile.subtitle);
  const [exportRepository, setExportRepository] = useState(pageRepository);
  const active = inspectableBuildings.find(
    (building) =>
      building.id === (hoveredId ?? selectedId) &&
      (!repository || building.repository === repository),
  );
  const activeRepository = scene.repositories.find((repo) => repo.name === active?.repository);
  const visibleBuildings = allBuildings.filter(
    (building) => !repository || building.repository === repository,
  );
  const districts = useMemo(
    () => [...scene.repositories].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)),
    [scene],
  );

  // The city is drawn once per scene; hover and selection only fill a light overlay, so the
  // ambient animation keeps running and a 1 MB SVG is not rebuilt on every mouse move.
  const layers = useMemo(
    () =>
      renderCityLayers(scene, {
        repository,
        showLabels,
        interactive: true,
        intro: true,
        motion: 'full',
      }),
    [scene, repository, showLabels],
  );
  // The static ground is an image beneath the buildings, and cars are tiny HTML elements
  // between the two. Their transform animations run on the compositor, so traffic costs the
  // main thread nothing per frame and the building SVG is never repainted for it.
  const city = useMemo(() => citySvgDocument(layers.buildings, true), [layers]);
  const groundImage = useMemo(() => cityLayerImage(layers.ground), [layers]);
  const canvas = useRef<HTMLDivElement>(null);
  const traffic = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = canvas.current;
    const layer = traffic.current;
    if (!box || !layer) return;
    const fit = () => {
      const scale = Math.min(box.clientWidth / 1040, box.clientHeight / 660);
      layer.style.transform = `translate(${(box.clientWidth - 1040 * scale) / 2}px, ${(box.clientHeight - 660 * scale) / 2}px) scale(${scale})`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => observer.disconnect();
    const animations = [...layer.children].map((node, index) => {
      const car = layers.cars[index];
      // A short streak of light, turned to follow its street.
      const turn = `rotate(${Math.atan2(car.dy, car.dx)}rad)`;
      return node.animate(
        [
          { transform: `translate(0, 0) ${turn}`, opacity: 0 },
          { opacity: 1, offset: 0.06 },
          { opacity: 1, offset: 0.94 },
          { transform: `translate(${car.dx}px, ${car.dy}px) ${turn}`, opacity: 0 },
        ],
        { duration: car.duration * 1000, delay: -car.offset * 1000, iterations: Infinity },
      );
    });
    return () => {
      observer.disconnect();
      for (const animation of animations) animation.cancel();
    };
  }, [layers, dimension]);
  const focusId = hoveredId || selectedId;
  // A stable object: the 3D city redraws only when one of these values changes, never on
  // unrelated page updates such as the end of the intro.
  const threeState = useMemo(
    () => ({ selectedId: focusId, repository, showLabels, zoom, reset }),
    [focusId, repository, showLabels, zoom, reset],
  );
  const selection = useMemo(
    () => renderSelection(scene, { selectedId: focusId, repository, showLabels }),
    [scene, focusId, repository, showLabels],
  );
  const cityArt = useRef<HTMLDivElement>(null);
  const [entering, setEntering] = useState(true);
  useEffect(() => {
    setEntering(true);
    const timer = setTimeout(() => setEntering(false), 1800);
    return () => clearTimeout(timer);
  }, [scene, repository]);
  useEffect(() => {
    const root = cityArt.current;
    if (!root) return;
    const layer = root.querySelector('[data-selection-layer]');
    if (layer) layer.innerHTML = selection;
    for (const node of root.querySelectorAll('[aria-pressed="true"]'))
      node.setAttribute('aria-pressed', 'false');
    for (const node of root.querySelectorAll('[data-building]'))
      if (node.getAttribute('data-building') === selectedId)
        node.setAttribute('aria-pressed', 'true');
  }, [city, selection, selectedId, dimension]);
  const banner = useMemo(
    () =>
      renderBanner(repositoryScene(scene, exportRepository), {
        size: exportRepository ? 'repository' : 'profile',
        title: exportTitle,
        subtitle: exportSubtitle,
        showLabels,
        showLegend: config.appearance.showLegend,
      }),
    [scene, exportRepository, exportTitle, exportSubtitle, showLabels],
  );
  const assetName = exportRepository ? `repos/${repositorySlug(exportRepository)}` : 'profile';
  const assetTheme = theme === 'github-light' ? 'light' : 'dark';
  const exportDimensions = exportRepository ? '900 × 315' : '1200 × 420';
  const embed = `[![Code City](${siteUrl(`assets/${assetName}.${assetTheme}.svg`)})](${siteUrl(exportRepository ? `repos/${repositorySlug(exportRepository)}/` : '')})`;
  const sourceLabel = scene.isFixture
    ? 'Demo data'
    : `${source === 'local' ? 'Local' : source} scan`;
  const pageDescription = pageRepository
    ? scene.repositories[0]?.description || 'One repository, one district.'
    : profile.subtitle;

  useEffect(() => setCopied(false), [embed]);

  // The README preview is an image, so the page never holds a second large inline city.
  const [bannerUrl, setBannerUrl] = useState('');
  useEffect(() => {
    const url = URL.createObjectURL(new Blob([banner], { type: 'image/svg+xml' }));
    setBannerUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [banner]);

  useEffect(() => {
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', scene.theme.background);
  }, [scene.theme.background]);

  function toggleTheme() {
    setTheme(theme === 'github-dark' ? 'github-light' : 'github-dark');
  }

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  function filterRepository(name: string) {
    setRepository(name);
    setHoveredId(null);
    setZoom(1);
    if (name)
      setSelectedId(
        inspectableBuildings.find((building) => building.repository === name)?.id ?? '',
      );
    else setSelectedId(inspectableBuildings[0]?.id ?? '');
  }

  function download() {
    const url = URL.createObjectURL(new Blob([banner], { type: 'image/svg+xml;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = exportRepository
      ? `code-city-${repositorySlug(exportRepository)}${theme === 'github-light' ? '-light' : ''}.svg`
      : `code-city-profile${theme === 'github-light' ? '-light' : ''}.svg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice('Your skyline is ready. SVG downloaded.');
  }

  async function downloadPng(view = false) {
    setExporting(true);
    try {
      let blob: Blob;
      if (view && dimension === '3D') {
        if (!threeView.current) throw new Error('Wait for the 3D city to finish loading.');
        blob = await threeView.current.capture();
      } else {
        const svg = view
          ? citySvgDocument(
              `<g transform="translate(520 330) scale(${zoom}) translate(-520 -330)">${layers.ground}${layers.buildings}${selection}</g>`,
            )
          : banner;
        blob = await svgToPng(
          svg,
          view ? 1040 : exportRepository ? 900 : 1200,
          view ? 660 : exportRepository ? 315 : 420,
          scene.theme.background,
        );
      }
      const name = view
        ? `view-${dimension.toLowerCase()}`
        : exportRepository
          ? repositorySlug(exportRepository)
          : 'profile';
      downloadImage(blob, `code-city-${name}${theme === 'github-light' ? '-light' : ''}.png`);
      setNotice('Your skyline is ready. PNG downloaded.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'PNG export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  async function copyEmbed() {
    try {
      await navigator.clipboard.writeText(embed);
      setCopied(true);
      setNotice('README snippet copied.');
    } catch {
      setNotice('Clipboard unavailable. Select and copy the snippet below.');
    }
  }

  function buildingId(event: MouseEvent | KeyboardEvent) {
    return (event.target as Element).closest('[data-building]')?.getAttribute('data-building');
  }

  function selectBuilding(id: string) {
    setSelectedId(inspectableBuildings.some((building) => building.id === id) ? id : '');
  }

  function focusDistrict(name: string) {
    filterRepository(name);
    hero.current?.scrollIntoView({ block: 'start' });
  }

  const caption = repository
    ? `${visibleBuildings.length} buildings · ${detailsHidden ? 'city only, file details hidden' : `${repository} district`}`
    : `${visibleBuildings.length} buildings · ${stats.repositories} ${stats.repositories === 1 ? 'district' : 'districts'}${detailsHidden ? ' · file details hidden' : ''}`;

  return (
    <div className="app-shell" data-theme={theme === 'github-light' ? 'light' : 'dark'}>
      <header className="topbar">
        <div className="topbar-inner">
          <a
            className="brand"
            href={repositoryPage ? sitePath('') : '#'}
            aria-label="Code City home"
            onClick={() => {
              if (!repositoryPage) filterRepository('');
            }}
          >
            <Logo />
            <span>Code City</span>
          </a>
          {repositoryPage ? (
            <nav className="breadcrumb" aria-label="Breadcrumb">
              <a href={sitePath('')}>All repositories</a>
              <ChevronRight size={13} aria-hidden="true" />
              <span>{pageRepository}</span>
            </nav>
          ) : (
            <nav className="topnav" aria-label="Sections">
              <a href="#city">City</a>
              {scene.repositories.length > 1 && <a href="#districts">Districts</a>}
              <a href="#readme">README</a>
            </nav>
          )}
          <div className="topbar-actions">
            <button
              onClick={() => setDialog('mapping')}
              aria-label="About this city"
              title="How the city works"
              className="icon-button"
            >
              <Info size={17} />
            </button>
            <button
              className="icon-button theme-toggle"
              aria-label={
                theme === 'github-dark' ? 'Switch to light theme' : 'Switch to dark theme'
              }
              title={theme === 'github-dark' ? 'Daylight' : 'Midnight'}
              onClick={toggleTheme}
            >
              {theme === 'github-dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button className="primary-button" onClick={() => setDialog('export')}>
              <ArrowDownToLine size={15} />
              Export SVG
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="hero" id="city" ref={hero} aria-label="City explorer">
          <div className="hero-head">
            <div className="hero-intro">
              <p className="eyebrow">
                <span className="fixture-badge">
                  <i aria-hidden="true" />
                  <span>{sourceLabel}</span>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {stats.repositories} {stats.repositories === 1 ? 'repository' : 'repositories'}
                </span>
              </p>
              <h1>{pageRepository || profile.title}</h1>
              <p className="lede">{pageDescription}</p>
            </div>
            <div className="view-controls" role="toolbar" aria-label="View options">
              <div className="segmented" role="group" aria-label="City view mode">
                {(['2.5D', '3D'] as const).map((mode) => (
                  <button
                    key={mode}
                    aria-pressed={dimension === mode}
                    aria-label={`${mode} view`}
                    onClick={() => {
                      setDimension(mode);
                      setHoveredId(null);
                      setThreeError('');
                    }}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <div className="select-pill">
                <select
                  aria-label="Building height"
                  value={heightMetric}
                  onChange={(event) => setHeightMetric(event.target.value as HeightMetric)}
                >
                  <option value="lines">Height · lines</option>
                  <option value="bytes">Height · file size</option>
                </select>
                <ChevronDown size={13} aria-hidden="true" />
              </div>
              <span className="toolbar-divider" aria-hidden="true" />
              <button
                className="icon-button"
                aria-label="Toggle district labels"
                aria-pressed={showLabels}
                title="District labels"
                onClick={() => setShowLabels(!showLabels)}
              >
                <Tag size={16} />
              </button>
              <button
                className="icon-button"
                aria-label="Download view PNG"
                title="Download current view as PNG"
                disabled={exporting}
                onClick={() => void downloadPng(true)}
              >
                <Camera size={16} />
              </button>
            </div>
          </div>

          {/* Room for the inspector depends on the view, never on hover, so the city does not
              shift under the pointer when a private building hides the details. */}
          <div className={`city-stage${detailsHidden ? '' : ' has-inspector'}`}>
            <div className="city-viewport">
              <p className="city-caption">
                <span className="live-dot" aria-hidden="true" />
                {caption}
              </p>
              {visibleBuildings.length === 0 && (
                <div className="empty-city" role="status">
                  <h2>No source files to display</h2>
                  <p>This directory is empty or its files were excluded.</p>
                </div>
              )}
              {dimension === '3D' ? (
                <City3D
                  ref={threeView}
                  scene={scene}
                  state={threeState}
                  events={{
                    hover: setHoveredId,
                    select: selectBuilding,
                    zoom: setZoom,
                    failed: () => {
                      setDimension('2.5D');
                      setThreeError(
                        '3D is unavailable in this browser. You can still explore and export the SVG city.',
                      );
                    },
                  }}
                />
              ) : (
                <div
                  ref={cityArt}
                  className={`city-art${entering ? ' is-entering' : ''}`}
                  style={{ '--city-zoom': zoom } as CSSProperties}
                  onClick={(event) => {
                    const id = buildingId(event);
                    if (id) selectBuilding(id);
                  }}
                  onMouseOver={(event) => {
                    const id = buildingId(event);
                    setHoveredId(id || null);
                  }}
                  onMouseLeave={() => setHoveredId(null)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      const id = buildingId(event);
                      if (id) {
                        event.preventDefault();
                        selectBuilding(id);
                      }
                    }
                  }}
                >
                  <div className="city-canvas" ref={canvas}>
                    <img className="city-ground" src={groundImage} alt="" />
                    <div className="city-traffic" ref={traffic} aria-hidden="true">
                      {layers.cars.map((car, index) => (
                        <i
                          key={index}
                          className={car.glow ? 'glow' : undefined}
                          style={
                            {
                              left: car.x,
                              top: car.y,
                              '--size': `${car.size}px`,
                              '--car': car.color,
                            } as CSSProperties
                          }
                        />
                      ))}
                    </div>
                    <div className="city-buildings" dangerouslySetInnerHTML={{ __html: city }} />
                  </div>
                </div>
              )}
              {threeError && (
                <div className="three-error" role="status">
                  {threeError}
                </div>
              )}
              <div className="city-legend" aria-label="Legend">
                {legend.map((item) => (
                  <span key={item.name}>
                    <i style={{ background: item.color }} />
                    {item.name}
                  </span>
                ))}
              </div>
              <p className="interaction-hint">
                {detailsHidden
                  ? 'City only · file details hidden'
                  : dimension === '3D'
                    ? 'Drag to rotate · Right-drag to pan · Click to inspect'
                    : 'Hover to discover · Click to inspect'}
              </p>
              <div className="zoom-controls">
                <button
                  aria-label="Zoom out"
                  disabled={zoom <= 0.8}
                  onClick={() => setZoom(Math.max(0.8, +(zoom - 0.1).toFixed(1)))}
                >
                  <Minus size={15} />
                </button>
                <span aria-live="polite">{Math.round(zoom * 100)}%</span>
                <button
                  aria-label="Zoom in"
                  disabled={zoom >= 1.5}
                  onClick={() => setZoom(Math.min(1.5, +(zoom + 0.1).toFixed(1)))}
                >
                  <Plus size={15} />
                </button>
                <span className="zoom-divider" aria-hidden="true" />
                <button
                  aria-label="Reset view"
                  onClick={() => {
                    setZoom(1);
                    setReset((value) => value + 1);
                    filterRepository('');
                  }}
                >
                  <Maximize size={14} />
                </button>
              </div>
            </div>
            {active && (
              <aside className="file-inspector" aria-label="File details">
                <p className="inspector-kicker">
                  <i style={{ background: languageColor(active.language) }} />
                  {active.language}
                  <span>{active.category}</span>
                </p>
                <h3 title={active.path}>{active.path}</h3>
                {dimension === '3D' && (
                  <div className="select-pill inspector-select">
                    <select
                      className="inspect-file"
                      aria-label="Inspect file"
                      value={selectedId}
                      onChange={(event) => {
                        setSelectedId(event.target.value);
                        setHoveredId(null);
                      }}
                    >
                      {visibleBuildings
                        .filter((building) => !privateRepositories.has(building.repository))
                        .map((building) => (
                          <option key={building.id} value={building.id}>
                            {building.repository}/{building.path}
                          </option>
                        ))}
                    </select>
                    <ChevronDown size={13} aria-hidden="true" />
                  </div>
                )}
                <a
                  className="inspector-repo"
                  href={sitePath(`repos/${repositorySlug(active.repository)}/`)}
                  title="Open repository page"
                >
                  {active.repository}
                  <ArrowUpRight size={12} />
                </a>
                <dl>
                  <div>
                    <dt>Lines of code</dt>
                    <dd>{active.lines.toLocaleString('en-US')}</dd>
                  </div>
                  <div>
                    <dt>File size</dt>
                    <dd>{(active.bytes / 1024).toFixed(1)} KB</dd>
                  </div>
                  <div>
                    <dt>Last committed change</dt>
                    <dd title={active.modifiedAt ?? 'No date found in the available Git history'}>
                      {active.modifiedAt?.slice(0, 10) ?? 'Unknown'}
                    </dd>
                  </div>
                  {(activeRepository?.archived || (activeRepository?.stars ?? 0) > 0) && (
                    <div>
                      <dt>Repository</dt>
                      <dd className="repo-signals">
                        ★ {compactNumber(activeRepository?.stars ?? 0)} stars
                        {activeRepository?.archived && ' · Archived'}
                      </dd>
                    </div>
                  )}
                </dl>
                <p className="inspector-foot">
                  {scene.isFixture ? (
                    'Fixture file · preview only'
                  ) : active.githubUrl ? (
                    <a href={active.githubUrl} target="_blank" rel="noreferrer">
                      View committed source
                      <ArrowUpRight size={13} />
                    </a>
                  ) : (
                    'Local file · scanned from disk'
                  )}
                </p>
              </aside>
            )}
          </div>

          {scene.repositories.length > 1 && (
            <div className="district-chips" role="group" aria-label="Filter repository">
              <button
                aria-pressed={!repository}
                aria-label="All repositories"
                onClick={() => filterRepository('')}
              >
                All
                <span>{stats.files}</span>
              </button>
              {districts.map((repo) => (
                <button
                  key={repo.name}
                  aria-pressed={repository === repo.name}
                  aria-label={repo.name}
                  title={`${repo.buildings.length} files`}
                  onClick={() => filterRepository(repository === repo.name ? '' : repo.name)}
                >
                  <i style={{ background: languageColor(repo.primaryLanguage) }} />
                  {repo.name}
                  <span>{repo.buildings.length}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="stats-strip" aria-label="City statistics">
          <div>
            <strong>{stats.repositories}</strong>
            <span>{stats.repositories === 1 ? 'Repository' : 'Repositories'}</span>
          </div>
          <div>
            <strong>{stats.files}</strong>
            <span>Buildings · files</span>
          </div>
          <div>
            <strong>{compactNumber(stats.lines)}</strong>
            <span>Lines of code</span>
          </div>
          <div>
            <strong>{stats.languages.length}</strong>
            <span>{privateRepositories.size ? 'Public languages' : 'Languages'}</span>
          </div>
        </section>

        {scene.repositories.length > 1 && (
          <section className="districts" id="districts" aria-label="Repository list">
            <div className="section-head">
              <div>
                <p className="eyebrow">Districts</p>
                <h2>Every repository is a neighborhood</h2>
                <p>Choose one to focus the city on it.</p>
              </div>
            </div>
            <div className="repo-grid">
              {districts.map((repo) => (
                <button
                  className={`repository-card${repository === repo.name ? ' chosen' : ''}`}
                  key={repo.name}
                  style={{ '--district': languageColor(repo.primaryLanguage) } as CSSProperties}
                  onClick={() => focusDistrict(repo.name)}
                >
                  <span className="repo-card-top">
                    <span className="repo-language">
                      <i />
                      {repo.primaryLanguage}
                    </span>
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </span>
                  <h3>{repo.name}</h3>
                  <p>{repo.description}</p>
                  <span className="repo-meta">
                    <span>{repo.buildings.length} files</span>
                    <span>
                      {compactNumber(
                        repo.buildings.reduce((sum, building) => sum + building.lines, 0),
                      )}{' '}
                      lines
                    </span>
                    {(repo.privacy === 'city-only' || repo.stars > 0 || repo.archived) && (
                      <span className="repo-signals">
                        {[
                          repo.privacy === 'city-only' && 'City only',
                          repo.privacy !== 'city-only' &&
                            repo.stars > 0 &&
                            `★ ${compactNumber(repo.stars)} stars`,
                          repo.archived && 'Archived',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="readme-section" id="readme" aria-label="README banner">
          <div className="section-head">
            <div>
              <p className="eyebrow">For your README</p>
              <h2>Take your skyline with you</h2>
              <p>A self-contained SVG for a GitHub profile or project page. It stays up to date.</p>
            </div>
            <button className="secondary-button" onClick={() => setDialog('export')}>
              Customize & export
              <ArrowRight size={15} />
            </button>
          </div>
          <figure className="banner-frame">
            {bannerUrl && (
              <img
                className="banner-preview"
                src={bannerUrl}
                width={exportRepository ? 900 : 1200}
                height={exportRepository ? 315 : 420}
                alt={`${exportTitle} README banner preview`}
              />
            )}
            <figcaption>
              <span>
                {assetName}.{assetTheme}.svg
              </span>
              <span>{exportDimensions}</span>
            </figcaption>
          </figure>
        </section>

        <footer className="page-footer">
          <span className="brand">
            <Logo />
            Code City
          </span>
          <span>Built from code. Made to explore.</span>
          <span>
            {scene.theme.name} · {scene.isFixture ? 'Demo city' : 'Built from your code'} · v0.5.0
          </span>
        </footer>
      </main>

      {dialog === 'export' && (
        <Dialog title="Take your skyline with you" onClose={() => setDialog(null)} wide>
          <p className="dialog-description">
            A self-contained SVG for your GitHub profile or project README.
          </p>
          <div className="export-preview" dangerouslySetInnerHTML={{ __html: banner }} />
          <div className="export-fields">
            <label className="export-scope">
              Export scope
              <span className="select-pill">
                <select
                  value={exportRepository}
                  onChange={(event) => {
                    setExportRepository(event.target.value);
                    setCopied(false);
                  }}
                >
                  <option value="">{repositoryPage ? 'Profile size' : 'All repositories'}</option>
                  {districts.map((repo) => (
                    <option key={repo.name} value={repo.name}>
                      {repo.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} aria-hidden="true" />
              </span>
            </label>
            <label>
              City title
              <input
                value={exportTitle}
                maxLength={28}
                onChange={(event) => setExportTitle(event.target.value)}
              />
            </label>
            <label>
              Subtitle
              <input
                value={exportSubtitle}
                maxLength={48}
                onChange={(event) => setExportSubtitle(event.target.value)}
              />
            </label>
          </div>
          <div className="export-meta">
            <span>
              <Check size={13} />
              {exportDimensions}
            </span>
            <span>
              <Check size={13} />
              No external assets
            </span>
            <span>
              <Check size={13} />
              {(new Blob([banner]).size / 1024).toFixed(0)} KB
            </span>
          </div>
          <div className="embed-section">
            <span>
              README snippet{' '}
              <small>Links use the hosted banner; custom text applies to downloads.</small>
            </span>
            <div>
              <code>{embed}</code>
              <button aria-label="Copy README snippet" className="icon-button" onClick={copyEmbed}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
          </div>
          <div className="dialog-actions">
            <button
              className="secondary-button"
              onClick={() => {
                setExportTitle(pageRepository ? pageRepository.slice(0, 28) : profile.title);
                setExportSubtitle(profile.subtitle);
              }}
            >
              <RotateCcw size={14} />
              Reset text
            </button>
            <span className="dialog-spacer" />
            <button
              className="secondary-button"
              disabled={exporting}
              onClick={() => void downloadPng()}
            >
              <Camera size={14} />
              {exporting ? 'Preparing PNG…' : 'Download PNG'}
            </button>
            <button className="primary-button" onClick={download}>
              <ArrowDownToLine size={15} />
              Download SVG
            </button>
          </div>
        </Dialog>
      )}
      {dialog === 'mapping' && (
        <Dialog title="How the city works" onClose={() => setDialog(null)}>
          <p className="dialog-description">
            Every part of the skyline represents a part of the code.
          </p>
          <dl className="mapping-list">
            {[
              ['Repository', 'A district of its own'],
              ['File', 'One building'],
              [
                'Building height',
                'Lines or file size: small homes, midrise blocks and tall towers',
              ],
              ['Language', 'The tone of its facade and the color of its crown lights'],
              ['Repository stars', 'One landmark spire, growing logarithmically with stars'],
              ['Archived repository', 'Gray buildings and dimmed windows'],
              [
                'Window lights',
                'Recent committed changes glow brighter; unknown dates keep default lighting',
              ],
              ['Test file', 'A green roof'],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <p className="fixture-note">
            {scene.isFixture
              ? 'This demo uses 30 fixed example files in 4 fictional repositories.'
              : `This city contains ${stats.files} files scanned from ${stats.repositories} ${source} repositories. Each district is divided into directory blocks.`}{' '}
            Building positions, facades and window lights are deterministic. The 2.5D and 3D views
            share the same scene. In 3D, drag to rotate, right-drag to pan and scroll to zoom. Arrow
            keys rotate the focused canvas; Home resets the camera.
          </p>
          <div className="dialog-actions">
            <span className="dialog-spacer" />
            <button className="primary-button" onClick={() => setDialog(null)}>
              Back to the city
              <ArrowRight size={15} />
            </button>
          </div>
        </Dialog>
      )}
      <div className={`toast ${notice ? 'visible' : ''}`} role="status">
        {notice && (
          <>
            <Check size={15} />
            {notice}
          </>
        )}
      </div>
    </div>
  );
}
