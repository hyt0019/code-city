import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, MouseEvent, ReactNode } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Compass,
  Copy,
  ExternalLink,
  FileCode2,
  FolderGit2,
  House,
  Info,
  Layers3,
  Maximize,
  Minus,
  Moon,
  Plus,
  RotateCcw,
  Sparkles,
  Sun,
  Tag,
  X,
} from 'lucide-react';
import type { CityScene } from './core/model';
import { applyTheme, cityLegend, daylightTheme } from './core/theme';
import type { ThemeId } from './core/theme';
import { repositoryScene, repositorySlug } from './core/repository-scene';
import City3D from './renderers/three/City3D';
import { sitePath } from './core/site-paths';
import { sceneSource } from './core/source-label';
import config from '../codecity.config';
import { compactNumber, sceneStats } from './core/metrics';
import { renderBanner, renderCitySvg } from './renderers/svg/city';

function Logo({ small = false }: { small?: boolean }) {
  return (
    <span className={`brand ${small ? 'brand-small' : ''}`}>
      <svg width="29" height="34" viewBox="0 0 40 44" aria-hidden="true">
        <path fill="#90dcff" d="M20 1 39 12 20 23 1 12Z" />
        <path fill="#439fd1" d="M1 12 20 23 20 44 1 33Z" />
        <path fill="#256489" d="M20 23 39 12 39 33 20 44Z" />
      </svg>
      {!small && (
        <span>
          CODE CITY<span className="brand-dot">.</span>
        </span>
      )}
    </span>
  );
}

function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
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
  const [theme, setTheme] = useState<ThemeId>(
    sourceScene.theme.background === daylightTheme.background ? 'github-light' : 'github-dark',
  );
  const scene = useMemo(() => applyTheme(sourceScene, theme), [sourceScene, theme]);
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
  const legend = useMemo(() => cityLegend(scene), [scene]);
  const [repository, setRepository] = useState(() => {
    const requested = new URLSearchParams(location.search).get('repo');
    return scene.repositories.some((repo) => repo.name === requested) ? requested! : '';
  });
  const [selectedId, setSelectedId] = useState(
    allBuildings.find((building) =>
      repository ? building.repository === repository : building.landmark,
    )?.id ??
      allBuildings[0]?.id ??
      '',
  );
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState<boolean>(config.appearance.showLabels);
  const [zoom, setZoom] = useState(1);
  const [view, setView] = useState<'overview' | 'repositories'>('overview');
  const [dialog, setDialog] = useState<'export' | 'mapping' | null>(null);
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);
  const [exportTitle, setExportTitle] = useState<string>(
    pageRepository ? pageRepository.slice(0, 28) : config.profile.title,
  );
  const [exportSubtitle, setExportSubtitle] = useState<string>(config.profile.subtitle);
  const [exportRepository, setExportRepository] = useState(pageRepository);
  const active = allBuildings.find((building) => building.id === (hoveredId || selectedId));
  const visibleBuildings = allBuildings.filter(
    (building) => !repository || building.repository === repository,
  );
  const city = useMemo(
    () =>
      renderCitySvg(scene, {
        selectedId: hoveredId || selectedId,
        repository,
        showLabels,
        interactive: true,
      }),
    [scene, hoveredId, selectedId, repository, showLabels],
  );
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
  const embed = `[![Code City](${sitePath(`assets/${assetName}.${assetTheme}.svg`)})](${sitePath(exportRepository ? `repos/${repositorySlug(exportRepository)}/` : '')})`;

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
    if (name)
      setSelectedId(allBuildings.find((building) => building.repository === name)?.id ?? '');
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

  async function copyEmbed() {
    try {
      await navigator.clipboard.writeText(embed);
      setCopied(true);
      setNotice('README snippet copied. Update the image URL after hosting.');
    } catch {
      setNotice('Clipboard unavailable. Select and copy the snippet below.');
    }
  }

  function buildingId(event: MouseEvent | KeyboardEvent) {
    return (event.target as Element).closest('[data-building]')?.getAttribute('data-building');
  }

  return (
    <div className="app-shell" data-theme={theme === 'github-light' ? 'light' : 'dark'}>
      <aside className="sidebar">
        <a
          className="logo-link"
          href={repositoryPage ? sitePath('') : '#'}
          aria-label="Code City home"
          onClick={() => {
            setView('overview');
            filterRepository('');
          }}
        >
          <Logo />
        </a>
        <div className="workspace">
          <span className="workspace-avatar">
            <Code2 size={19} />
          </span>
          <div>
            Personal workspace<span>Your code, reimagined</span>
          </div>
          <span className="workspace-dot" />
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav aria-label="Main navigation">
          <button
            className={`nav-item ${view === 'overview' ? 'active' : ''}`}
            onClick={() => {
              setView('overview');
              filterRepository('');
            }}
          >
            <House size={17} />
            Overview{view === 'overview' && <span className="active-dot" />}
          </button>
          <button
            className={`nav-item ${view === 'repositories' ? 'active' : ''}`}
            onClick={() => setView('repositories')}
          >
            <FolderGit2 size={17} />
            Repositories<span className="count">{stats.repositories}</span>
          </button>
          <button className="nav-item" onClick={() => setDialog('export')}>
            <ArrowDownToLine size={17} />
            Export city
            <ChevronRight className="nav-chevron" size={14} />
          </button>
        </nav>
        <div className="nav-caption repo-caption">
          YOUR DISTRICTS <span>{String(stats.repositories).padStart(2, '0')}</span>
        </div>
        <div className="district-nav">
          {scene.repositories.map((repo) => (
            <button
              key={repo.name}
              className={`district-link ${repository === repo.name ? 'chosen' : ''}`}
              onClick={() => {
                filterRepository(repository === repo.name ? '' : repo.name);
                setView('overview');
              }}
            >
              <span
                className="color-dot"
                style={{ background: scene.theme.languages[repo.primaryLanguage] }}
              />
              <span>{repo.name}</span>
              <span className="file-count">{repo.buildings.length} files</span>
            </button>
          ))}
        </div>
        <div className="sidebar-bottom">
          <button className="theme-card" onClick={toggleTheme} aria-label="Change city theme">
            <span className="theme-moon">◐</span>
            <div>
              {scene.theme.name}
              <span>Switch city theme</span>
            </div>
            <span className="theme-swatch" />
          </button>
          <button className="mapping-link" onClick={() => setDialog('mapping')}>
            <Info size={15} />
            How the city works
            <ExternalLink size={13} />
          </button>
          <div className="version">
            <span className="status-dot" />
            {scene.isFixture
              ? 'Local demo'
              : `${source === 'local' ? 'Local' : source} repositories`}
            <span>v0.3.0</span>
          </div>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            {repositoryPage ? <a href={sitePath('')}>All repositories</a> : <span>Workspace</span>}
            <ChevronRight size={13} />
            <span>{pageRepository || (view === 'overview' ? 'Overview' : 'Repositories')}</span>
          </div>
          <div className="topbar-right">
            <button
              className="icon-button theme-toggle"
              aria-label={
                theme === 'github-dark' ? 'Switch to light theme' : 'Switch to dark theme'
              }
              onClick={toggleTheme}
            >
              {theme === 'github-dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <span className="fixture-badge">
              <span />
              {scene.isFixture ? 'Demo data' : `${source === 'local' ? 'Local' : source} scan`}
            </span>
            <span className="topbar-divider" />
            <button
              onClick={() => setDialog('mapping')}
              aria-label="About this city"
              className="icon-button"
            >
              <Info size={18} />
            </button>
            <span className="avatar">CC</span>
          </div>
        </header>

        <main>
          <section className="page-heading">
            <div>
              <div className="eyebrow">
                <span /> A DIFFERENT VIEW OF YOUR CODE
              </div>
              <h1>
                {view === 'overview' ? pageRepository || 'My Code City' : 'Your repositories'}
                <span className="heading-dot">.</span>
              </h1>
              <p>
                {view === 'overview'
                  ? 'Every file, a building. Every repository, a neighborhood.'
                  : `${stats.repositories} neighborhoods. One connected city.`}
              </p>
            </div>
            <button className="primary-button" onClick={() => setDialog('export')}>
              <ArrowDownToLine size={16} />
              Export SVG
              <ArrowRight size={15} />
            </button>
          </section>

          {view === 'repositories' && (
            <section className="repo-grid" aria-label="Repository list">
              {scene.repositories.map((repo) => (
                <button
                  className="repository-card"
                  key={repo.name}
                  onClick={() => {
                    filterRepository(repo.name);
                    setView('overview');
                  }}
                >
                  <span
                    className="repo-card-icon"
                    style={{ color: scene.theme.languages[repo.primaryLanguage] }}
                  >
                    <FolderGit2 size={23} />
                  </span>
                  <h2>
                    {repo.name}
                    <ArrowRight size={16} />
                  </h2>
                  <p>{repo.description}</p>
                  <div>
                    <span>{repo.primaryLanguage}</span>
                    <span>{repo.buildings.length} files</span>
                  </div>
                </button>
              ))}
            </section>
          )}

          <section className="city-panel" aria-label="City explorer">
            <div className="canvas-toolbar">
              <div className="canvas-title">
                <Layers3 size={16} />
                <span>City explorer</span>
                <div className="dimension-switch" role="group" aria-label="City view mode">
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
              </div>
              <div className="canvas-filters">
                <div className="select-wrap">
                  <select
                    aria-label="Filter repository"
                    value={repository}
                    onChange={(event) => filterRepository(event.target.value)}
                  >
                    <option value="">All repositories</option>
                    {scene.repositories.map((repo) => (
                      <option key={repo.name} value={repo.name}>
                        {repo.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={13} />
                </div>
                <span className="metric-label">
                  Height <span>Lines of code</span>
                </span>
                <button
                  className={`icon-button labels-button ${showLabels ? 'toggled' : ''}`}
                  aria-label="Toggle district labels"
                  aria-pressed={showLabels}
                  onClick={() => setShowLabels(!showLabels)}
                >
                  <Tag size={16} />
                </button>
              </div>
            </div>

            <div className="city-stage">
              {stats.files === 0 && (
                <div className="empty-city" role="status">
                  <h2>No source files to display</h2>
                  <p>This directory is empty or its files were excluded.</p>
                </div>
              )}
              <div className="city-caption">
                <span className="status-dot" />{' '}
                {repository
                  ? `${repository.toUpperCase()} DISTRICT`
                  : 'YOUR NEIGHBORHOOD, AT A GLANCE'}
                <span>
                  {visibleBuildings.length} buildings ·{' '}
                  {repository
                    ? 'District highlighted'
                    : `Built from ${stats.repositories} ${source} repositories`}
                </span>
              </div>
              {dimension === '3D' ? (
                <City3D
                  scene={scene}
                  state={{
                    selectedId: hoveredId || selectedId,
                    repository,
                    showLabels,
                    zoom,
                    reset,
                  }}
                  events={{
                    hover: setHoveredId,
                    select: setSelectedId,
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
                  className="city-art"
                  style={{ '--city-zoom': zoom } as CSSProperties}
                  onClick={(event) => {
                    const id = buildingId(event);
                    if (id) setSelectedId(id);
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
                        setSelectedId(id);
                      }
                    }
                  }}
                  dangerouslySetInnerHTML={{ __html: city }}
                />
              )}
              {threeError && (
                <div className="three-error" role="status">
                  {threeError}
                </div>
              )}
              <div className="compass">
                <Compass size={30} strokeWidth={1} />
                <span>{dimension === '3D' ? 'DRAG TO ROTATE' : 'ISOMETRIC VIEW'}</span>
              </div>
              {active && (
                <aside className="file-inspector" aria-label="File details">
                  <div className="inspector-top">
                    <span className="inspector-file-icon" style={{ color: active.color }}>
                      <FileCode2 size={21} />
                    </span>
                    <span>FILE INSPECTOR</span>
                    <span className="inspector-indicator" />
                  </div>
                  <h3 title={active.path}>{active.path}</h3>
                  {dimension === '3D' && (
                    <select
                      className="inspect-file"
                      aria-label="Inspect file"
                      value={selectedId}
                      onChange={(event) => {
                        setSelectedId(event.target.value);
                        setHoveredId(null);
                      }}
                    >
                      {visibleBuildings.map((building) => (
                        <option key={building.id} value={building.id}>
                          {building.repository}/{building.path}
                        </option>
                      ))}
                    </select>
                  )}
                  <a
                    className="inspector-repo"
                    href={sitePath(`repos/${repositorySlug(active.repository)}/`)}
                    title="Open repository page"
                  >
                    {active.repository} <ChevronRight size={11} /> {active.category}
                  </a>
                  <dl>
                    <div>
                      <dt>Language</dt>
                      <dd>
                        <i style={{ background: active.color }} />
                        {active.language}
                      </dd>
                    </div>
                    <div>
                      <dt>Lines of code</dt>
                      <dd>{active.lines.toLocaleString('en-US')}</dd>
                    </div>
                    <div>
                      <dt>File size</dt>
                      <dd>{(active.bytes / 1024).toFixed(1)} KB</dd>
                    </div>
                  </dl>
                  <div className="inspector-foot">
                    <span />
                    {scene.isFixture ? (
                      'Fixture file · preview only'
                    ) : active.githubUrl ? (
                      <a href={active.githubUrl} target="_blank" rel="noreferrer">
                        View committed source ↗
                      </a>
                    ) : (
                      'Local file · scanned from disk'
                    )}
                  </div>
                </aside>
              )}
              <div className="zoom-controls">
                <button
                  aria-label="Zoom out"
                  disabled={zoom <= 0.8}
                  onClick={() => setZoom(Math.max(0.8, +(zoom - 0.1).toFixed(1)))}
                >
                  <Minus size={16} />
                </button>
                <span aria-live="polite">{Math.round(zoom * 100)}%</span>
                <button
                  aria-label="Zoom in"
                  disabled={zoom >= 1.5}
                  onClick={() => setZoom(Math.min(1.5, +(zoom + 0.1).toFixed(1)))}
                >
                  <Plus size={16} />
                </button>
                <span className="zoom-divider" />
                <button
                  aria-label="Reset view"
                  onClick={() => {
                    setZoom(1);
                    setReset((value) => value + 1);
                    filterRepository('');
                  }}
                >
                  <Maximize size={15} />
                </button>
              </div>
            </div>

            <div className="canvas-footer">
              <div className="legend">
                {legend.map((item) => (
                  <span key={item.name}>
                    <i style={{ background: item.color }} />
                    {item.name}
                  </span>
                ))}
              </div>
              <span className="interaction-hint">
                {dimension === '3D'
                  ? 'Drag to rotate · Right-drag to pan · Click to inspect'
                  : 'Hover to discover · Click to inspect'}
              </span>
            </div>
          </section>

          <section className="stats-strip" aria-label="City statistics">
            <div>
              <FolderGit2 size={19} />
              <span>
                <strong>{stats.repositories.toString().padStart(2, '0')}</strong>Repositories
              </span>
            </div>
            <div>
              <Layers3 size={19} />
              <span>
                <strong>{stats.files}</strong>Buildings / files
              </span>
            </div>
            <div>
              <Code2 size={21} />
              <span>
                <strong>{compactNumber(stats.lines)}</strong>Lines of code
              </span>
            </div>
            <div>
              <Sparkles size={19} />
              <span>
                <strong>{stats.languages.length.toString().padStart(2, '0')}</strong>Languages
              </span>
            </div>
            <span className="stats-note">
              <span className="status-dot" />
              Same code. Same city.
            </span>
          </section>

          <section className="readme-section">
            <div className="readme-heading">
              <div>
                <span className="eyebrow">TAKE YOUR SKYLINE WITH YOU</span>
                <h2>
                  Made for your README<span>.</span>
                </h2>
                <p>A little piece of your code, wherever you share it.</p>
              </div>
              <button className="secondary-button" onClick={() => setDialog('export')}>
                Customize & export
                <ArrowRight size={15} />
              </button>
            </div>
            <div className="banner-frame">
              <div className="banner-frame-header">
                <span>
                  <span />
                  {assetName}.{assetTheme}.svg
                </span>
                <span>
                  {exportDimensions} <span className="filetype">SVG</span>
                </span>
              </div>
              <div className="banner-preview" dangerouslySetInnerHTML={{ __html: banner }} />
            </div>
          </section>
          <footer className="page-footer">
            <span>
              <Logo small />
              Built from code. Made to explore.
            </span>
            <span>
              {scene.theme.name} <span className="footer-separator">/</span>{' '}
              {scene.isFixture ? 'Demo city' : 'Built from your code'}
            </span>
          </footer>
        </main>
      </div>

      {dialog === 'export' && (
        <Dialog title="Take your skyline with you" onClose={() => setDialog(null)}>
          <p className="dialog-description">
            A self-contained SVG for your GitHub profile or project README.
          </p>
          <div className="export-preview" dangerouslySetInnerHTML={{ __html: banner }} />
          <div className="export-fields">
            <label className="export-scope">
              Export scope
              <select
                value={exportRepository}
                onChange={(event) => {
                  setExportRepository(event.target.value);
                  setCopied(false);
                }}
              >
                <option value="">{repositoryPage ? 'Profile size' : 'All repositories'}</option>
                {scene.repositories.map((repo) => (
                  <option key={repo.name} value={repo.name}>
                    {repo.name}
                  </option>
                ))}
              </select>
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
              <Check size={14} />
              {exportDimensions}
            </span>
            <span>
              <Check size={14} />
              No external assets
            </span>
            <span>
              <Check size={14} />
              {(new Blob([banner]).size / 1024).toFixed(0)} KB
            </span>
          </div>
          <div className="embed-section">
            <span>
              README snippet <small>Update the image path after hosting</small>
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
                setExportTitle(config.profile.title);
                setExportSubtitle(config.profile.subtitle);
              }}
            >
              <RotateCcw size={14} />
              Reset text
            </button>
            <button className="primary-button" onClick={download}>
              <ArrowDownToLine size={16} />
              Download SVG
            </button>
          </div>
        </Dialog>
      )}
      {dialog === 'mapping' && (
        <Dialog title="A city with a story" onClose={() => setDialog(null)}>
          <p className="dialog-description">
            Every part of the skyline represents a part of the code.
          </p>
          <div className="mapping-list">
            {[
              ['Repository', 'A distinct neighborhood'],
              ['File', 'One building in the city'],
              ['Lines of code', 'Building height, logarithmically scaled'],
              ['Language', 'The color of its buildings'],
              ['Test file', 'A green roof'],
              ['Documentation', 'A library and a shared plaza'],
            ].map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <ArrowRight size={14} />
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <p className="fixture-note">
            {scene.isFixture
              ? 'This demo uses 30 fixed example files in 4 fictional repositories.'
              : `This city contains ${stats.files} files scanned from ${stats.repositories} ${source} repositories. Each neighborhood is divided into directory blocks.`}{' '}
            Building positions and window lights are deterministic. The 2.5D and 3D views share the
            same scene. In 3D, drag to rotate, right-drag to pan and scroll to zoom. Arrow keys
            rotate the focused canvas; Home resets the camera.
          </p>
          <button className="primary-button" onClick={() => setDialog(null)}>
            Back to the city
            <ArrowRight size={15} />
          </button>
        </Dialog>
      )}
      <div className={`toast ${notice ? 'visible' : ''}`} role="status">
        {notice && (
          <>
            <Check size={16} />
            {notice}
          </>
        )}
      </div>
    </div>
  );
}
