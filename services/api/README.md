# @inkloom/api

InkLoom Web 云端 API。当前提供邮箱账号、HttpOnly 会话、用户工作区、文档 CRUD、revision 冲突保护、历史版本恢复和 SQLite 持久化。

## 运行

从仓库根目录构建并启动：

```powershell
pnpm --filter @inkloom/api build
$env:INKLOOM_DATABASE_PATH=".inkloom/inkloom.sqlite"
$env:INKLOOM_ASSET_DIR=".inkloom/assets"
pnpm --filter @inkloom/api start
```

默认监听 `http://127.0.0.1:3001`。

## 环境变量

| 变量                        | 说明                                                 |
| --------------------------- | ---------------------------------------------------- |
| `HOST`                      | 监听地址，本地默认 `127.0.0.1`，容器内设为 `0.0.0.0` |
| `PORT` / `INKLOOM_API_PORT` | API 端口，默认 `3001`                                |
| `INKLOOM_DATABASE_PATH`     | SQLite 文件路径                                      |
| `INKLOOM_ASSET_DIR`         | 内容寻址资产文件目录，默认 `data/assets`             |
| `INKLOOM_MAX_ASSET_BYTES`   | 单个资产最大字节数，默认 50 MiB                      |
| `INKLOOM_WEB_ORIGINS`       | 逗号分隔的允许 Web Origin                            |
| `INKLOOM_SECURE_COOKIES`    | 非生产环境显式启用 Secure Cookie                     |

生产环境设置 `NODE_ENV=production`，Cookie 名会自动使用 `__Host-` 前缀。API 域名和反向代理配置见 [部署文档](../../docs/DEPLOYMENT.md)。
