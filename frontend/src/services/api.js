/**
 * API 服务模块
 * 统一管理所有后端接口调用
 */

// API 基础配置
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
const DEFAULT_TIMEOUT = 30000; // 30秒

// 调试日志
console.log('[API] API_BASE_URL:', API_BASE_URL);

/**
 * 通用请求封装
 * @param {string} endpoint - API端点
 * @param {object} options - 请求选项
 * @returns {Promise} 返回响应数据
 */
async function request(endpoint, options = {}) {
  const {
    method = 'GET',
    headers = {},
    body = null,
    timeout = DEFAULT_TIMEOUT,
    signal: customSignal,
  } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  // 合并信号
  const signal = customSignal || controller.signal;

  const config = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    signal,
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const fullUrl = `${API_BASE_URL}${endpoint}`;
  console.log(`[API] ${method} ${fullUrl}`, body ? { body } : '');

  try {
    const response = await fetch(fullUrl, config);
    clearTimeout(timeoutId);

    // 先尝试解析 JSON
    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      // 如果不是 JSON 响应
      const text = await response.text();
      console.error('[API] Non-JSON response:', text);
      throw new Error('服务器返回了非 JSON 格式的响应');
    }

    console.log('[API] Response:', response.status, data);

    if (!response.ok) {
      // 后端返回格式: { success: false, message: '错误信息', code: 400 }
      throw new Error(data.message || data.error || '请求失败');
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('[API] Request failed:', error);
    if (error.name === 'AbortError') {
      throw new Error('请求超时');
    }
    throw error;
  }
}

// ==================== 聊天相关接口 ====================

/**
 * 发送聊天消息
 * @param {string} riderId - 骑手ID
 * @param {string} message - 消息内容
 * @param {string} sessionId - 会话ID (可选)
 * @returns {Promise} 返回AI回复
 */
export async function sendChatMessage(riderId, message, sessionId) {
  return request('/chat', {
    method: 'POST',
    body: {
      riderId,
      message,
      sessionId,
    },
  });
}

/**
 * 获取会话历史
 * @param {string} sessionId - 会话ID
 * @returns {Promise} 返回会话历史消息
 */
export async function getSessionHistory(sessionId) {
  return request(`/session/${sessionId}`);
}

// ==================== 知识库相关接口 ====================

/**
 * 初始化知识库
 * @param {string} collectionName - 集合名称 (可选)
 * @returns {Promise} 返回初始化结果
 */
export async function initKnowledgeBase(collectionName = 'rider_knowledge_base') {
  return request('/knowledge/init', {
    method: 'POST',
    body: { collectionName },
  });
}

/**
 * 添加文档到知识库
 * @param {Array} documents - 文档数组
 * @returns {Promise} 返回添加结果
 */
export async function addDocuments(documents) {
  return request('/knowledge/documents', {
    method: 'POST',
    body: { documents },
  });
}

/**
 * 搜索知识库
 * @param {string} query - 搜索查询
 * @param {number} topK - 返回结果数量 (可选)
 * @param {object} filter - 过滤条件 (可选)
 * @returns {Promise} 返回搜索结果
 */
export async function searchKnowledge(query, topK = 3, filter) {
  return request('/knowledge/search', {
    method: 'POST',
    body: { query, topK, filter },
  });
}

/**
 * 更新知识库文档
 * @param {Array} documents - 文档数组
 * @returns {Promise} 返回更新结果
 */
export async function updateDocuments(documents) {
  return request('/knowledge/documents', {
    method: 'PUT',
    body: { documents },
  });
}

/**
 * 删除知识库文档
 * @param {Array} documentIds - 文档ID数组
 * @returns {Promise} 返回删除结果
 */
export async function deleteDocuments(documentIds) {
  return request('/knowledge/documents', {
    method: 'DELETE',
    body: { documentIds },
  });
}

/**
 * 获取知识库统计信息
 * @returns {Promise} 返回统计信息
 */
export async function getKnowledgeStats() {
  return request('/knowledge/stats');
}

/**
 * 清空知识库
 * @returns {Promise} 返回清空结果
 */
export async function clearKnowledge() {
  return request('/knowledge/clear', {
    method: 'DELETE',
  });
}

// ==================== 反馈相关接口 ====================

/**
 * 提交用户反馈
 * @param {number} messageId - 消息ID
 * @param {number} rating - 评分 (1-5)
 * @returns {Promise} 返回提交结果
 */
export async function submitFeedback(messageId, rating) {
  return request('/feedback', {
    method: 'POST',
    body: { messageId, rating },
  });
}

/**
 * 获取消息的反馈
 * @param {number} messageId - 消息ID
 * @returns {Promise} 返回反馈信息
 */
export async function getFeedbackByMessage(messageId) {
  return request(`/feedback/message/${messageId}`);
}

/**
 * 获取反馈列表
 * @param {object} params - 查询参数
 * @returns {Promise} 返回反馈列表
 */
export async function getFeedbackList(params = {}) {
  const { page = 1, limit = 20, minRating, maxRating } = params;
  const queryParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  if (minRating) queryParams.append('minRating', String(minRating));
  if (maxRating) queryParams.append('maxRating', String(maxRating));

  return request(`/feedback/list?${queryParams}`);
}

/**
 * 获取反馈统计信息
 * @returns {Promise} 返回统计信息
 */
export async function getFeedbackStats() {
  return request('/feedback/stats');
}

// ==================== 文档管理相关接口 ====================

/**
 * 上传文档
 * @param {File} file - 文件对象
 * @param {object} metadata - 文档元数据
 * @returns {Promise} 返回上传结果
 */
export async function uploadDocument(file, metadata = {}) {
  const formData = new FormData();
  formData.append('file', file);

  if (metadata.title) formData.append('title', metadata.title);
  if (metadata.category) formData.append('category', metadata.category);
  if (metadata.uploadedBy) formData.append('uploadedBy', metadata.uploadedBy);

  const response = await fetch(`${API_BASE_URL}/documents/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || '上传失败');
  }

  return response.json();
}

/**
 * 获取文档列表
 * @param {object} params - 查询参数
 * @returns {Promise} 返回文档列表
 */
export async function getDocumentList(params = {}) {
  const { page = 1, limit = 20, status, category } = params;
  const queryParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  if (status) queryParams.append('status', status);
  if (category) queryParams.append('category', category);

  return request(`/documents?${queryParams}`);
}

/**
 * 获取文档详情
 * @param {string} docId - 文档ID
 * @returns {Promise} 返回文档详情
 */
export async function getDocumentDetail(docId) {
  return request(`/documents/${docId}`);
}

/**
 * 获取文档分块列表
 * @param {string} docId - 文档ID
 * @returns {Promise} 返回文档分块
 */
export async function getDocumentChunks(docId) {
  return request(`/documents/${docId}/chunks`);
}

/**
 * 获取文档处理状态
 * @param {string} docId - 文档ID
 * @returns {Promise} 返回文档状态
 */
export async function getDocumentStatus(docId) {
  return request(`/documents/${docId}/status`);
}

/**
 * 删除文档
 * @param {string} docId - 文档ID
 * @returns {Promise} 返回删除结果
 */
export async function deleteDocument(docId) {
  return request(`/documents/${docId}`, {
    method: 'DELETE',
  });
}

/**
 * 搜索文档 (向量搜索)
 * @param {string} query - 搜索查询
 * @param {number} topK - 返回结果数量 (可选)
 * @param {string} category - 分类过滤 (可选)
 * @returns {Promise} 返回搜索结果
 */
export async function searchDocuments(query, topK = 5, category) {
  return request('/documents/search', {
    method: 'POST',
    body: { query, topK, category },
  });
}

// ==================== 健康检查接口 ====================

/**
 * 健康检查
 * @returns {Promise} 返回健康状态
 */
export async function healthCheck() {
  return request('/');
}

// ==================== 导出默认对象 ====================

const api = {
  // 聊天
  sendChatMessage,
  getSessionHistory,

  // 知识库
  initKnowledgeBase,
  addDocuments,
  searchKnowledge,
  updateDocuments,
  deleteDocuments,
  getKnowledgeStats,
  clearKnowledge,

  // 反馈
  submitFeedback,
  getFeedbackByMessage,
  getFeedbackList,
  getFeedbackStats,

  // 文档
  uploadDocument,
  getDocumentList,
  getDocumentDetail,
  getDocumentChunks,
  getDocumentStatus,
  deleteDocument,
  searchDocuments,

  // 其他
  healthCheck,
};

export default api;
