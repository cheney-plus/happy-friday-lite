# RAG全流程分为两大阶段：

当前需要实现的是离线索引阶段：文档加载→分块→向量化→向量存储，核心是将异构文档转化为可检索的向量索引，构建知识库

## 知识库中的文件在何时进行切片与向量化存储
知识库中的所有文件都可以通过 RAG 知识检索功能进行检索。那么对于知识库中的各种格式的文件在什么时机进行切片与向量化存储呢？
第一个时机是在用户上传本地文件或者本地文件夹或者笔记、网页时，将文件推入到队列中，等待异步处理。
第二个时机是每天定时进行一次，对于已经发生修改或者新增的文件，将文件推入到队列中，等待异步处理。
第三个时机是用户设置中点击“知识库检索更新”按钮时，仅对修改日期不一致的文件推入到队列中，等待异步处理。

以上三个触发时机需要控制并发问题，防止同时触发多个线程进行切片与向量化存储，导致数据不一致。解决方法是引入简单的任务队列，使用文件路径作为去重 Key。如果该文件正在处理中，新的触发请求直接忽略或排队。比对状态库与当前文件系统/数据库，找出变更文件，将任务推入串行队列。队列中的任务按入队顺序进行处理，每个任务处理完成后，更新状态库，记录该文件已经经过切片与向量化存储。从而只需要更新队列中的文档即可。

任务队列每隔 5 分钟检查一次是否有新的任务需要处理，但在任务入队时，可以触发一次立即检查，确保新任务能够及时被处理。

补充 file_status 表的定义。
 
状态库建议使用 SQLite，表结构设计如下（file_status 表）：

id (主键，自增)
kb_type (枚举：personal / agent / local，标识属于哪个知识库)
file_path (文件唯一标识，本地文件为知识库的路径，笔记为笔记ID)
last_modified (文件最后修改时间，用于增量比对)
index_status (枚举：pending, success, failed)
last_indexed_at (最后一次成功向量化的时间)

## 知识库文件卡片右上角索引状态显示
在知识库文件卡片中，显示文件的RAG 处理状态，如果已经处理了则亮绿色，否则显示红色。



## RAG 向量化的知识如何存储
LangChain.js 封装了 faiss-node，并提供了文本分块、元数据存储等高级功能。用户可以使用 FAISS 依赖包npm install @langchain/community faiss-node 进行向量化的知识存储。FAISS 是一个用于高维向量检索的库，它支持在内存中进行快速的向量检索。支持对向量的增删改查等操作。FAISS 用于存储知识库中的向量表示和元数据。元数据包括当前片段对应的在知识库中的路径、文件名、文件类型、文件大小、文件创建时间、文件修改时间，对应的父块 docId（没有父块可以为空）。

## 需要建立几个FaissStore数据库
当前只需要建立三个数据库，分别对应个人知识库，Agent 知识库，本地知识库；每个数据库中存储该知识库中的所有文件的向量表示和元数据。RAG 的更新，为了简单起见，所有数据库不自动更新，用户需要手动触发更新。当用户设置中点击“知识库检索更新”按钮时，“更新逻辑采取‘内存重建覆盖’策略。比对状态库找出变更文件后，将该知识库中未发生改变的文件对应的向量加载到内存，加上修改后文件重新生成的向量，在内存中构建一个全新的 FaissStore，然后覆盖写入磁盘。这样彻底避免了在原索引上执行删除操作导致的文件膨胀和碎片化问题。”

## 文件加载
LangChain 实现了很多用于加载不同类型文档的加载器，用户可以根据自己的需求选择合适的加载器进行文件加载。用户可以使用 LangChain 提供的加载器进行文件加载。对于非文本的 PDF,可以使用支持 OCR 的加载器进行文件加载。


## 文本分块
如果是笔记文档，则采取结构感知分块策略。如果是其他文档则采取思路是父子分块（Small-to-Big），用小块做向量检索（精准命中），但召回后用其所属的大块喂给 LLM（上下文完整）。在 LangChain.js 中可用 MultiVectorRetriever 实现：子块存入 FaissStore，父块存入 docstore，子块 metadata 里记录 docId 指回父块
// 伪代码思路
const parentSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 2000, chunkOverlap: 200 });
const childSplitter  = new RecursiveCharacterTextSplitter({ chunkSize: 400,  chunkOverlap: 50 });

const parentDocs = await parentSplitter.splitDocuments(rawDocs);
for (const parent of parentDocs) {
  const parentId = uuid();
  const children = await childSplitter.splitDocuments([parent]);
  // 子块 metadata 注入 docId 指向父块
  children.forEach(c => c.metadata = { ...c.metadata, docId: parentId });
  // 子块入 FaissStore，父块入 docstore
}
检索时命中的是子块，通过 docId 取回父块作为最终上下文.


在 LangChain.js 中，你可以实现 BaseStore 接口，将父块存入 SQLite、本地 JSON 文件或 LevelDB 中。每次应用启动时，从本地加载这些父块数据到内存中供 MultiVectorRetriever 使用。具体的表结构需要具有一定的扩展性与灵活性，能够支持未来可能的其他功能需求。比如，需要存储父块的元数据，建议表结构（SQLite parent_docs 表）：

uuid (主键，字符串，对应子块 metadata 中的 docId)
doc_id (逻辑文档ID，多个父块可以属于同一个原始文件)
content (文本，父块的完整大段文本)
source_path (来源文件的知识库路径)
file_type (文件类型)
file_size (文件大小)
file_created_at (文件创建时间)
file_modified_at (文件修改时间)
extra_metadata (JSON 字符串，用于未来扩展存放其他非结构化元数据，如作者、标签等)

## 注意事项
1. 本项目中的笔记不是存储在本地文件系统中的，而是存储在数据库中的。这个需要单独处理一下，将其转为 markdown 格式的文档再进行切片与向量化存储。
2. 本项目中的知识库中的非笔记文档存储在本地文件系统中，需要根据对应的格式使用对应的加载器进行文件加载。如果 PDF 是复杂的无法文本提取的，需要使用支持 OCR 的加载器进行文件加载。
3. 本项目中的知识库中的文件在每日应用启动时进行一次更新，对于已经发生修改或者新增的文件，异步进行切片与向量化存储。
