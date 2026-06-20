# **Langchain.js 实战三： RAG 知识库增强搜索**

## 使用 LangChain 构建语义搜索引擎

本教程将帮助您熟悉 LangChain 的文档加载器、嵌入和向量存储抽象概念。这些抽象概念旨在支持从（向量）数据库和其他来源检索数据，以便与 LLM 工作流集成。对于那些需要获取数据以进行推理以用于模型推理的应用程序（例如检索增强生成，即RAG）而言，这些抽象概念至关重要。包括以下内容：

- 文档和文档加载器；

- 文本分割器；

- 嵌入（文本向量化）；

- 向量存储和检索器。

- 向量召回

### 1\. 文档和文档加载器

LangChain 实现了很多用于加载不同类型文档的加载器，官方文档点击[这里](https://link.juejin.cn/?target=https%3A%2F%2Fdocs.langchain.com%2Foss%2Fjavascript%2Fintegrations%2Fdocument_loaders "https://docs.langchain.com/oss/javascript/integrations/document_loaders")，加载完后得到统一的文档对象 `Document`。常用文件类型如下：

文档加载器

描述

CSV

从 CSV 文件加载数据，并可配置列提取

JSON

使用 JSON 指针加载 JSON 文件以定位特定键

JSONLines

从 JSONLines/JSONL 文件加载数据

TEXT

加载纯文本文件或者 markdown

DOCX

加载 Microsoft Word 文档（.docx 和 .doc 格式）

EPUB

加载带有可选章节分割的EPUB文件

PPTX

加载 PowerPoint 演示文稿

Subtitles

加载字幕文件（.srt 格式）

与之对应加载器如下：

文档加载器

描述

DirectoryLoader

使用自定义加载器映射从目录中加载所有文件

UnstructuredLoader

使用非结构化 API 加载多种文件类型

MultiFileLoader

从多个单独的文件路径加载数据

ChatGPT

加载 ChatGPT 对话导出

Notion Markdown

加载导出为 Markdown 格式的 Notion 页面

OpenAI Whisper Audio

使用 OpenAI Whisper API 转录音频文件

PDF加载器

使用 pdf-parse 加载和解析 PDF 文件

具体还有哪些可以看下`@langchain/community/document_loaders/fs/`包下面有哪些文档格式的加载器。接下来我们使用 `TextLoader` 加载器加载 `readme.md` 文件来实战文件加载流程。

```js
import { TextLoader } from "@langchain/classic/document_loaders/fs/text";

const loader = new TextLoader("../readme.md");
const documents = await loader.load();
console.info(documents)
console.info(documents.length) // 打印加载了多少个页面，如果是 PDF 文件则打印加载的 PDF 页数
```

上面从文件中读取到的内容被封装成为了一个统一的 `Document` 对象， **请注意，单个Document对象通常代表整个文档的一部分，例如读取的是 PDF 文档则表示一页数据文档。**  包含了文件的内容和元数据。`pageContent`中是文件的内容，`metadata`中是文件的元数据，例如文件路径、文件名、文件大小等信息。`id`（可选）文档的字符串标识符。下面我们再来加载一个 PDF 论文文件看下加载后的内容（如果加载报错可能是 pdf 的版本与解析器版本不兼容，换个pdf试试）：

```js
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";

const loader = new PDFLoader("../resource/s41598-021-99343-4.pdf");
const docs = await loader.load();
console.info(docs)
console.log(docs.length);
```

对于每个Document对象，我们可以轻松访问：

- 页面的字符串内容；

- 包含文件名和页码的元数据。

```js
console.log(docs[0].pageContent.slice(0, 200)); // 访问第一页的前 200 个字符
console.log(docs[0].metadata); // 打印文档元信息
```

### 2\. 文本分割器

上面我们完成了文档的加载，对于加载后的文档，我们需要将文档切分成多个小的文档片段，每个文档片段包含一定数量的字符。这样可以方便后续的向量化处理。对于信息检索和后续问答而言，页面可能过于粗略。我们进一步拆分 PDF 文件有助于确保文档中相关部分的含义不会被周围的文本“掩盖”。

我们可以使用文本分割器来实现这一目的。这里我们将使用一个简单的文本分割器，它基于字符进行分割。我们将文档分割成 100 个字符的块，块之间有 20 个字符的重叠。(一般推荐切割大小为 1000，重叠部分为 200)重叠有助于减少将语句与其重要上下文分离的可能性。我们使用 `splitter` 函数 RecursiveCharacterTextSplitter，它会递归地使用换行符等常用分隔符分割文档，直到每个块都达到合适的大小。对于一般的文本用例，这是推荐的文本分割器。

如下输出的pageContent是docs被切割后的第一块，长度为 100 个字符，每个切割块与相邻切割块之间有 20 个字符的重叠。

```js
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 100,
  chunkOverlap: 20,
});

const allSplits = await textSplitter.splitDocuments(docs); // 对整个文档进行切块
console.log(allSplits[0]);
console.log(allSplits.length);
```

### 3\. 切割块向量化（Embedding）

向量搜索是一种存储和搜索非结构化数据（例如非结构化文本）的常用方法。其基本思想是存储与文本关联的数值向量。给定一个查询，我们可以将其嵌入为相同维度的向量，并使用向量相似度度量（例如余弦相似度）来识别相关文本。LangChain 支持来自数十个提供商的词嵌入，官方文档点击[这里](https://link.juejin.cn/?target=https%3A%2F%2Fdocs.langchain.com%2Foss%2Fjavascript%2Fintegrations%2Fembeddings "https://docs.langchain.com/oss/javascript/integrations/embeddings")。这些模型指定了如何将文本转换为数值向量。今天我们主要使用开源的 [HuggingFace transformers](https://link.juejin.cn/?target=https%3A%2F%2Fdocs.langchain.com%2Foss%2Fjavascript%2Fintegrations%2Fembeddings%2Ftransformers "https://docs.langchain.com/oss/javascript/integrations/embeddings/transformers") 和 阿里巴巴的千问 Embadding 模型。

3.1 阿里千问 Embedding 模型

```js
import { AlibabaTongyiEmbeddings } from "@langchain/community/embeddings/alibaba_tongyi";

const embeddingModel = new AlibabaTongyiEmbeddings({ 
  apiKey: process.env.QWEN_API_KEY,
  modelName: "text-embedding-v4",
  });
const res = await embeddingModel.embedQuery(
  "What would be a good company name a company that makes colorful socks?",
);
const documentRes = await embeddingModel.embedDocuments(["Hello world", "Bye bye"]);
// console.log({ documentRes });

console.log('---------------------------');
console.log({ res });
```

3.2 开源模型 transformers

首先安装相关依赖：`npm install @huggingface/transformers`

```js
import { HuggingFaceTransformersEmbeddings } from '@langchain/community/embeddings/huggingface_transformers'
const embeddingModel_tf = new HuggingFaceTransformersEmbeddings({
  model: 'Xenova/all-MiniLM-L6-v2'
})

const res = await embeddingModel_tf.embedQuery(
  "What would be a good company name a company that makes colorful socks?",
);

const documentRes = await embeddingModel_tf.embedDocuments(["Hello world", "Bye bye"]);
// console.log({ documentRes });

console.log('---------------------------');
console.log({ res });
```

```java
dtype not specified for "model". Using the default dtype (fp32) for this device (cpu).
```

### 4\. 向量存储与检索

LangChain VectorStore对象包含用于向存储中添加文本和对象，以及使用各种相似度度量进行查询的方法。它们通常使用嵌入模型进行初始化，这些模型决定了如何将文本数据转换为数值向量。LangChain 包含一系列与不同向量存储技术的集成，[官方文档](https://link.juejin.cn/?target=https%3A%2F%2Fdocs.langchain.com%2Foss%2Fjavascript%2Fintegrations%2Fvectorstores "https://docs.langchain.com/oss/javascript/integrations/vectorstores")。本次只学习内存存储与 FAISS 框架存储，用于轻量级工作负载。

LangChain 为矢量存储提供了一个统一的接口，使您能够：

- addDocuments- 将文档添加到向量存储中。

- delete- 按ID删除已存储的文档。

- similaritySearch- 查询语义相似的文档。 这种抽象让你可以在不同的实现方式之间切换，而无需改变应用程序逻辑。

4.1 内存存储

使用similaritySearch可以在向量存储中搜索与查询最相似的文档，该方法返回最接近的嵌入式文档： 许多矢量存储设备都支持以下参数：

- k — 返回的结果数量

- filter — 基于元数据的条件过滤，按元数据（例如来源、日期）筛选可以优化搜索结果。

```js
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { Document } from "@langchain/core/documents";
const vectorStore = new MemoryVectorStore(embeddingModel_tf);

// 向向量存储添加文档
const document1 = new Document({
  pageContent: "我的老师叫做 cheney，他是一位年轻的数学老师，他热爱 python 编程与数学。",
});
const document2 = new Document({
  pageContent: "您可以在我们的 ESM 指南 中找到有关 Electron 中 ESM 状态以及如何在我们的应用程序中使用它们的更多信息",
});
await vectorStore.addDocuments([document1,document2]);


// 相似性搜索12
const results = await vectorStore.similaritySearch("我的老师热爱数学", 1);
console.info(results)

// 相似性搜索2
const results2 = await vectorStore.similaritySearch("学习 Electron", 1);
console.info(results2)
```

4.2 FAISS 本地向量存储

FaissStore 是内存中的 FAISS 向量存储实现，本地持久化通过保存 index 文件到指定目录完成。首次创建空实例添加文档后保存，以后从目录加载。首先安装 FAISS 依赖包`npm install @langchain/community faiss-node`

```js
import { FaissStore } from "@langchain/community/vectorstores/faiss"; 
import { Document } from "@langchain/core/documents";
import { HuggingFaceTransformersEmbeddings } from '@langchain/community/embeddings/huggingface_transformers'

// 1. 创建 embeddings
const embeddings = new HuggingFaceTransformersEmbeddings({
  model: 'Xenova/all-MiniLM-L6-v2'
})
// 2. 创建空 vector store（首次使用）
let loadedVectorStore = new FaissStore(embeddings, {});

// 3. 添加文档
const docs: Document[] = [
  { pageContent: "线粒体是细胞的能量工厂", metadata: { source: "biology.com" } },
  { pageContent: "java 编程我不会",       metadata: { source: "arch.com" } },
  { pageContent: "线粒体由脂质构成",        metadata: { source: "biology.com" } },
  { pageContent: "张智华是华为公司的员工，今年 38 岁，负责开发 AI 产品，年收入 1000 万美元。",        metadata: { source: "biology.com" } },
];

await loadedVectorStore.addDocuments(docs,{ ids: ["1", "2", "3","4"] }); // 文档向量持久化并添加到索引
```

```输出
dtype not specified for "model". Using the default dtype (fp32) for this device (cpu).

[ "1", "2", "3", "4" ]
```

相似性查询

```js
const results = await loadedVectorStore.similaritySearch("线粒体的结构", 2);
results.forEach(doc => {
  console.log(doc.pageContent, doc.metadata);
});

// 带分数查询，一般用的多
const withScores = await loadedVectorStore.similaritySearchWithScore("细胞结构", 2);
withScores.forEach(([doc, score]) => {
  console.log(score, doc.pageContent);
});
```



删除文档

```js
await loadedVectorStore.delete({ ids: ["3"] }); // 按 ID 删除
```

更新文档

```js
// 删除旧文档
await loadedVectorStore.delete({ ids: ["3"] });

// 添加新内容
await loadedVectorStore.addDocuments(
  [{ pageContent: "线粒体是双层膜结构的细胞器", metadata: { source: "updated.com" } }],
  { ids: ["3"] }
);
```

```输出
[ "3" ]
```

```js
// 保存到本地目录（创建 index 目录和文件）
await loadedVectorStore.save("./faiss_index");  // 本地持久化 


// 后续加载已保存的 store
loadedVectorStore = await FaissStore.load(
  "./faiss_index",
  embeddings,
  { maxConcurrency: 128 }  // 可选参数
);
```

### 5\. 向量召回

LangChainVectorStore对象不继承Runnable类。LangChain Retriever是 Runnable 对象，因此它们实现了一组标准方法（例如，同步和异步invoke操作batch）。虽然我们可以从向量存储中构造 Retriever，但 Retriever 也可以与非向量存储数据源（例如外部 API）进行交互。Vectorstore 实现了一个as\_retriever方法，用于生成 Retriever，具体来说是一个 Retriever VectorStoreRetriever。这些 Retriever 包含特定的属性search\_type，search\_kwargs用于标识要调用底层 Vectorstore 的哪些方法以及如何参数化这些方法。例如，我们可以使用以下代码重现上述操作：

```js
// 转成标准 Retriever 接口
const retriever = loadedVectorStore.asRetriever({
  k: 2,                        // 召回数量
  searchType: "similarity",    // 计算相似度的函数 "mmr",MMR（Maximal Marginal Relevance）在保证相关性的同时，最大化结果多样性，避免召回内容重复。
  filter: (doc) => doc.metadata.source === "biology.com", // 过滤条件
});

// 直接调用
const docs = await retriever.invoke("线粒体的结构");
console.log(docs);
```

```输出
[
  { pageContent: "线粒体是细胞的能量工厂", metadata: { source: "biology.com" } },
  { pageContent: "线粒体是双层膜结构的细胞器", metadata: { source: "updated.com" } }
]
```
 