# RAG功能快速测试

## 🚀 快速开始

### 1. 启动ChromaDB服务器

```bash
# 使用Docker (最简单)
docker run -d -p 8000:8000 chromadb/chroma

# 或使用Python
pip install chromadb
chroma-server --port 8000
```

验证启动:
```bash
curl http://localhost:8000/api/v1/heartbeat
# 应该返回: {"status":"ok"}
```

### 2. 启动后端服务

```bash
cd backend
npm run dev
```

### 3. 运行测试

```bash
node test-rag.js
```

---

## 📝 手动测试

### 初始化知识库

```bash
curl -X POST http://localhost:3000/api/v1/knowledge/init \
  -H "Content-Type: application/json"
```

### 添加单个文档

```bash
curl -X POST http://localhost:3000/api/v1/knowledge/documents \
  -H "Content-Type: application/json" \
  -d '{
    "documents": [
      {
        "id": "test001",
        "text": "配送超时规则:午高峰(11:00-13:00)和晚高峰(17:00-19:00)期间,配送时间不得超过45分钟",
        "metadata": {"category": "配送规则", "priority": 1}
      }
    ]
  }'
```

### 搜索测试

```bash
curl -X POST http://localhost:3000/api/v1/knowledge/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "超时多长时间算违规?",
    "topK": 2
  }'
```

### 查看统计

```bash
curl http://localhost:3000/api/v1/knowledge/stats
```

---

## ⚡ 快速验证

### 最简测试

```bash
# 一键测试完整流程
node test-rag.js

# 预期输出:
# ✅ 初始化成功
# ✅ 文档添加成功
# ✅ 搜索成功
```

---

## 🐛 故障排查

### 问题1: 连接ChromaDB失败

```
Error: connect ECONNREFUSED
```

**解决**:
```bash
# 检查ChromaDB是否运行
curl http://localhost:8000/api/v1/heartbeat

# 如果未运行,启动ChromaDB
docker run -d -p 8000:8000 chromadb/chroma
```

### 问题2: 嵌入向量生成失败

```
Error: 嵌入向量生成失败
```

**解决**:
```bash
# 检查API Key配置
echo $ZHIPU_API_KEY

# 检查.env文件
cat backend/.env | grep ZHIPU
```

### 问题3: 端口被占用

```
Error: listen EADDRINUSE :3000
```

**解决**:
```bash
# 停止其他服务
# Windows
taskkill /F /IM node.exe

# Linux/Mac
killall node
```

---

## ✅ 验证清单

- [ ] ChromaDB服务器运行中 (端口8000)
- [ ] 后端服务运行中 (端口3000)
- [ ] 智谱AI API Key已配置
- [ ] 测试脚本运行成功
- [ ] 搜索返回相关结果

---

**测试时间**: < 5分钟
**难度**: ⭐☆☆☆☆
