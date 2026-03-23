# ChromaDB (JavaScript/TypeScript) 使用指南

## 一、ChromaDB 简介

### 1.1 什么是 ChromaDB

**ChromaDB** 是一个开源的向量数据库,专门用于存储和检索嵌入向量(embeddings)。它是构建 AI 应用的理想选择,特别适合:

- 🔍 **语义搜索** - 基于含义而非关键词的搜索
- 📚 **知识库检索** - RAG(检索增强生成)系统的核心
- 🤖 **推荐系统** - 基于相似度的推荐
- 📊 **文档聚类** - 相似文档分组

### 1.2 为什么选择 ChromaDB

| 特性 | ChromaDB | 其他向量库 |
|-----|----------|-----------|
| 易用性 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| 性能 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 本地运行 | ✅ 支持 | ❌ 通常需要云服务 |
| JavaScript支持 | ✅ 原生支持 | ⚠️ 部分支持 |
| 免费开源 | ✅ 完全免费 | ⚠️ 部分收费 |
| 学习曲线 | 平缓 | 陡峭 |

### 1.3 技术特点

- ✅ **零配置启动** - 无需复杂设置
- ✅ **多种嵌入模型** - 支持OpenAI、Cohere、HuggingFace等
- ✅ **灵活的过滤** - 元数据过滤查询
- ✅ **持久化存储** - 数据持久化到磁盘
- ✅ **TypeScript支持** - 完整的类型定义
- ✅ **轻量级** - 资源占用小

---

## 二、安装与配置

### 2.1 环境要求

```bash
Node.js >= 18.0.0
TypeScript >= 4.9.0 (可选)
```

### 2.2 安装 ChromaDB

```bash
# 使用 npm
npm install chromadb

# 使用 yarn
yarn add chromadb

# 使用 pnpm
pnpm add chromadb
```

### 2.3 安装嵌入模型依赖

```bash
# OpenAI 嵌入(推荐)
npm install @chromadb/openai

# 或使用其他嵌入模型
npm install @chromadb/cohere       # Cohere
npm install @chromadb/huggingface  # HuggingFace
```

### 2.4 TypeScript 类型支持

```typescript
// chromadb 包含完整的 TypeScript 类型定义
import { ChromaClient, Collection } from 'chromadb';
```

---

## 三、快速开始

### 3.1 初始化客户端

```typescript
import { ChromaClient } from 'chromadb';

// 方式1: 本地内存数据库(数据不持久化)
const client = new ChromaClient();

// 方式2: 本地持久化数据库(推荐)
const client = new ChromaClient({
  path: "http://localhost:8000"  // 连接到本地 ChromaDB 服务器
});

// 方式3: 远程服务器
const client = new ChromaClient({
  path: "https://your-chromadb-server.com"
});
```

### 3.2 第一个示例

```typescript
import { ChromaClient } from 'chromadb';

async function quickStart() {
  // 1. 创建客户端
  const client = new ChromaClient();

  // 2. 创建集合(Collection)
  const collection = await client.createCollection({
    name: "my_first_collection",
    metadata: { "description": "我的第一个集合" }
  });

  // 3. 添加文档
  await collection.add({
    ids: ["doc1", "doc2", "doc3"],
    documents: [
      "外卖骑手需要遵守交通规则",
      "配送超时可能会被罚款",
      "申诉罚单需要提供证据"
    ],
    metadatas: [
      { "category": "规则", "priority": 1 },
      { "category": "罚单", "priority": 2 },
      { "category": "申诉", "priority": 3 }
    ]
  });

  // 4. 查询相似文档
  const results = await collection.query({
    queryTexts: ["配送超时怎么办"],
    nResults: 2
  });

  console.log(results);
}

quickStart();
```

---

## 四、核心概念

### 4.1 Collection (集合)

**Collection** 是 ChromaDB 中的核心概念,类似于关系数据库中的表。

```typescript
interface Collection {
  name: string;           // 集合名称(唯一)
  metadata?: object;      // 元数据(可选)
  embeddings?: number[][]; // 向量(可选,会自动生成)
  documents?: string[];   // 文本内容
  ids?: string[];         // 唯一标识
  metadatas?: object[];   // 元数据数组
}
```

### 4.2 Embeddings (嵌入)

**Embeddings** 是文本的数值化表示,用于计算相似度。

```typescript
// 文本 → 向量
"配送超时怎么办" → [0.1, -0.2, 0.5, ..., 0.3]  // 1536维向量(OpenAI)
```

### 4.3 Metadata (元数据)

**Metadata** 是文档的附加信息,用于过滤和分类。

```typescript
{
  "category": "罚单",
  "priority": 2,
  "date": "2026-03-22",
  "author": "客服小骑"
}
```

---

## 五、详细操作指南

### 5.1 集合管理

#### 创建集合

```typescript
// 基础创建
const collection = await client.createCollection({
  name: "rider_docs"
});

// 带元数据创建
const collection = await client.createCollection({
  name: "rider_docs",
  metadata: {
    description: "骑手知识库",
    version: "1.0",
    created_at: "2026-03-22"
  }
});

// 使用自定义嵌入函数
const { OpenAIEmbeddingFunction } = require('@chromadb/openai');
const embedder = new OpenAIEmbeddingFunction({
  apiKey: process.env.OPENAI_API_KEY
});

const collection = await client.createCollection({
  name: "rider_docs",
  embeddingFunction: embedder
});
```

#### 获取或创建集合

```typescript
// 如果集合不存在则创建
const collection = await client.getOrCreateCollection({
  name: "rider_docs"
});
```

#### 列出所有集合

```typescript
const collections = await client.listCollections();
console.log(collections);
// [{ name: "rider_docs", ... }, { name: "faq", ... }]
```

#### 删除集合

```typescript
await client.deleteCollection({
  name: "rider_docs"
});
```

#### 获取集合信息

```typescript
const collection = await client.getCollection({
  name: "rider_docs"
});

const count = await collection.count();
console.log(`文档数量: ${count}`);
```

---

### 5.2 添加文档

#### 基础添加

```typescript
await collection.add({
  ids: ["doc1", "doc2", "doc3"],
  documents: [
    "配送超时可以申诉",
    "罚单申诉需要提供证据",
    "收入每周二结算"
  ]
});
```

#### 添加元数据

```typescript
await collection.add({
  ids: ["doc1", "doc2", "doc3"],
  documents: [
    "配送超时可以申诉",
    "罚单申诉需要提供证据",
    "收入每周二结算"
  ],
  metadatas: [
    { "category": "配送", "priority": 1 },
    { "category": "罚单", "priority": 2 },
    { "category": "收入", "priority": 3 }
  ]
});
```

#### 批量添加

```typescript
const documents = [];
const ids = [];
const metadatas = [];

for (let i = 0; i < 1000; i++) {
  ids.push(`doc_${i}`);
  documents.push(`文档内容 ${i}`);
  metadatas.push({ "index": i });
}

await collection.add({
  ids,
  documents,
  metadatas
});
```

#### 添加已有向量

```typescript
// 如果你已经有了嵌入向量,可以直接添加
await collection.add({
  ids: ["doc1"],
  embeddings: [[0.1, 0.2, 0.3, ...]], // 你的向量
  metadatas: [{ "source": "custom" }]
});
```

---

### 5.3 查询文档

#### 文本查询

```typescript
// 单个查询
const results = await collection.query({
  queryTexts: ["配送超时怎么办"],
  nResults: 3  // 返回前3个最相似的结果
});

console.log(results);
// {
//   ids: [['doc2', 'doc5', 'doc1']],
//   distances: [[0.123, 0.234, 0.345]],
//   metadatas: [[{...}, {...}, {...}]],
//   documents: [['罚单申诉...', '配送说明...', '规则介绍...']]
// }
```

#### 多个查询

```typescript
const results = await collection.query({
  queryTexts: [
    "配送超时怎么办",
    "如何查询收入"
  ],
  nResults: 2
});
```

#### 向量查询

```typescript
// 使用已有向量查询
const queryVector = [0.1, 0.2, 0.3, ...]; // 你的查询向量

const results = await collection.query({
  queryEmbeddings: [queryVector],
  nResults: 5
});
```

#### 过滤查询

```typescript
// 元数据过滤
const results = await collection.query({
  queryTexts: ["配送"],
  nResults: 5,
  where: {
    "category": "配送"  // 只返回 category 为 "配送" 的文档
  }
});

// 复杂过滤
const results = await collection.query({
  queryTexts: ["配送"],
  nResults: 5,
  where: {
    "priority": { "$gte": 2 }  // priority >= 2
  }
});

// 多条件过滤
const results = await collection.query({
  queryTexts: ["配送"],
  nResults: 5,
  where: {
    "$and": [
      { "category": "配送" },
      { "priority": { "$gte": 1 } }
    ]
  }
});
```

#### 过滤操作符

```typescript
// 比较操作符
{ "priority": { "$eq": 1 } }      // 等于
{ "priority": { "$ne": 1 } }      // 不等于
{ "priority": { "$gt": 1 } }      // 大于
{ "priority": { "$gte": 1 } }     // 大于等于
{ "priority": { "$lt": 1 } }      // 小于
{ "priority": { "$lte": 1 } }     // 小于等于

// 逻辑操作符
{ "$and": [...] }    // 且
{ "$or": [...] }     // 或
{ "$not": {...} }    // 非
```

---

### 5.4 更新文档

```typescript
// 更新文档内容
await collection.update({
  ids: ["doc1"],
  documents: ["更新后的文档内容"]
});

// 更新元数据
await collection.update({
  ids: ["doc1"],
  metadatas: [{ "category": "新分类", "updated": true }]
});

// 同时更新多个字段
await collection.update({
  ids: ["doc1"],
  documents: ["更新后的内容"],
  metadatas: [{ "category": "新分类" }]
});
```

---

### 5.5 删除文档

```typescript
// 删除指定文档
await collection.delete({
  ids: ["doc1", "doc2", "doc3"]
});

// 删除符合条件的文档
await collection.delete({
  where: {
    "category": "旧分类"
  }
});
```

---

### 5.6 获取文档

```typescript
// 通过ID获取
const results = await collection.get({
  ids: ["doc1", "doc2"]
});

// 获取所有文档
const results = await collection.get();

// 获取并包含文档内容
const results = await collection.get({
  include: ["documents", "metadatas", "embeddings"]
});

// 条件获取
const results = await collection.get({
  where: {
    "category": "配送"
  },
  limit: 10
});
```

---

## 六、嵌入函数

### 6.1 OpenAI 嵌入(推荐)

```typescript
import { OpenAIEmbeddingFunction } from '@chromadb/openai';

const embedder = new OpenAIEmbeddingFunction({
  apiKey: process.env.OPENAI_API_KEY,
  model: "text-embedding-3-small"  // 或 "text-embedding-3-large"
});

const collection = await client.createCollection({
  name: "my_collection",
  embeddingFunction: embedder
});

// 添加文档时会自动生成嵌入向量
await collection.add({
  ids: ["doc1"],
  documents: ["需要嵌入的文本"]
});
```

### 6.2 自定义嵌入函数

```typescript
import { EmbeddingFunction } from 'chromadb';

class CustomEmbeddingFunction extends EmbeddingFunction {
  constructor() {
    super();
  }

  async generate(texts: string[]) {
    // 这里使用你自己的嵌入模型
    // 例如: 智谱AI、本地模型等
    const embeddings = [];

    for (const text of texts) {
      // 调用你的嵌入API
      const embedding = await this.callYourEmbeddingAPI(text);
      embeddings.push(embedding);
    }

    return embeddings;
  }
}

const embedder = new CustomEmbeddingFunction();

const collection = await client.createCollection({
  name: "my_collection",
  embeddingFunction: embedder
});
```

### 6.3 智谱AI嵌入示例

```typescript
import { EmbeddingFunction } from 'chromadb';
import axios from 'axios';

class ZhipuEmbeddingFunction extends EmbeddingFunction {
  private apiKey: string;
  private apiUrl: string;

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
    this.apiUrl = 'https://open.bigmodel.cn/api/paas/v4/embeddings';
  }

  async generate(texts: string[]) {
    const embeddings = [];

    for (const text of texts) {
      const response = await axios.post(
        this.apiUrl,
        {
          model: 'embedding-2',
          input: text
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      embeddings.push(response.data.data[0].embedding);
    }

    return embeddings;
  }
}

// 使用
const embedder = new ZhipuEmbeddingFunction(process.env.ZHIPU_API_KEY);

const collection = await client.createCollection({
  name: "rider_docs",
  embeddingFunction: embedder
});
```

---

## 七、实战示例

### 7.1 外卖骑手知识库

```typescript
import { ChromaClient } from 'chromadb';
import { ZhipuEmbeddingFunction } from './embeddings';

class RiderKnowledgeBase {
  private client: ChromaClient;
  private collection: any;
  private embedder: ZhipuEmbeddingFunction;

  constructor() {
    // 初始化客户端
    this.client = new ChromaClient({
      path: "http://localhost:8000"
    });

    // 初始化嵌入函数
    this.embedder = new ZhipuEmbeddingFunction(
      process.env.ZHIPU_API_KEY
    );
  }

  async init() {
    // 获取或创建集合
    this.collection = await this.client.getOrCreateCollection({
      name: "rider_knowledge_base",
      embeddingFunction: this.embedder,
      metadata: {
        description: "外卖骑手知识库",
        created_at: new Date().toISOString()
      }
    });
  }

  // 添加文档
  async addDocuments(docs: Array<{
    id: string;
    text: string;
    category: string;
    priority?: number;
  }>) {
    const ids = docs.map(doc => doc.id);
    const documents = docs.map(doc => doc.text);
    const metadatas = docs.map(doc => ({
      category: doc.category,
      priority: doc.priority || 1,
      created_at: new Date().toISOString()
    }));

    await this.collection.add({
      ids,
      documents,
      metadatas
    });

    console.log(`✅ 已添加 ${docs.length} 个文档`);
  }

  // 搜索相关知识
  async search(query: string, topK: number = 3) {
    const results = await this.collection.query({
      queryTexts: [query],
      nResults: topK
    });

    return {
      documents: results.documents[0],
      metadatas: results.metadatas[0],
      distances: results.distances[0]
    };
  }

  // 按类别搜索
  async searchByCategory(
    query: string,
    category: string,
    topK: number = 3
  ) {
    const results = await this.collection.query({
      queryTexts: [query],
      nResults: topK,
      where: {
        "category": category
      }
    });

    return {
      documents: results.documents[0],
      metadatas: results.metadatas[0],
      distances: results.distances[0]
    };
  }

  // 获取统计信息
  async getStats() {
    const count = await this.collection.count();
    return {
      totalDocuments: count,
      collectionName: "rider_knowledge_base"
    };
  }
}

// 使用示例
async function main() {
  const kb = new RiderKnowledgeBase();
  await kb.init();

  // 添加文档
  await kb.addDocuments([
    {
      id: "rule_001",
      text: "配送超时时间:午高峰(11:00-13:00)和晚高峰(17:00-19:00)超过30分钟视为超时",
      category: "配送规则",
      priority: 1
    },
    {
      id: "penalty_001",
      text: "超时罚款标准:每次超时扣款10元,累计3次超时扣款50元",
      category: "罚单规则",
      priority: 2
    },
    {
      id: "appeal_001",
      text: "罚单申诉流程:1.打开APP 2.进入'我的' 3.选择'罚单申诉' 4.上传证据 5.提交审核",
      category: "申诉流程",
      priority: 3
    }
  ]);

  // 搜索
  const results = await kb.search("配送超时会罚款吗?");
  console.log('搜索结果:', results);

  // 按类别搜索
  const categoryResults = await kb.searchByCategory(
    "超时",
    "配送规则"
  );
  console.log('分类搜索结果:', categoryResults);

  // 统计信息
  const stats = await kb.getStats();
  console.log('统计信息:', stats);
}

main();
```

---

## 八、高级功能

### 8.1 持久化配置

```typescript
// ChromaDB 服务器模式(推荐生产环境)
// 先启动 ChromaDB 服务器:
// chroma-server --host localhost --port 8000 --persist-directory ./chroma_db

const client = new ChromaClient({
  path: "http://localhost:8000"
});
```

### 8.2 性能优化

```typescript
// 批量操作
const BATCH_SIZE = 100;

async function batchAdd(documents: string[]) {
  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch = documents.slice(i, i + BATCH_SIZE);
    const ids = batch.map((_, idx) => `doc_${i + idx}`);

    await collection.add({
      ids,
      documents: batch
    });
  }
}

// 并行查询
async function parallelSearch(queries: string[]) {
  const promises = queries.map(query =>
    collection.query({
      queryTexts: [query],
      nResults: 3
    })
  );

  const results = await Promise.all(promises);
  return results;
}
```

### 8.3 错误处理

```typescript
async function safeSearch(collection: any, query: string) {
  try {
    const results = await collection.query({
      queryTexts: [query],
      nResults: 3
    });

    return {
      success: true,
      data: results
    };
  } catch (error) {
    if (error.message.includes('collection not found')) {
      return {
        success: false,
        error: '集合不存在'
      };
    } else if (error.message.includes('invalid embedding')) {
      return {
        success: false,
        error: '嵌入向量无效'
      };
    } else {
      return {
        success: false,
        error: error.message
      };
    }
  }
}
```

---

## 九、最佳实践

### 9.1 文档预处理

```typescript
// 文本分块
function chunkText(text: string, chunkSize: number = 500) {
  const chunks = [];
  const sentences = text.split('。');

  let currentChunk = '';
  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > chunkSize) {
      chunks.push(currentChunk);
      currentChunk = sentence;
    } else {
      currentChunk += sentence + '。';
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

// 清洗文本
function cleanText(text: string) {
  return text
    .replace(/\s+/g, ' ')     // 多个空格替换为单个
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s,.!?;:()""''']/g, '') // 移除特殊字符
    .trim();
}
```

### 9.2 元数据设计

```typescript
// 推荐的元数据结构
interface DocumentMetadata {
  // 分类信息
  category: string;        // 主分类
  subcategory?: string;     // 子分类
  tags?: string[];          // 标签

  // 质量信息
  priority?: number;        // 优先级
  quality?: number;         // 质量分数(0-1)

  // 时间信息
  created_at?: string;      // 创建时间
  updated_at?: string;      // 更新时间

  // 来源信息
  source?: string;          // 文档来源
  author?: string;          // 作者

  // 状态信息
  status?: 'active' | 'archived' | 'deleted';
}
```

### 9.3 查询优化

```typescript
// 使用阈值过滤相似度
async function searchWithThreshold(
  query: string,
  threshold: number = 0.7
) {
  const results = await collection.query({
    queryTexts: [query],
    nResults: 10
  });

  // 过滤掉相似度低于阈值的结果
  const filtered = results.documents[0].filter((_, idx) => {
    const distance = results.distances[0][idx];
    return distance < (1 - threshold); // ChromaDB使用距离,越小越相似
  });

  return filtered;
}
```

---

## 十、常见问题

### Q1: ChromaDB 服务器如何启动?

```bash
# 安装 ChromaDB CLI
npm install -g chromadb

# 启动服务器
chroma-server --host localhost --port 8000 --persist-directory ./chroma_db

# 或使用 Docker
docker run -p 8000:8000 chromadb/chroma
```

### Q2: 如何处理大量文档?

```typescript
// 使用流式处理
async function streamAdd(filePath: string) {
  const stream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: stream,
    crlfDelay: Infinity
  });

  let batch = [];
  let count = 0;

  for await (const line of rl) {
    batch.push({
      id: `doc_${count++}`,
      text: line
    });

    if (batch.length >= 100) {
      await collection.add({
        ids: batch.map(d => d.id),
        documents: batch.map(d => d.text)
      });
      batch = [];
    }
  }

  if (batch.length > 0) {
    await collection.add({
      ids: batch.map(d => d.id),
      documents: batch.map(d => d.text)
    });
  }
}
```

### Q3: 如何更新嵌入模型?

```typescript
// 删除旧集合,使用新嵌入模型重新创建
await client.deleteCollection({ name: "old_collection" });

const newCollection = await client.createCollection({
  name: "new_collection",
  embeddingFunction: newEmbeddingFunction
});
```

### Q4: 内存占用过高怎么办?

```typescript
// 使用批量操作,避免一次性加载所有数据
// 定期清理不需要的数据
await collection.delete({
  where: {
    "status": "archived"
  }
});

// 使用 ChromaDB 服务器模式,而不是内存模式
```

---

## 十一、性能指标

### 11.1 基准测试

| 操作 | 数据量 | 耗时 |
|-----|-------|------|
| 添加文档 | 1,000 | ~5s |
| 查询 | 1个 | ~0.1s |
| 批量查询 | 10个 | ~0.5s |
| 更新文档 | 100 | ~2s |
| 删除文档 | 100 | ~1s |

### 11.2 优化建议

1. **批量操作**: 尽量使用批量添加/更新
2. **索引优化**: 合理设置元数据过滤
3. **服务器模式**: 生产环境使用服务器模式
4. **缓存策略**: 对频繁查询的结果进行缓存

---

## 十二、总结

### 12.1 核心要点

✅ **简单易用** - 几行代码即可上手
✅ **功能完善** - 支持增删改查、过滤、排序
✅ **性能优秀** - 毫秒级查询响应
✅ **灵活扩展** - 支持自定义嵌入函数
✅ **开源免费** - 完全开源,无限制使用

### 12.2 适用场景

- ✅ RAG知识库
- ✅ 语义搜索
- ✅ 推荐系统
- ✅ 文档聚类
- ✅ 相似度匹配

### 12.3 下一步

1. **集成到项目** - 在外卖骑手系统中实现知识库
2. **性能测试** - 在实际数据量下测试性能
3. **功能扩展** - 结合LangChain实现高级功能

---

## 参考资源

- [ChromaDB官方文档](https://docs.trychroma.com/)
- [ChromaDB GitHub](https://github.com/chroma-core/chroma)
- [JavaScript API文档](https://docs.trychroma.com/js/intro)
- [嵌入函数指南](https://docs.trychroma.com/embeddings/introduction)

---

**文档版本**: 1.0
**最后更新**: 2026-03-22
**维护者**: 开发团队
**状态**: ✅ 完整
