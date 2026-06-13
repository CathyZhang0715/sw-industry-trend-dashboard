# 申万一级行业三个月趋势看板

一个零依赖 Node.js 看板，用申万一级行业分类的 31 个一级指数生成三个月趋势、排行、重点行业叠加对比图和明细表。

## 本地运行

```bash
node server.js
```

打开：

```text
http://127.0.0.1:4173
```

## 分享给别人

把项目部署到公网 Node.js 或 Docker 平台后，别人只需要打开部署后的网址即可查看，不需要在他们电脑安装任何东西。

## 长期托管，不依赖本机

推荐使用 GitHub Pages 静态托管。这个项目已经包含 `.github/workflows/pages.yml`，推到 GitHub 后会：

- 构建静态看板到 `dist/`
- 生成 `dist/api/industries.json` 数据快照
- 发布到 GitHub Pages
- 工作日自动刷新一次数据
- 支持在 GitHub Actions 页面手动触发刷新

第一次启用步骤：

1. 在 GitHub 创建一个新仓库。
2. 把本项目推送到仓库的 `main` 分支。
3. 打开仓库 `Settings -> Pages`。
4. 在 `Build and deployment` 中选择 `GitHub Actions`。
5. 等待 `Deploy dashboard to GitHub Pages` 工作流完成。
6. 使用 GitHub Pages 生成的网址分享给别人。

这种方式不需要你的电脑或终端保持运行。看板展示的是最近一次 GitHub Actions 构建生成的数据快照。

### 方式一：Node.js Web 服务

部署平台需要使用：

```bash
npm start
```

环境变量：

```text
NODE_ENV=production
```

服务会读取平台提供的 `PORT`，并在生产环境监听 `0.0.0.0`。

### 方式二：Docker

构建镜像：

```bash
docker build -t sw-industry-trend-dashboard .
```

运行容器：

```bash
docker run --rm -p 4173:4173 sw-industry-trend-dashboard
```

打开：

```text
http://127.0.0.1:4173
```

## 数据说明

- 数据源：申万宏源研究指数发布趋势接口。
- 指数范围：申万一级行业分类 31 个一级指数。
- 趋势区间：每个指数最新交易日前三个月日线。
- Node 服务模式缓存：10 分钟，减少对数据源的重复请求。
- GitHub Pages 静态模式：由 GitHub Actions 定时生成数据快照。
- 页面刷新时间和行情缓存更新时间会分开显示。

## 健康检查

```text
/health
```
