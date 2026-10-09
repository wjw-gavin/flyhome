# FlyHome · 回家机票比价

阿联酋（迪拜 / 阿布扎比）往返国内（北京 / 上海 / 南京 / 郑州）的机票监控看板，最终目的地周口。
每两天从 Google Flights 抓一次往返价，按「票价 + 时间成本 + 中转扣分 + 高铁回家」算综合成本排序，静态页面部署在 GitHub Pages。

## 怎么跑

```bash
pnpm install
pnpm sample      # 生成示例数据（不花额度），用来调界面
pnpm dev         # http://localhost:3000

cp .env.example .env   # 填 SERPAPI_KEY
pnpm fetch       # 真实抓一次，写入 data/
pnpm generate    # 产出 .output/public
```

## 数据来源与额度

- Google Flights 没有官方 API，通过 [SerpApi](https://serpapi.com/google-flights-api) 查询。免费档每月 250 次搜索。
- 一次抓取 = `arrivalGroups` 数量 × 日期对数量。默认 1 组 × 15 个出发日 = 15 次，隔天跑一次 ≈ 225 次/月。
- 抓取前会先查账户余额，不够一整轮就直接跳过，避免半截数据覆盖 `latest.json`。
- 多机场写在同一个查询里（`DXB,AUH` → `PEK,PKX,PVG,SHA,NKG,CGO`），不额外花额度。

## 配置 `flyhome.config.json`

| 字段 | 说明 |
|---|---|
| `origins` | 出发机场 |
| `cities` | 落地城市 → 机场列表，页面按城市汇总 |
| `arrivalGroups` | 每组一次查询；拆成多组能拿到更多结果，但额度成倍 |
| `trip.days` | 往返间隔（默认 28 天） |
| `trip.fromDays / toDays / stepDays` | 扫描的出发日：今天起 +14 天到 +112 天，每 7 天一个 |
| `search.bags` | 随身行李件数（影响低成本航司报价） |
| `home.onward` | 各机场 → 高铁站 → 周口的换乘时间、车程、票价（估算，自己改） |

打分参数（每小时时间价值、中转扣分、是否算高铁）在页面上实时调，存在浏览器本地。

## 部署

- `fetch.yml`：每两天 07:00（迪拜时间）抓取，提交 `data/`，然后调用部署。也可在 Actions 页手动触发。
- `deploy.yml`：`nuxt generate` → GitHub Pages。
- 需要在仓库 Settings → Secrets 里配置 `SERPAPI_KEY`，Settings → Pages 的 Source 选 GitHub Actions。

## 目录

```
app/            Nuxt 4 应用（Nuxt UI 4 + Tailwind 4 + ECharts）
scripts/        抓取、示例数据、归一化
data/runs/      每次抓取一份；latest.json 给页面用；history.json 画走势
flyhome.config.json
```
