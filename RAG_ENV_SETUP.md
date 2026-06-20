# RAG 环境准备命令

由于开发环境网络无法访问 GitHub（faiss-node 预编译包下载超时），
请在网络通畅的环境下执行以下命令完成依赖安装。

## 1. 安装 RAG 相关依赖（LangChain 最新版 + faiss-node）

在项目根目录执行：

```bash
# 删除可能存在的旧版本锁定的 node_modules 子包
rm -rf node_modules/@langchain node_modules/faiss-node node_modules/@huggingface/transformers

# 重新安装（使用最新版，已在 package.json 中配置）
npm install --legacy-peer-deps
```

## 2. 如果 faiss-node 预编译包下载仍失败

faiss-node 需要 GitHub releases 提供的预编译二进制。
若 GitHub 不通，可尝试以下方案之一：

### 方案 A：使用 GitHub 镜像
```bash
# 设置 prebuild-install 使用镜像
export npm_config_faiss_node_binary_host_mirror=https://ghproxy.com/https://github.com/ewfian/faiss-node/releases/download/
npm install faiss-node --legacy-peer-deps
```

### 方案 B：手动下载预编译包
1. 访问 https://github.com/ewfian/faiss-node/releases
2. 下载对应版本和平台的 tar.gz，例如：
   `faiss-node-v0.5.1-napi-v127-darwin-arm64.tar.gz`
3. 放到项目的 `node_modules/faiss-node/prebuilds/` 目录下
4. 重新执行 `npm install faiss-node --legacy-peer-deps`

### 方案 C：从源码编译（需要 cmake 和编译工具链）
```bash
npm install faiss-node --build-from-source --legacy-peer-deps
```

## 3. 验证安装

```bash
node --input-type=module -e "import { FaissStore } from '@langchain/community/vectorstores/faiss'; console.log('FaissStore:', typeof FaissStore)"
node --input-type=module -e "import { HuggingFaceTransformersEmbeddings } from '@langchain/community/embeddings/huggingface_transformers'; console.log('Embeddings:', typeof HuggingFaceTransformersEmbeddings)"
```

两条命令都输出 `function` 即表示安装成功。

## 4. 关于 HuggingFace 模型

首次运行 RAG 流程时，`Xenova/all-MiniLM-L6-v2` 模型会自动从 HuggingFace 下载（约 25MB）。
若 HuggingFace 不可达，可设置镜像：

```bash
export HF_ENDPOINT=https://hf-mirror.com
```

或在应用启动前手动下载模型到本地缓存目录。
