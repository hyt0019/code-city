export default {
  owner: 'hyt0019',
  repositories: [
    { github: 'hyt0019/loader', name: 'loader' },
    { github: 'hyt0019/code-city', name: 'code-city' },
    { github: 'hyt0019/ReplayFlashFix', name: 'ReplayFlashFix' },
    { github: 'hyt0019/TJU-auto-course-selector', name: 'TJU-auto-course-selector' },
  ],
  exclude: ['previews/**'],
  appearance: { theme: 'github-dark', showLabels: true, showLegend: true },
  profile: {
    title: 'hyt0019 Code City',
    subtitle: 'Six projects, one skyline',
    width: 1200,
    height: 420,
  },
} as const;
