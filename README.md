# Code City

**A skyline built from code.** Turn repositories into deterministic isometric cities.

![Code City Midnight Skyline banner](./generated/profile.svg)

## 当前进度

已按所选 **A · 午夜天际线（Midnight Skyline）** 完成视觉原型，并接通本地扫描、确定性布局和静态产物的完整链路（阶段 0～2）。

- React、TypeScript、Vite 单项目；可扫描本地仓库，也保留 30 栋建筑、4 个虚构仓库的演示数据。
- 支持 Git 仓库和普通目录、嵌套 `.gitignore`、语言和文件类别识别、有效行数/字节数/内容哈希、Git commit 元数据。
- 使用 D3 squarified treemap 分配仓库、一级目录和文件地块，排序稳定，建筑无重叠。
- 原生 SVG 等距城市：连续街区、道路、窗灯、地标、测试绿顶、文档广场。
- 响应式预览页，支持仓库高亮、鼠标悬停、点击或键盘选择建筑、缩放、重置、城区标签开关。
- 自定义横幅标题和副标题，下载自包含的 `1200 × 420` SVG。
- 场景导出为 `generated/scene.json`，网页加载同一份静态 JSON，和横幅共用绘制函数。
- 不调用 AI API，不依赖后端、数据库、登录、外部字体或图片。

当前预览可以使用真实扫描数据，右上角显示 **Local scan**；演示模式显示 **Demo data**。尚未接入 GitHub 仓库下载/API、Three.js 或 GitHub Actions。对于有 GitHub remote 且工作区干净的本地仓库，文件详情提供固定到 commit 的源码链接；有未提交修改或没有 Git 历史时只展示本地文件信息。

## 启动

使用 Node.js 24 LTS（`.nvmrc` 固定 24.18.0，与当前验证环境一致）及 npm。依赖精确版本和锁文件已经保存。

```sh
npm ci
npm run dev
```

打开终端显示的本地地址，默认是 `http://127.0.0.1:5173`。

```sh
npm run generate     # 写出 SVG 和 scene.json
npm run build        # 类型检查、生成静态产物、生产构建
npm run preview      # 预览 dist，默认端口 4173
```

扫描真实目录（可重复 `--repo` 聚合最多 8 个本地仓库）：

```sh
npm run generate -- --repo .
npm run generate -- --repo ../project-a --repo ../project-b
npm run build
npm run dev
```

包含空格的路径请加引号。生成后刷新浏览器即可；构建会保留已有场景，不会把真实数据覆盖回演示数据。重新扫描可更新城市。恢复演示场景使用 `npm run generate -- --demo`。

生成结果：

| 文件                        | 用途                                               |
| --------------------------- | -------------------------------------------------- |
| `generated/profile.svg`     | 可独立打开或嵌入 README 的横幅                     |
| `generated/scene.json`      | 带版本号的城市中间模型                             |
| `generated/snapshots.json`  | 本地扫描得到的标准仓库快照，不含绝对路径或源码内容 |
| `public/assets/profile.svg` | 网页的静态横幅入口                                 |
| `public/assets/scene.json`  | 网页可访问的场景数据                               |
| `dist/`                     | 完整静态网站，构建时同步生成横幅与 JSON            |

页面只读取 `assets/scene.json`，使用 Zod 校验，再交给渲染器。静态图和交互预览调用同一个 `renderCityContents()`，不另算布局。数据加载失败时显示独立 SVG 和重试按钮；空目录提供空状态。

## 导出和嵌入

点击页面右上角 **Export SVG**，可修改标题和副标题，再点击 **Download SVG**。下载的文件名为 `code-city-profile.svg`，无脚本和外部资源，离开网页也能使用。

当前项目的 README 可直接引用：

```md
![My Code City](./generated/profile.svg)
```

后续部署至 GitHub Pages 后，将以下占位符换成自己的用户名和部署路径：

```md
[![My Code City](https://USERNAME.github.io/code-city/assets/profile.svg)](https://USERNAME.github.io/code-city/)
```

UI 中的复制按钮提供相对路径模板；用于不同仓库的 README 时，需要换成已托管的完整图片 URL。部署工作流留待后续阶段。

## 数据与视觉配置

- `fixtures/city.ts`：固定文件列表、城区位置、建筑大小和语言配色。
- `codecity.config.ts`：本地仓库列表、排除规则、默认标题、副标题与导出显示设置。
- `src/scanner/`：目录扫描、忽略规则、语言识别及本地 Git 元数据。
- `src/layout/treemap.ts`：稳定的仓库/目录/文件土地分配。
- `src/core/model.ts`：`CityScene`、`RepositoryDistrict`、`Building`、主题与相机类型。
- `src/layout/isometric.ts`：纯函数等距投影与地面逆投影。
- `src/renderers/svg/city.ts`：纯 SVG 城市与横幅渲染。

真实模式按有效行数的对数权重给仓库与目录分配土地，以字节数的对数权重分配文件占地。每个地块保留道路间隔。建筑基础高度采用任务书中的对数缩放，少量入口文件额外提升为地标。排序不依赖文件系统枚举顺序；建筑 ID 来自仓库名和路径，窗灯由稳定哈希决定，`generatedAt` 不参与布局。演示模式保留经过确认的固定构图。

扫描默认排除依赖、构建和缓存目录、锁文件、压缩代码、生成文件、二进制文件；跳过超过 2 MB 的文件与非 UTF-8 文本，不跟随符号链接。文件上限默认 20,000，超限会报错而不是悄悄截断。有效行数排除空行及常见完整注释；这是轻量文本统计，不是语言编译器的语义分析。未读取完整 Git 历史，因此暂不提供逐文件修改时间。

可在 `codecity.config.ts` 配置 `repositories: [{ path: '../project-a', name: 'project-a' }]`，然后直接执行 `npm run generate`。不同仓库名称须唯一。可选 `scanner: { maxFileBytes: 2000000, maxFiles: 20000 }` 修改扫描边界。输入配置和场景数据均有 Zod 校验。

每种城市元素的解释可在页面 **How the city works** 中查看。主题字段已经独立定义，浅色主题尚未提供。

## 验证

```sh
npm run format:check  # Prettier 格式检查
npm test              # Vitest：坐标、确定性、边界、XML 等
npm run build         # TypeScript + SVG/JSON 生成 + Vite 构建
npm run test:e2e      # Playwright 桌面与手机浏览器检查
```

Windows 默认使用已安装的 Microsoft Edge。其他平台默认使用 Playwright Chromium，首次运行需要执行 `npx playwright install chromium`。也可以通过 `PLAYWRIGHT_CHANNEL` 环境变量指定支持的浏览器通道。

单元测试涵盖：等距坐标与逆投影、配置校验、嵌套忽略和否定规则、二进制和生成文件过滤、中文/特殊字符路径、重命名、无 Git 历史、真实临时 Git 仓库与 commit URL、5,001 个文件的扫描和布局、超大文件权重、城区边界与无重叠、输入重排后的字节级一致性、SVG 快照及标准 XML 解析。

浏览器检查涵盖：桌面/手机渲染、无横向页面溢出、仓库筛选、键盘选择、缩放重置、标题编辑、实际下载内容、仓库导航、真实 JSON 加载、空目录及加载失败回退、关闭 JavaScript 后的独立 SVG。真实城市截图保存至 `previews/local-city-desktop.png` 和 `previews/local-city-mobile.png`，演示截图使用 `implemented-` 前缀。默认示例横幅小于 500 KB；大仓库会减少窗户装饰，完整文件 SVG 仍可能超过这个软目标。

## 实现截图

![当前项目的真实城市](./previews/local-city-desktop.png)

手机截图见 [local-city-mobile.png](./previews/local-city-mobile.png)。三套前期概念图和演示截图保留在 `previews/`；概念图仅作为设计参考，成品渲染不使用这些图片。

## 下一阶段

继续阶段 3～6：完善单仓库横幅与浅色主题，使用同一 `scene.json` 接入 Three.js 交互，添加公开 GitHub 仓库采集和 GitHub Pages 自动部署。

技术参考：[Node.js 版本说明](https://nodejs.org/en/about/previous-releases)、[Vite 文档](https://vite.dev/guide/)。

## License

MIT，见 [LICENSE](./LICENSE)。
