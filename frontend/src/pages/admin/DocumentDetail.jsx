import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DeleteOutlined } from '@ant-design/icons';
import { getDocumentDetail, getDocumentChunks, deleteDocument } from '../../services/api';
import './KnowledgeDetail.css';

export default function DocumentDetail() {
  const navigate = useNavigate();
  const { docId } = useParams();
  const [document, setDocument] = useState(null);
  const [chunks, setChunks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chunksLoading, setChunksLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadDocument();
  }, [docId]);

  const loadDocument = async () => {
    setLoading(true);
    try {
      const data = await getDocumentDetail(docId);
      if (data.data) {
        setDocument(data.data);
      }
    } catch (error) {
      console.error('加载文档详情失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadChunks = async () => {
    if (chunks.length > 0) return; // 已加载

    setChunksLoading(true);
    try {
      const data = await getDocumentChunks(docId);
      if (data.data) {
        setChunks(data.data.chunks || []);
      }
    } catch (error) {
      console.error('加载文档分块失败:', error);
    } finally {
      setChunksLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('确定要删除这个文档吗？删除后无法恢复。')) return;

    setDeleting(true);
    try {
      await deleteDocument(docId);
      navigate('/admin/knowledge');
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败，请稍后重试');
    } finally {
      setDeleting(false);
    }
  };

  const handleBack = () => {
    navigate('/admin/knowledge');
  };

  // 获取状态名称
  const getStatusName = (status) => {
    const statusMap = {
      'pending': '等待处理',
      'processing': '处理中',
      'completed': '已完成',
      'failed': '处理失败',
    };
    return statusMap[status] || status;
  };

  // 获取状态颜色
  const getStatusColor = (status) => {
    const colorMap = {
      'pending': '#ffa726',
      'processing': '#42a5f5',
      'completed': '#66bb6a',
      'failed': '#ef5350',
    };
    return colorMap[status] || '#999';
  };

  // 格式化文件大小
  const formatFileSize = (bytes) => {
    if (!bytes) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (loading) {
    return (
      <div className="detail-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="detail-container">
        <div className="error-state">
          <div className="error-icon">😕</div>
          <h3>文档不存在</h3>
          <button className="back-btn" onClick={handleBack}>返回列表</button>
        </div>
      </div>
    );
  }

  return (
    <div className="detail-container">
      {/* 页面标题和操作 */}
      <div className="detail-header">
        <h1>文档详情</h1>
        <div className="header-actions">
          <button
            className="action-btn secondary-btn"
            onClick={handleBack}
          >
            返回列表
          </button>
          <button
            className="action-btn delete-btn"
            onClick={handleDelete}
            disabled={deleting}
          >
            <DeleteOutlined />
            {deleting ? '删除中...' : '删除'}
          </button>
        </div>
      </div>

      {/* 详情内容 */}
      <div className="detail-content">
        {/* 基本信息卡片 */}
        <div className="info-card">
          <div className="info-card-header">
            <h2>基本信息</h2>
            <span
              className="status-badge"
              style={{ '--status-color': getStatusColor(document.status) }}
            >
              {getStatusName(document.status)}
            </span>
          </div>

          <div className="info-item">
            <span className="info-label">文档标题</span>
            <span className="info-value">{document.title}</span>
          </div>

          <div className="info-item">
            <span className="info-label">文件名</span>
            <span className="info-value">{document.file_name}</span>
          </div>

          <div className="info-item">
            <span className="info-label">文件类型</span>
            <span className="info-value">{document.file_type}</span>
          </div>

          <div className="info-item">
            <span className="info-label">文件大小</span>
            <span className="info-value">{formatFileSize(document.file_size)}</span>
          </div>

          <div className="info-item">
            <span className="info-label">分类</span>
            <span className="info-value">{document.category || '未分类'}</span>
          </div>

          <div className="info-item">
            <span className="info-label">分块数量</span>
            <span className="info-value">{document.chunk_count || 0}</span>
          </div>

          <div className="info-item">
            <span className="info-label">上传者</span>
            <span className="info-value">{document.uploaded_by || '未知'}</span>
          </div>

          <div className="info-item">
            <span className="info-label">创建时间</span>
            <span className="info-value">
              {new Date(document.created_at).toLocaleString('zh-CN')}
            </span>
          </div>

          <div className="info-item">
            <span className="info-label">更新时间</span>
            <span className="info-value">
              {new Date(document.updated_at).toLocaleString('zh-CN')}
            </span>
          </div>

          {document.error_message && (
            <div className="info-item">
              <span className="info-label">错误信息</span>
              <span className="info-value error-text">{document.error_message}</span>
            </div>
          )}
        </div>

        {/* 文档分块卡片 */}
        {document.status === 'completed' && (
          <div className="content-card">
            <div className="card-header">
              <h2 className="card-title">文档分块</h2>
              {chunks.length === 0 && !chunksLoading && (
                <button
                  className="secondary-btn"
                  onClick={loadChunks}
                  disabled={chunksLoading}
                >
                  {chunksLoading ? '加载中...' : '加载分块'}
                </button>
              )}
            </div>

            {chunksLoading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>加载分块中...</p>
              </div>
            ) : chunks.length > 0 ? (
              <div className="chunks-list">
                {chunks.map((chunk, index) => (
                  <div key={chunk.chunk_id} className="chunk-item">
                    <div className="chunk-header">
                      <span className="chunk-index">#{chunk.chunk_index + 1}</span>
                      {chunk.chroma_id && (
                        <span className="chroma-id">向量ID: {chunk.chroma_id.slice(0, 12)}...</span>
                      )}
                    </div>
                    <div className="chunk-content">
                      {chunk.content}
                    </div>
                    {chunk.metadata && (
                      <div className="chunk-metadata">
                        <small>元数据: {JSON.stringify(chunk.metadata)}</small>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>点击上方按钮加载文档分块</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
