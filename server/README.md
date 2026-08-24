# Happy Friday 企业版服务

## 运行

```bash
cd server
go run .
```

默认监听 `0.0.0.0:17918`，数据保存在 `server/data/friday.db`。

首次启动默认创建管理员 `admin`，默认密码为 `change-me-now`。正式部署前请设置环境变量：

```bash
HAPPY_FRIDAY_ADMIN_USER=admin HAPPY_FRIDAY_ADMIN_PASSWORD='至少8位的密码' go run .
```

可通过 `HAPPY_FRIDAY_ADDR` 修改监听地址，通过 `HAPPY_FRIDAY_DATA_DIR` 修改数据目录。

## 已提供接口

- `GET /health`：服务健康检查
- `POST /api/auth/login`：账号登录，返回 Bearer Token
- `GET /api/auth/me`：当前登录用户
- `GET /api/admin/users`：管理员查看账号
- `POST /api/admin/users`：管理员创建员工账号
- `GET /api/admin/data`：管理员查看会话、笔记、日程摘要
- `/admin`：管理员登录、创建员工、查看数据

员工登录后使用 `Authorization: Bearer <accessToken>` 调用：

- `GET/POST /api/data/notes`，`GET/PUT/DELETE /api/data/notes/:id`

笔记列表支持 `q`、`notebookId`、`knowledgeBaseId` 查询参数；笔记记录按 Token 对应用户隔离，并保存 `knowledge_base_id`、`notebook_id` 关联字段。
- `GET/POST /api/data/sessions`
- `GET/POST /api/data/messages/:sessionId`
- `GET/POST /api/data/schedule-events`

所有数据接口都按 Token 对应的用户自动隔离，员工不能读取其他员工的数据。

数据边界：聊天会话、消息、笔记和日程保存在服务端；自动化、DeepSeek Harness 和 Agent 仍在客户端执行；知识库原始文档不上传，后续由服务端 Zvec 只保存客户端提交的向量和必要元数据。

知识库索引由服务端负责：`POST /api/knowledge/index` 接收客户端文件文本，服务端切块、执行 Embedding 并写入向量存储；`POST /api/knowledge/search` 执行语义检索。客户端不再执行切块、Embedding 或向量持久化。
