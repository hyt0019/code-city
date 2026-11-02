export default {
  owner: 'hyt0019',
  // Repository names under owner; the first 8 are shown.
  // Use 'other-owner/repo' for someone else's repository or './path' for a local directory.
  // An object adds options: { github: 'owner/repo', ref: 'main', name: 'alias', description: '…' }
  // A description replaces the repository's own one in the city and on its banner.
  repositories: [
    {
      github: 'hyt0019/saywell',
      description: '按住说话，松开就是一段干净的文字。本地语音识别，AI 整理口误与重复。',
    },
    {
      github: 'hyt0019/loader',
      description: '面向真实装柜约束的三维装箱系统：多策略优化、碰撞与支撑校验、三维复核。',
    },
    {
      github: 'hyt0019/reed-relay',
      description: '把音频转成保留原调的可编辑曲谱，再按自定义键位在游戏中自动演奏。',
    },
    {
      github: 'hyt0019/code-city',
      description: '把代码仓库变成一座城市：每个仓库一片城区，每个文件一栋建筑。',
    },
  ],
  exclude: ['previews/**'],
  appearance: { theme: 'github-dark', showLabels: true, showLegend: true },
  profile: {
    title: 'hyt0019',
    subtitle: '让工具实用，让复杂直观。',
    width: 1200,
    height: 420,
  },
} as const;
