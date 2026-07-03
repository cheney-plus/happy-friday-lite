好的，已经为您将 Zvec 的 Node.js 快速开始指南整理为一份清晰的笔记。

---

Zvec 向量数据库快速入门笔记 (Node.js)
安装

npm install @zvec/zvec
创建 Collection (集合)
作用：存储 Document 的容器，需要定义 Schema 来描述数据类型。
Schema 结构：
$1：标量字段（如整数、字符串）。
$1：向量字段。
代码示例：

import { ZVecCollectionSchema, ZVecCreateAndOpen, ZVecDataType, ZVecIndexType, ZVecMetricType } from "@zvec/zvec";

// 1. 定义 Schema
const collectionSchema = new ZVecCollectionSchema({
    name: "mycollection", // 集合名称
    fields: [
        {
            name: "publishyear",          // 标量字段名
            dataType: ZVecDataType.INT32,
            indexParams: { indexType: ZVecIndexType.INVERT, enableRangeOptimization: true }
        }
    ],
    vectors: [
        {
            name: "embedding",             // 向量字段名
            dataType: ZVecDataType.VECTORFP32,
            dimension: 768,                 // 向量维度
            indexParams: { indexType: ZVecIndexType.HNSW, metricType: ZVecMetricType.COSINE }
        }
    ]
});

// 2. 创建并打开集合
const collection = ZVecCreateAndOpen("./mycollectiondata", collectionSchema);

> ⚠️ 注意：后续插入和查询数据时，必须严格使用 $1 和 $1 这些字段名。
添加 Document (文档)
作用：向集合中插入数据。
$1 参数：一个包含 $1, $1, $1 的对象。

collection.insertSync({
    id: "book1",                                     // 文档唯一标识
    vectors: { "embedding": Array(768).fill(0.1) },   // 替换为真实向量
    fields: { "publishyear": 1936 }
});
优化 Collection (优化索引)
作用：新插入的向量暂存于临时索引，调用此方法可构建完整的向量索引，加速检索。
方式：同步或异步。

// 同步
collection.optimizeSync();

// 异步
await collection.optimize();
按 ID 获取 Document
作用：通过唯一 $1 直接获取文档。

let result = collection.fetchSync("book1");
console.log(result);
向量检索

6.1 基础相似度检索
$1 / $1 参数：包含 $1, $1, $1。

// 同步
let result = collection.querySync({
    fieldName: "embedding",
    vector: Array(768).fill(0.3), // 替换为真实向量
    topk: 10
});
console.log(result);

// 异步
let resultAsync = await collection.query({
    fieldName: "embedding",
    vector: Array(768).fill(0.3), // 替换为真实向量
    topk: 10
});
console.log(resultAsync);

6.2 带条件过滤的相似度检索
作用：在检索时通过 $1 参数筛选出满足条件的文档。

// 同步
let result = collection.querySync({
    fieldName: "embedding",
    vector: Array(768).fill(0.3),
    topk: 10,
    filter: "publishyear > 1936" // 过滤条件
});
console.log(result);

// 异步
let resultAsync = await collection.query({
    fieldName: "embedding",
    vector: Array(768).fill(0.3),
    topk: 10,
    filter: "publishyear > 1936"
});
console.log(resultAsync);
查看 Collection 信息

// 查看 Schema
console.log(collection.schema.toString());

// 查看统计信息
console.log(collection.stats);
删除 Document

// 按 ID 删除
collection.deleteSync("book1");

// 按筛选条件删除
collection.deleteByFilterSync("publishyear < 1900");

// 异步按筛选条件删除
await collection.deleteByFilter("publish_year < 1900");

---

总结：以上是使用 Zvec Node.js SDK 进行基本 CRUD 和向量检索的完整流程。


在执行任何数据库操作之前，你可以选择使用 init() 函数来配置全局设置。

如果不进行配置，Zvec 会自动应用合理的默认值 — 通常会根据系统的可用内存、CPU 和运行环境进行优化调整。
当你需要自定义设置时请使用 init()，例如：
调整日志的详细程度或输出格式
控制并发数 (比如查询线程数)
如需调用 init()，请只在程序启动时调用一次 (在创建或打开任何 collection 之前)。init() 不支持运行时动态修改配置。

配置示例

Python
Node.js
全局配置

import { ZVecInitialize, ZVecLogLevel, ZVecLogType } from "@zvec/zvec";
ZVecInitialize({
    logType: ZVecLogType.CONSOLE,
    logLevel: ZVecLogLevel.WARN,
    queryThreads: 4
});
将日志输出到控制台，级别为 WARN 及更高。
将查询线程数限制为最多 4 个。
关于配置选项和高级调优参数的完整列表，请参阅 API Reference。


Zvec 提供了一套完整的数据操作方法来管理 Collection 中的 Document。

操作	用途
Insert	添加新 Document（如果 ID 已存在则失败）
Upsert	插入新 Document 或按 ID 替换已有 Document
Update	按 ID 修改已有 Document 的特定字段
Delete	按 ID 或标量过滤条件删除 Document
Query	执行向量相似度搜索或全文检索，可结合标量过滤和重排序
Fetch	按 ID 直接获取完整 Document
所有写操作（insert、upsert、update、delete）都会立即对查询可见——支持真正的实时流式工作负载。