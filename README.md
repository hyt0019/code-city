# Code City

**把代码仓库变成一座城市，让 GitHub 主页展示项目的轮廓。**

Code City 将本地目录或公开 GitHub 仓库生成城市 SVG 横幅和可交互的 3D 页面。每个仓库是一片城区，每个文件是一栋建筑；相同输入保持稳定布局，代码变化可以在城市中被看见。

[在线演示](https://hyt0019.github.io/code-city/) · [单仓库演示](https://hyt0019.github.io/code-city/repos/code-city/) · [MIT License](./LICENSE)

[![Code City 城市横幅](./generated/profile.svg)](https://hyt0019.github.io/code-city/)

## 可以用来做什么

- **装饰 GitHub 个人主页**：将最多 8 个精选仓库合成一张可点击的城市横幅。
- **展示单个项目**：为每个仓库生成独立横幅和浏览页面。
- **探索代码结构**：在 2.5D / 3D 视图中旋转、缩放、筛选仓库和查看文件信息。
- **导出分享图片**：下载 SVG、高清 PNG 横幅或当前 3D 视角截图。
- **自动保持更新**：通过 GitHub Actions 定期生成，再发布到 GitHub Pages。

支持深浅主题、按行数或文件大小切换建筑高度、提交时间窗灯、Star 地标和归档仓库外观。运行时不调用 AI API，不需要后端、数据库或用户登录。

## 快速开始：创建自己的主页城市

### 1. 准备 Code City 仓库

Fork 本仓库到自己的 GitHub 账号，建议保留仓库名 `code-city`。进入 Fork 的 **Actions** 页面，按页面提示启用工作流。

Code City 仓库用于保存配置和托管城市；个人主页的 README 保存在与 GitHub 用户名同名的公开仓库中。

### 2. 选择要展示的项目

编辑 [codecity.config.ts](./codecity.config.ts)，将 `USERNAME` 和示例仓库名替换为实际值。建议从 3～8 个代表项目开始，也支持只展示一个仓库。

```ts
export default {
  owner: 'USERNAME',
  repositories: [
    { github: 'USERNAME/project-one' },
    { github: 'USERNAME/project-two' },
    { github: 'USERNAME/project-three' },
  ],
  exclude: ['previews/**'],
  appearance: {
    theme: 'github-dark',
    heightMetric: 'lines',
    showLabels: true,
    showLegend: true,
  },
  profile: {
    title: 'My Code City',
    subtitle: 'Selected projects, one skyline',
    width: 1200,
    height: 420,
  },
} as const;
```

默认配置扫描 Code City 自身。`owner` 是场景信息，不会自动发现该账号的全部仓库；需要在 `repositories` 中明确列出要展示的项目。公开 GitHub 输入还支持可选的分支、标签或 commit，以及展示名称：

```ts
{ github: 'USERNAME/project-one', ref: 'main', name: 'my-project' }
```

省略 `ref` 时跟随远程默认分支；省略 `name` 时使用仓库名。多个同名仓库需要设置不同的 `name`。配置列表最多包含 8 个仓库。

### 3. 发布到 GitHub Pages

1. 打开 Code City 仓库的 **Settings → Pages → Build and deployment**。
2. 将 **Source** 设置为 **GitHub Actions**。
3. 提交配置到 `main`。
4. 在 **Actions → Deploy Code City** 中查看运行结果；也可点击 **Run workflow** 手动生成。
5. 全部检查和部署通过后，打开 `https://USERNAME.github.io/code-city/`。

如果修改了托管仓库的名称，URL 中的 `code-city` 也要替换。自定义域名或其他部署路径可以直接使用网站导出窗口的 **Copy README snippet**，获取当前站点的完整链接。

部署工作流会先扫描、生成并测试网站，通过后再发布。默认使用 Actions 提供的 `GITHUB_TOKEN`，无需额外创建 PAT。

### 4. 放进 GitHub 个人主页

创建或打开与 GitHub 用户名同名的**公开仓库**，将代码添加到根目录的 `README.md`。例如账号为 `octocat`，个人主页仓库就是 `octocat/octocat`。详见 [GitHub 个人主页 README 说明](https://docs.github.com/en/account-and-profile/how-tos/profile-customization/managing-your-profile-readme)。

替换以下代码中的 `USERNAME`：

```md
[![My Code City](https://USERNAME.github.io/code-city/assets/profile.svg)](https://USERNAME.github.io/code-city/)
```

提交后，GitHub 个人主页会显示城市横幅；点击图片即可进入交互式城市。README 中展示的是静态图片，3D 浏览在独立网页中打开。

要跟随访问者的 GitHub 深浅主题切换图片，可以使用：

```html
<a href="https://USERNAME.github.io/code-city/">
  <picture>
    <source
      media="(prefers-color-scheme: dark)"
      srcset="https://USERNAME.github.io/code-city/assets/profile.dark.svg"
    />
    <source
      media="(prefers-color-scheme: light)"
      srcset="https://USERNAME.github.io/code-city/assets/profile.light.svg"
    />
    <img
      alt="My Code City — explore my projects"
      src="https://USERNAME.github.io/code-city/assets/profile.svg"
      width="1200"
    />
  </picture>
</a>
```

发布后图片地址保持不变，后续更新城市不需要反复修改个人主页 README。

## 为单个项目添加横幅

在城市页面中选择一个仓库，打开 **Export SVG**，将 **Export scope** 设置为该仓库，再点击 **Copy README snippet**。把得到的代码放入该项目的 README 即可。

普通英文仓库名的链接形式如下：

```md
[![Repository Code City](https://USERNAME.github.io/code-city/assets/repos/project-one.svg)](https://USERNAME.github.io/code-city/repos/project-one/)
```

单仓库横幅大小为 `900 × 315`；点击后进入只展示该仓库的城市。中文或含特殊字符的展示名称会转换为安全路径，使用网页复制功能可以避免手工拼错链接。

## 本地运行与生成

需要 Git、Node.js 24.18.0（见 [.nvmrc](./.nvmrc)）和 npm。

```sh
git clone https://github.com/hyt0019/code-city.git
cd code-city
npm ci
npm run generate
npm run dev
```

默认本地地址是 `http://127.0.0.1:5173`。扫描自己的目录或公开仓库：

```sh
# 一个本地目录
npm run generate -- --repo ../my-project

# 聚合多个本地目录
npm run generate -- --repo ../project-one --repo ../project-two

# 一个公开 GitHub 仓库
npm run generate -- --github USERNAME/project-one

# 混合本地目录与公开仓库
npm run generate -- --repo ../local-project --github USERNAME/project-one

# 查看内置演示城市
npm run generate -- --demo
```

路径包含空格时需要加引号。`--repo` 与 `--github` 可重复使用，合计最多 8 个输入；提供这些参数时会替换配置中的仓库列表，不会改写配置文件。`--demo` 使用虚构示例数据，不能与仓库参数混用。

生成后刷新浏览器即可看到新城市。构建和预览静态网站：

```sh
npm run build
npm run preview
```

构建保留已有场景数据；代码发生变化后，需要先运行 `npm run generate` 重新扫描，再构建。生成文件位于 `generated/`，网页资产同步写入 `public/assets/`，可部署的网站位于 `dist/`。

## 浏览、导出与自定义

| 操作         | 使用方式                                                                               |
| ------------ | -------------------------------------------------------------------------------------- |
| 探索 3D 城市 | 点击 **3D**；拖动旋转、右键拖动平移、滚轮缩放。手机支持单指旋转、双指缩放和平移        |
| 查看文件     | 悬停或点选建筑；3D 模式也可用 **Inspect file** 下拉框选择文件                          |
| 打开源码     | 在文件详情点击 **View committed source**，跳转到对应 commit 下的 GitHub 文件           |
| 切换高度指标 | 在 **Height: lines / Height: file size** 中选择行数或文件大小，建筑位置保持不变        |
| 切换主题     | 点击太阳 / 月亮按钮，在 Midnight Skyline 和 Daylight Skyline 间切换                    |
| 调整视图     | 使用右下角缩放和重置按钮；聚焦 3D 画布后，方向键旋转，Home 重置视角                    |
| 下载横幅     | 打开 **Export SVG**，选择范围并修改标题，然后点击 **Download SVG** 或 **Download PNG** |
| 保存当前视角 | 点击城市工具栏的相机按钮 **Download view PNG**                                         |
| 复制嵌入代码 | 在导出窗口点击 **Copy README snippet**                                                 |

SVG 个人横幅为 `1200 × 420`，单仓库横幅为 `900 × 315`。PNG 横幅使用 2 倍分辨率，分别为 `2400 × 840` 和 `1800 × 630`。当前视角 PNG 保留旋转、缩放、仓库高亮、标签和主题。

导出窗口内修改的标题、副标题和指标只影响预览与下载。**复制的 README 链接指向已经发布的横幅**；要让线上横幅采用新的标题或默认指标，请修改 `codecity.config.ts` 并重新部署。本地预览复制的是本机地址，需要发布后再用于公开 README。

常用配置：

| 配置项                    | 作用                                      |
| ------------------------- | ----------------------------------------- |
| `profile.title`           | 横幅标题，最多 28 个字符                  |
| `profile.subtitle`        | 横幅副标题，最多 48 个字符                |
| `appearance.theme`        | 默认主题：`github-dark` 或 `github-light` |
| `appearance.heightMetric` | 默认高度指标：`lines` 或 `bytes`          |
| `appearance.showLabels`   | 是否显示城区标签                          |
| `appearance.showLegend`   | 是否在横幅中显示图例                      |
| `exclude`                 | 额外排除的文件路径规则                    |
| `scanner.maxFileBytes`    | 单文件大小上限，默认 2,000,000 字节       |
| `scanner.maxFiles`        | 文件数量上限，默认 20,000                 |

## 城市元素代表什么

| 城市元素     | 对应数据                                                         |
| ------------ | ---------------------------------------------------------------- |
| 城区         | 一个代码仓库                                                     |
| 城区内的街区 | 一级目录                                                         |
| 建筑         | 一个有效文本文件                                                 |
| 建筑高度     | 行数或文件字节数，采用对数缩放                                   |
| 建筑占地     | 文件大小的相对权重                                               |
| 建筑颜色     | 文件语言                                                         |
| 绿色屋顶     | 测试文件                                                         |
| 图书馆与广场 | README 和文档                                                    |
| 地标塔尖     | 仓库 Star 数量；每个有 Star 的非空仓库一处，采用有上限的对数缩放 |
| 窗户亮度     | 文件最近提交时间相对于所扫描仓库 commit 的活跃程度               |
| 灰色城区     | 已归档仓库                                                       |

Star 数量和归档状态通过 `{ github: 'owner/repo' }` 输入读取。本地扫描不会主动查询这些元数据。元数据不可用时显示 **Stars unavailable**；无法确认文件提交日期时显示 **Unknown**。

## 更新城市

部署支持三种触发方式：

- 将代码或 `codecity.config.ts` 的更改推送到 `main`。
- 在 **Actions → Deploy Code City → Run workflow** 手动运行。
- 每周一 02:17 UTC（北京时间 10:17）的计划更新。

精选仓库产生新提交后，可等待定时任务，或手动运行工作流提前更新。工作流重新生成静态资产并发布，不会把生成文件提交回仓库。

Fork 后需要确认定时工作流已启用；公开仓库长时间没有活动时，GitHub 可能自动停用计划任务，可在 Actions 中重新启用。见 [GitHub 工作流启用说明](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows)。

## 常见问题与数据范围

**页面能直接输入任意仓库并生成城市吗？**

页面用于浏览和导出已生成的城市。仓库选择在 `codecity.config.ts` 或本地命令中完成，再由本地生成或 GitHub Actions 发布。

**支持私有仓库吗？**

GitHub 输入只支持公开仓库。本地扫描支持普通目录和 Git 仓库；发布前可用 `exclude` 排除不希望展示的文件路径。生成场景包含文件名和统计信息，不包含源码正文。

**哪些文件会被忽略？**

扫描遵守嵌套 `.gitignore`，默认过滤依赖、构建和缓存目录、锁文件、生成文件、二进制及非 UTF-8 文本，不跟随符号链接。超出单文件大小上限的文件会跳过；超出文件数量上限则停止生成，可以缩小扫描范围后重试。有效行数是排除常见注释和空行的轻量统计。

**文件时间为什么显示 Unknown？**

时间来自最多 256 条近期主线提交。合并按进入主线的提交记录，重命名按新路径的提交记录；浅克隆边界、超出历史范围、无 Git 历史或读取失败时显示 Unknown。本地未提交修改仍显示最近一次已提交的时间。缺失日期保留默认灯光，亮度不会随浏览器打开时间改变。

**为什么有些文件没有源码链接？**

源码链接需要可识别的 GitHub 仓库地址和 commit。普通目录或存在未提交修改的本地仓库会保留文件信息，但不提供可能与扫描内容不一致的 commit 链接。

**GitHub API 限流或暂时不可用怎么办？**

公开元数据缓存 6 小时，接口异常时使用旧缓存或只生成 Git 文件数据。可在本地通过环境变量 `GITHUB_TOKEN` 提高 API 限额，令牌不会写入生成资产。源码下载失败会停止生成，避免把旧代码当作新结果发布。

**没有 WebGL 或 JavaScript 还能看吗？**

WebGL 不可用时自动使用 SVG 视图。禁用 JavaScript 时，已构建的首页和独立仓库页仍能展示对应的静态横幅。README 横幅本身不依赖脚本、外部字体或图片。

## 预览

![3D 城市浏览](./previews/three-desktop.png)

[浅色主题](./previews/daylight-desktop.png) · [手机 3D](./previews/three-mobile.png) · [Star 与归档城区](./previews/signals-desktop.png) · [归档城区手机预览](./previews/signals-mobile.png)

上述截图使用演示仓库；[本地仓库示例](./previews/local-city-desktop.png) 展示真实扫描结果。

## 开发与验证

项目使用 TypeScript、React、Vite 和 Three.js。SVG 与 3D 共享 `scene.json` 中的布局和文件信息。

```sh
npm run check         # 格式检查、单元测试、类型检查和生产构建
npm run test:e2e      # 桌面与手机交互、导出、回退和视觉检查
npm run test:pages    # 构建后检查子路径、独立仓库页面和无 JavaScript 回退
```

Windows 默认使用 Microsoft Edge；其他平台需先执行 `npx playwright install chromium`。可通过 `PLAYWRIGHT_CHANNEL` 指定浏览器通道。

## License

MIT，见 [LICENSE](./LICENSE)。
