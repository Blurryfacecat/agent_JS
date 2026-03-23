# 骑手智能客服系统 - 数据库设计文档

## 概述

本文档定义了骑手智能客服系统的 SQLite 数据库表结构设计。

---

## 1. 会话表 (sessions)

存储用户会话信息。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 会话ID |
| session_id | VARCHAR(64) | UNIQUE NOT NULL | 会话唯一标识 |
| user_id | VARCHAR(64) | | 用户ID（可选，支持匿名） |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 更新时间 |

```sql
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id VARCHAR(64) UNIQUE NOT NULL,
  user_id VARCHAR(64),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_session_id ON sessions(session_id);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
```

---

## 2. 消息表 (messages)

存储用户与客服的对话消息。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 消息ID |
| session_id | VARCHAR(64) | NOT NULL | 关联会话ID |
| role | VARCHAR(20) | NOT NULL | 角色: user/assistant/system |
| content | TEXT | NOT NULL | 消息内容 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 发送时间 |
| FOREIGN KEY | | | session_id → sessions.session_id |

```sql
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id VARCHAR(64) NOT NULL,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

CREATE INDEX idx_messages_session_id ON messages(session_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
```

---

## 3. 知识库表 (knowledge)

存储知识库文档内容。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 文档ID |
| title | VARCHAR(255) | NOT NULL | 文档标题 |
| category | VARCHAR(100) | | 分类 |
| content | TEXT | NOT NULL | 文档内容 |
| source | VARCHAR(255) | | 来源 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 更新时间 |

```sql
CREATE TABLE IF NOT EXISTS knowledge (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  content TEXT NOT NULL,
  source VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_knowledge_category ON knowledge(category);
```

---

## 4. 用户反馈表 (feedback)

存储用户对回复的反馈。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 反馈ID |
| message_id | INTEGER | NOT NULL | 关联消息ID |
| rating | INTEGER | NOT NULL | 评分: 1-5 |
| comment | TEXT | | 评论内容 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 反馈时间 |
| FOREIGN KEY | | | message_id → messages.id |

```sql
CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL,
  rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);
```

---

## ER 图

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│  sessions   │1     *│  messages   │1     *│  feedback   │
│─────────────│───────│─────────────│───────│─────────────│
│ id          │       │ id          │       │ id          │
│ session_id  │       │ session_id  │       │ message_id  │
│ user_id     │       │ role        │       │ rating      │
│ created_at  │       │ content     │       │ comment     │
│ updated_at  │       │ created_at  │       │ created_at  │
└─────────────┘       └─────────────┘       └─────────────┘

┌─────────────┐
│ knowledge   │
│─────────────│
│ id          │
│ title       │
│ category    │
│ content     │
│ source      │
│ created_at  │
│ updated_at  │
└─────────────┘
```

---

## 初始化脚本

完整的数据表初始化脚本请参考 `/backend/src/db/init.sql`
