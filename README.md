# FlyHome · 回家机票比价

阿联酋（迪拜 / 阿布扎比）往返国内 15 个主要城市的机票监控看板，最终目的地周口，人民币报价。
每周一自动从 Google Flights 抓一轮往返价（也可在页面上点「抓取最新价格」随时抓），按「票价 + 时间成本 + 中转扣分 + 高铁回家」算综合成本排序，静态页面部署在 GitHub Pages。

## 怎么跑

```bash
pnpm install
pnpm sample      # 生成示例数据（不花额度），用来调界面
pnpm dev         # http://localhost:3000

cp .env.example .env   # 填 SERPAPI_KEY
pnpm fetch-prices   # 真实抓一次，写入 data/（不能叫 pnpm fetch，那是 pnpm 的内置命令）
pnpm generate    # 产出 .output/public
```

## 数据来源与额度

- Google Flights 没有官方 API，通过 [SerpApi](https://serpapi.com/google-flights-api) 查询。免费档每月 250 次搜索。
- 一次抓取 = `arrivalGroups` 数量 × 日期对数量。默认 2 组 × 12 个出发日 = 24 次；每周一自动一轮 ≈ 100~120 次/月，剩下的留给手动点。额度不累积，月底清零。
- 抓取前会先查账户余额，不够一整轮就直接跳过，避免半截数据覆盖 `latest.json`。
- 一个查询最多能带 9 个机场（实测），所以分两组：A 组离周口近（北京/上海/南京/郑州/合肥/武汉/西安），B 组其他枢纽（广州/深圳/杭州/成都/重庆/昆明/天津/长沙）。
- 用国家 kgmid（`/m/0d05w3` 中国）当目的地也能查，但 Google 只给它挑的"热门"结果，南京、郑州这类根本不出现，所以没采用。
- 多机场查询不返回 `price_insights`，页面自动隐藏"Google 价格水平"列和 60 天历史图。

## 配置 `flyhome.config.json`

| 字段 | 说明 |
|---|---|
| `origins` | 出发机场 |
| `cities` | 落地城市 → 机场列表，页面按城市汇总 |
| `arrivalGroups` | 每组一次查询；拆成多组能拿到更多结果，但额度成倍 |
| `trip.days` | 往返间隔（默认 28 天） |
| `trip.fromDays / toDays / stepDays` | 扫描的出发日：今天起 +14 天到 +112 天，每 7 天一个 |
| `search.bags` | 随身行李件数（影响低成本航司报价） |
| `keepPerQuery` | 每个日期对保留的方案数（取最便宜的 N 条 + 默认权重下性价比最高的 N/2 条 + Google 推荐），原始返回约 300 条/查询，不裁剪一次抓取 6.7 MB |
| `keepRunDays` | `data/runs/` 保留天数；`history.json` 是累积的，不受影响 |
| `scoring` | 打分默认值（每小时价值、每次中转、隔夜中转），单位人民币；页面滑块可临时覆盖 |
| `home.onward` | 各机场 → 高铁站 → 周口的换乘时间、车程、票价（估算，自己改）；没配置的机场用 `home.onwardFallback` 并在卡片上标"粗估" |

打分参数（每小时时间价值、中转扣分、是否算高铁）在页面上实时调，存在浏览器本地。

## 页面上的「抓取最新价格」按钮

静态页跑不了抓取，按钮做的是调用 GitHub API 触发 `fetch.yml`（`workflow_dispatch`），然后轮询运行状态，跑完自动重新部署。
第一次点会要一个 GitHub **fine-grained token**：Repository access 只勾这个仓库，Permissions 只给 Actions: Read and write。token 只存在当前浏览器的 localStorage，不进仓库。
每次手动抓取同样消耗 `arrivalGroups × 日期对` 次额度（默认 24），确认框里会写明。

## 部署

- `fetch.yml`：每周一 07:00（迪拜时间）自动抓取，也可手动触发（页面按钮或 Actions 页 Run workflow），抓取后提交 `data/`，然后调用部署。公开仓库 60 天没人提交时 GitHub 会自动停掉定时任务，Actions 页会提示，点一下 Enable 即可。
- `deploy.yml`：`nuxt generate` → GitHub Pages。
- 需要在仓库 Settings → Secrets 里配置 `SERPAPI_KEY`，Settings → Pages 的 Source 选 GitHub Actions。

## 目录

```
app/            Nuxt 4 应用（Nuxt UI 4 + Tailwind 4 + ECharts）
scripts/        抓取、示例数据、归一化
data/runs/      每次抓取一份；latest.json 给页面用；history.json 画走势
flyhome.config.json
```
