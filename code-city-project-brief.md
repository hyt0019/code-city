# Code City 项目制作说明书

> 把这份文档交给新的 coding agent。它既是产品计划书，也是项目实施任务书。

## 1. 给 coding agent 的任务

请在当前新项目中开发 **Code City**：一个将本地代码仓库或公开 GitHub 仓库（如果用户同意，也可以是私有的GitHub 仓库，但是不展示详情，仅展示外观）转换为等距视角“代码城市”的开源工具。

项目开发过程中可以使用 AI coding，但成品运行时不得调用任何 AI 模型或 AI API。项目应是纯前端、静态生成和 GitHub 自动化方案，不依赖后端服务器、数据库或用户登录。

请以“先完成最小垂直链路，再逐步扩展”的方式实施，不要一开始过度拆包或设计复杂插件系统。遇到不影响核心方向的小问题时自行采用合理默认值，不要因为缺少 GitHub 用户名或仓库列表而停止开发；先使用内置 fixture 和示例配置完成可运行版本。

最终目标是同时得到：

1. 可嵌入 GitHub 个人主页 README 的城市 SVG 横幅；
2. 可嵌入单个项目 README 的仓库城市 SVG 横幅；
3. 部署在 GitHub Pages 上的交互式 3D 城市；
4. 自动扫描、生成、构建和部署的 GitHub Actions 工作流；
5. 清晰的配置示例、使用文档和测试。

---

## 2. 产品定位

一句话描述：

> Turn GitHub repositories into deterministic isometric code cities.

Code City 不是普通的仓库统计面板。它把代码结构转换成一座具有空间层次、视觉风格和探索性的城市，让开发者可以用它美化 GitHub 个人主页、展示代表项目，并让访问者直观理解项目规模和结构。

### 核心原则

- **确定性**：相同代码和配置必须生成完全相同的城市，建筑不能每次随机换位置。
- **可解释**：每一种城市元素都应与一个明确的代码指标对应。
- **先静态、后交互**：SVG 横幅是最重要的产物，3D 页面是增强体验。
- **零运行成本**：成品不调用 AI，不需要常驻后端。
- **渐进增强**：README 即使无法运行 JavaScript，也能看到完整城市横幅。
- **数据克制**：只展示精选仓库和有意义的文件，不用视觉噪声填满画面。

---

## 3. 使用场景

### 3.1 GitHub 个人主页

用户选择 3～8 个代表仓库，每个仓库成为一片城区。生成一张 `1200 × 420` 的个人城市横幅，放在用户名同名仓库的 `README.md` 顶部。

建议嵌入代码：

```md
[![My Code City](https://USERNAME.github.io/code-city/assets/profile.svg)](https://USERNAME.github.io/code-city/)
```

### 3.2 单个项目 README

为每个精选仓库生成独立横幅：

```md
[![Repository Code City](https://USERNAME.github.io/code-city/assets/repos/REPOSITORY.svg)](https://USERNAME.github.io/code-city/repos/REPOSITORY/)
```

### 3.3 交互式项目展示

访问 GitHub Pages 后，用户可以：

- 旋转、缩放和平移城市；
- 悬停建筑查看文件信息；
- 点击建筑跳转到对应 commit SHA 下的 GitHub 文件；
- 切换仓库、主题和展示指标；
- 下载当前城市的 SVG 或截图。

---

## 4. 城市映射规则

### 4.1 个人主页模式

| GitHub 数据 | 城市元素 |
|---|---|
| 一个仓库 | 一个城区 |
| 仓库代码量 | 城区面积 |
| 主要语言 | 城区主色 |
| Star 数量 | 地标塔或塔尖高度 |
| 最近更新时间 | 窗户灯光亮度 |
| README、docs | 广场或图书馆 |
| tests、spec | 公园或体育场 |
| 已归档仓库 | 灰色旧城区 |

### 4.2 单仓库模式

| 代码数据 | 城市元素 |
|---|---|
| 一级目录 | 街区 |
| 文件 | 建筑 |
| 代码行数 | 建筑高度 |
| 文件大小 | 建筑占地面积 |
| 文件语言 | 建筑颜色 |
| 目录深度 | 街区层级或道路层级 |
| 最近修改时间 | 窗户灯光 |
| 入口文件 | 地标建筑 |
| 测试文件 | 绿色屋顶 |
| 配置文件 | 基础设施建筑 |

建议使用对数缩放，避免少数超大文件压制其他建筑：

```ts
height = clamp(2 + Math.log2(lines + 1) * 1.5, 3, 28);
```

布局必须排序稳定并使用由仓库、路径和 commit SHA 派生的固定种子。禁止直接使用 `Math.random()` 决定城市结构。

---

## 5. 视觉方向

第一版采用以下固定方向：

- 等距视角 2.5D；
- GitHub 深色主题；
- 黑蓝色背景；
- 按语言区分的低饱和霓虹色；
- 低多边形建筑；
- 轻量阴影和窗户灯光；
- 不使用外部字体和大型纹理；
- 默认横幅尺寸 `1200 × 420`；
- 优先保证小尺寸下仍能看清城市轮廓；
- 同时为浅色主题预留配色接口。

视觉需要满足三个观察层级：

1. 远看能辨认城市天际线；
2. 中距离能辨认不同目录和语言城区；
3. 交互页面近看能查看具体文件指标。

不要把所有文件都做成视觉地标。入口文件、文档和代码量最高的少量文件才应该突出显示。

---

## 6. 系统架构

所有输出必须共享同一个中间场景模型：

```text
本地仓库或公开 GitHub 仓库
        ↓
扫描文件、Git 元数据和仓库元数据
        ↓
RepositorySnapshot
        ↓
确定性城市布局
        ↓
CityScene / scene.json
        ├── SVG 横幅渲染器
        └── Three.js 交互渲染器
```

静态 SVG 与 3D 网站不能分别计算两套布局。它们必须读取相同的 `scene.json`，确保用户看到的是同一座城市。

### 6.1 建议数据模型

```ts
export interface CityScene {
  schemaVersion: 1;
  generatedAt: string;
  owner: string;
  theme: CityTheme;
  camera: CameraPreset;
  repositories: RepositoryDistrict[];
}

export interface RepositoryDistrict {
  name: string;
  url: string;
  commitSha: string;
  primaryLanguage: string;
  stars: number;
  bounds: Rect;
  buildings: Building[];
}

export interface Building {
  id: string;
  path: string;
  category: "source" | "test" | "docs" | "config" | "asset";
  language: string;
  lines: number;
  bytes: number;
  modifiedAt?: string;
  position: Point;
  width: number;
  depth: number;
  height: number;
  color: string;
  githubUrl?: string;
}
```

`generatedAt` 不得参与布局或快照哈希，否则每次构建都会产生无意义差异。

---

## 7. 技术选型

- TypeScript
- React
- Vite
- Three.js 与 React Three Fiber
- D3 Hierarchy，用于稳定的矩形树图土地分配
- `fast-glob`，用于文件扫描
- `ignore`，用于处理 `.gitignore`
- `zod`，用于配置及中间数据校验
- Vitest，负责单元测试和快照测试
- Playwright，负责页面交互和截图回归测试
- GitHub Actions，负责定时生成与部署
- GitHub Pages，负责静态托管

使用当前 Node.js LTS，并通过 `.nvmrc`、Volta 或 `engines` 固定版本。

第一阶段保持单仓库，不要立刻建立复杂 monorepo。等核心生成链路稳定后，再考虑拆出：

```text
@code-city/core
@code-city/cli
@code-city/github-action
```

---

## 8. 推荐目录结构

```text
code-city/
├─ src/
│  ├─ core/
│  │  ├─ model.ts
│  │  ├─ config.ts
│  │  └─ metrics.ts
│  ├─ scanner/
│  │  ├─ scan-local.ts
│  │  ├─ git-metadata.ts
│  │  └─ exclusions.ts
│  ├─ layout/
│  │  ├─ treemap.ts
│  │  ├─ buildings.ts
│  │  └─ isometric.ts
│  ├─ renderers/
│  │  ├─ svg/
│  │  └─ three/
│  ├─ components/
│  ├─ pages/
│  └─ main.tsx
├─ scripts/
│  ├─ generate.ts
│  └─ collect-repositories.ts
├─ fixtures/
├─ tests/
├─ public/
├─ generated/
├─ .github/
│  └─ workflows/
│     ├─ test.yml
│     └─ deploy-pages.yml
├─ codecity.config.ts
├─ vite.config.ts
├─ package.json
├─ LICENSE
└─ README.md
```

---

## 9. 配置设计

实现一个类型安全、可校验的配置文件：

```ts
export default {
  owner: "your-github-name",

  repositories: [
    "project-a",
    "project-b",
    "project-c"
  ],

  exclude: [
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/coverage/**",
    "**/vendor/**",
    "**/*.lock",
    "**/*.min.js"
  ],

  appearance: {
    theme: "github-dark",
    projection: "isometric",
    background: "#0d1117",
    showLabels: true,
    showLegend: true,
    buildingGap: 2
  },

  profile: {
    title: "My Code City",
    subtitle: "Built from public repositories",
    width: 1200,
    height: 420
  }
};
```

默认排除：

- 依赖目录；
- 构建产物；
- 覆盖率报告；
- 压缩文件；
- 二进制文件；
- lockfile；
- 自动生成代码；
- Git 内部目录；
- 体积异常的数据文件。

---

## 10. 数据获取方案

MVP 支持：

- 扫描本地 Git 仓库；
- 浅克隆用户配置的公开 GitHub 仓库；
- 读取当前 commit SHA；
- 获取文件路径、字节数、代码行数和语言；
- 可选获取 Star、描述、默认分支等公开仓库元数据。

MVP 不支持：

- 私有仓库；
- 用户登录；
- OAuth；
- 完整 Git 历史；
- 实时监听；
- 后端数据库；
- 在线多用户生成服务。

如果使用 GitHub Git Trees API，必须处理 `truncated: true`。该接口递归树存在 100,000 条目和 7 MB 的限制，大型仓库应回退到浅克隆。

GitHub API 请求需要缓存并处理速率限制。公开、未认证请求的常规 REST 限额较低，不应在浏览器每次访问时重新抓取全部数据。所有仓库数据应在构建阶段生成，页面只加载静态 JSON。

---

## 11. 分阶段实施计划

### 阶段 0：视觉原型

目标：使用固定假数据生成第一张漂亮的城市 SVG。

任务：

- 初始化 Vite、React、TypeScript；
- 定义核心数据结构；
- 创建包含约 30 栋建筑的 fixture；
- 实现等距坐标转换；
- 实现原生 SVG 建筑绘制；
- 加入标题、图例、城区标签和下载按钮；
- 确定深色主题。

验收：

- 页面可正常运行和构建；
- 可下载 `1200 × 420` SVG；
- 城市轮廓清晰，文字没有溢出；
- 坐标计算有单元测试；
- 相同 fixture 产生一致输出。

在此阶段不要接入 GitHub API、Three.js 或 GitHub Actions。

### 阶段 1：真实仓库扫描

目标：把本地仓库转换为 `RepositorySnapshot`。

任务：

- 扫描本地目录；
- 尊重 `.gitignore`；
- 识别语言和文件类别；
- 统计字节数和有效行数；
- 读取 commit SHA；
- 过滤无意义文件；
- 输出标准化 JSON；
- 创建小型、多语言和大型 fixture 仓库测试。

建议命令：

```bash
pnpm generate --repo ../some-project
```

### 阶段 2：确定性城市布局

目标：从仓库快照得到稳定的 `CityScene`。

任务：

- 一级目录划分街区；
- 使用 squarified treemap 分配土地；
- 建筑高度使用对数缩放；
- 语言映射到稳定颜色；
- 入口文件和文档成为地标；
- 建立路径到建筑 ID 的稳定哈希；
- 检查并消除建筑重叠。

验收：

- 输入文件顺序变化不会改变布局；
- 相同输入输出字节级一致；
- 5,000 个文件仍能正常生成；
- 无 NaN、负尺寸或重叠建筑。

### 阶段 3：SVG 横幅

目标：产生可以直接放进 GitHub README 的正式横幅。

任务：

- 根据 `CityScene` 输出 SVG；
- 优化元素数量；
- 添加标题、语言图例和项目统计；
- 支持个人主页与单仓库两种尺寸；
- 支持深色和浅色主题接口；
- 添加 SVG 快照测试；
- 准备示例 README 嵌入代码。

验收：

- SVG 在 GitHub README 中可显示；
- 默认 SVG 尽量小于 500 KB；
- 无外部 JavaScript、字体或图片依赖；
- 缩放后依然清晰；
- 缺少部分数据时仍能生成可用图像。

### 阶段 4：交互式 3D 页面

目标：用 Three.js 渲染与 SVG 相同的城市。

任务：

- 读取已有 `scene.json`；
- 实现旋转、缩放和平移；
- 悬停高亮建筑；
- 展示文件路径、语言、行数和大小；
- 点击跳转到固定 commit SHA 下的 GitHub 文件；
- 支持手机端；
- 支持 `prefers-reduced-motion`；
- 为 WebGL 不可用场景显示 SVG fallback。

### 阶段 5：个人主页聚合

目标：将多个精选仓库组合成一座个人代码城市。

预期输出：

```text
dist/
├─ index.html
├─ assets/
│  ├─ profile.svg
│  └─ repos/
│     ├─ project-a.svg
│     └─ project-b.svg
└─ repos/
   ├─ project-a/index.html
   └─ project-b/index.html
```

城区之间应有明确留白或道路，不要把多个仓库简单拼成一个无法辨认的矩形。

### 阶段 6：GitHub Pages 自动部署

工作流触发：

- `workflow_dispatch` 手动触发；
- 每周定时更新；
- Code City 自身代码或配置变化时触发。

工作流：

1. 检出 Code City；
2. 拉取配置中的公开仓库；
3. 生成快照、场景和 SVG；
4. 构建网站；
5. 上传 Pages artifact；
6. 部署 GitHub Pages。

权限遵循最小权限原则：

```yaml
permissions:
  contents: read
  pages: write
  id-token: write
```

不要使用 `write-all`，不要把令牌写入生成文件或前端 bundle。

---

## 12. 测试计划

必须覆盖：

- 空仓库；
- 只有一个文件的仓库；
- 多语言仓库；
- monorepo；
- 大量小文件；
- 单个超大文件；
- 中文路径；
- 带空格和特殊字符的路径；
- 没有 Git 历史的普通目录；
- `.gitignore` 排除；
- 删除或重命名文件；
- 5,000 个以上文件；
- GitHub 元数据请求失败。

自动测试重点：

- 坐标转换正确；
- 布局确定性；
- 建筑不重叠；
- 配置校验；
- 路径和 GitHub URL 编码；
- SVG 能被标准解析器读取；
- 生成输出中不含本机绝对路径；
- 页面没有明显横向溢出；
- 3D 页面出现错误时能回退到静态图。

---

## 13. MVP 验收标准

满足以下条件即可发布第一版：

- 支持本地仓库；
- 支持配置公开 GitHub 仓库；
- 能生成单仓库城市；
- 能聚合 3～8 个精选仓库；
- 能输出 README 可用的 SVG；
- 能输出可交互的 GitHub Pages 网站；
- 点击建筑能进入对应源码；
- 同一输入具有稳定布局；
- 测试和生产构建通过；
- GitHub Actions 能自动部署；
- README 包含截图、快速开始、配置说明和嵌入代码；
- 成品不调用任何 AI API；
- 无后端服务和数据库依赖。

---

## 14. 暂不实施的功能

以下功能放入后续路线图，不得阻塞 MVP：

- 完整 Git 历史动画；
- 提交时的城市建造过程；
- 高频修改文件的施工吊车；
- 被删除文件的遗迹；
- Release 纪念碑；
- 组织级代码大陆；
- OAuth 和私有仓库；
- 在线主题编辑器；
- 视频导出；
- npm CLI 和通用 GitHub Action 市场发布。

---

## 15. 建议开发顺序

```text
漂亮的假数据 SVG
→ 本地仓库扫描
→ 确定性布局
→ 正式 README 横幅
→ Three.js 交互
→ 多仓库聚合
→ GitHub Pages 自动部署
```

第一轮开发只完成阶段 0，确保视觉方向成立。完成后展示生成的横幅、测试结果和构建结果，再进入真实仓库扫描。不要先花大量时间编写 GitHub 数据抓取逻辑。

---

## 16. 第一轮立即执行的任务

请现在完成以下工作：

1. 检查当前目录，确认是否为空项目，并保留任何已有用户文件；
2. 初始化 Vite、React、TypeScript 项目；
3. 配置格式检查、Vitest 和基础目录结构；
4. 定义 `CityScene`、`RepositoryDistrict`、`Building` 等核心类型；
5. 创建约 30 栋建筑的固定 fixture；
6. 实现纯函数形式的等距坐标转换；
7. 实现不依赖 Canvas 的 SVG 渲染器；
8. 在页面中预览城市并提供 SVG 下载；
9. 为坐标和确定性添加测试；
10. 完成 README，记录启动、测试和构建方式；
11. 运行测试和生产构建；
12. 汇报已完成内容、文件位置、验证结果和下一阶段建议。

如果安装依赖需要网络权限，请正常申请。除非遇到会改变产品方向的问题，否则自行作出实现层面的合理决定并继续。

---

## 17. 官方参考

- GitHub Profile README 支持图片和 GIF，并显示在个人主页顶部：<https://docs.github.com/en/account-and-profile/concepts/personal-profile>
- GitHub Pages 自定义 Actions 工作流：<https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages>
- Git Trees API 及递归结果限制：<https://docs.github.com/en/rest/git/trees>
- GitHub REST API 速率限制：<https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api>
- GitHub Actions 最小权限与安全建议：<https://docs.github.com/en/actions/reference/security/secure-use>

