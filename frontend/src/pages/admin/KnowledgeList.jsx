import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadOutlined, EyeOutlined, ReloadOutlined, DeleteOutlined } from '@ant-design/icons';
import { Select } from 'antd';
import { getDocumentList, deleteDocument, uploadDocument } from '../../services/api';
import './KnowledgeList.css';

export default function KnowledgeList() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  // 分页和搜索状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  // 上传状态
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // 统计数据
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  });

  // 加载文档列表
  const loadDocuments = async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        limit: pageSize,
      };
      if (selectedStatus) params.status = selectedStatus;
      if (selectedCategory) params.category = selectedCategory;

      const data = await getDocumentList(params);

      if (data.data) {
        setDocuments(data.data.list || []);
        setTotal(data.data.total || 0);
        setTotalPages(data.data.totalPages || 1);

        // 计算统计
        const list = data.data.list || [];
        setStats({
          total: data.data.total || 0,
          pending: list.filter(d => d.status === 'pending').length,
          processing: list.filter(d => d.status === 'processing').length,
          completed: list.filter(d => d.status === 'completed').length,
          failed: list.filter(d => d.status === 'failed').length,
        });
      }
    } catch (error) {
      console.error('加载文档列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [currentPage, selectedStatus, selectedCategory]);

  // 删除文档
  const handleDelete = async (docId) => {
    if (!confirm('确定要删除这个文档吗？删除后无法恢复。')) return;

    setDeletingId(docId);
    try {
      await deleteDocument(docId);
      await loadDocuments();
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败，请稍后重试');
    } finally {
      setDeletingId(null);
    }
  };

  // 上传文档
  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 检查文件类型
    const allowedTypes = ['.pdf', '.txt', '.md'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowedTypes.includes(ext)) {
      alert('不支持的文件类型，请上传 PDF、TXT 或 MD 文件');
      return;
    }

    // 检查文件大小 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('文件大小不能超过 10MB');
      return;
    }

    // 获取标题和分类
    const title = prompt('请输入文档标题:', file.name.replace(/\.[^/.]+$/, ''));
    if (!title) return;

    const category = prompt('请输入文档分类（可选）:', '');

    setUploading(true);
    setUploadProgress(0);

    try {
      await uploadDocument(file, {
        title,
        category: category || undefined,
        uploadedBy: 'admin',
      });

      // 上传成功，刷新列表
      await loadDocuments();
      alert('文档上传成功，正在后台处理...');
    } catch (error) {
      console.error('上传失败:', error);
      alert('上传失败: ' + (error.message || '未知错误'));
    } finally {
      setUploading(false);
      setUploadProgress(0);
      e.target.value = ''; // 清空文件选择
    }
  };

  // 状态筛选处理
  const handleStatusChange = (status) => {
    setSelectedStatus(status);
    setCurrentPage(1);
  };

  // 分类筛选处理
  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    setCurrentPage(1);
  };

  // 分页处理
  const handlePageChange = (page) => {
    setCurrentPage(page);
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

  // 获取文件类型图标
  const getFileTypeIcon = (fileType) => {
    const iconMap = {
      'application/pdf': '📄',
      'text/plain': '📝',
      'text/markdown': '📋',
    };
    return iconMap[fileType] || '📁';
  };

  // 格式化文件大小
  const formatFileSize = (bytes) => {
    if (!bytes) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="knowledge-list-container">
      {/* 页面标题 */}
      <div className="kb-header">
        <h1>文档管理</h1>
        <div className="header-actions">
          <label className={`primary-btn ${uploading ? 'uploading' : ''}`}>
            <input
              type="file"
              accept=".pdf,.txt,.md"
              onChange={handleUpload}
              disabled={uploading}
              style={{ display: 'none' }}
            />
            {uploading ? (
              <>上传中... {uploadProgress}%</>
            ) : (
              <>
                <UploadOutlined />
                上传文档
              </>
            )}
          </label>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="stats-cards">
        <div className="stat-card">
          <div className="stat-icon">📚</div>
          <div className="stat-info">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">总文档数</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⏳</div>
          <div className="stat-info">
            <div className="stat-value">{stats.pending + stats.processing}</div>
            <div className="stat-label">处理中</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-info">
            <div className="stat-value">{stats.completed}</div>
            <div className="stat-label">已完成</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">❌</div>
          <div className="stat-info">
            <div className="stat-value">{stats.failed}</div>
            <div className="stat-label">失败</div>
          </div>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="filter-bar">
        <Select
          className="category-filter"
          value={selectedStatus || undefined}
          onChange={handleStatusChange}
          style={{ width: 120 }}
          placeholder="全部状态"
          options={[
            { value: 'pending', label: '等待处理' },
            { value: 'processing', label: '处理中' },
            { value: 'completed', label: '已完成' },
            { value: 'failed', label: '失败' },
          ]}
        />
        <Select
          className="category-filter"
          value={selectedCategory || undefined}
          onChange={handleCategoryChange}
          style={{ width: 120 }}
          placeholder="全部分类"
          options={[
            { value: 'faq', label: '常见问题' },
            { value: 'policy', label: '政策规定' },
            { value: 'training', label: '培训资料' },
            { value: 'other', label: '其他' },
          ]}
        />
      </div>

      {/* 文档列表 */}
      <div className="entries-container">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>加载中...</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📚</div>
            <h3>暂无文档</h3>
            <p>点击上方"上传文档"按钮上传第一个文档</p>
          </div>
        ) : (
          <>
            <div className="entries-list">
              {documents.map((doc) => (
                <div key={doc.doc_id} className="entry-card">
                  <div className="entry-header">
                    <div className="entry-title-row">
                      <div className="file-icon">
                        {getFileTypeIcon(doc.file_type)}
                      </div>
                      <div>
                        <h3 className="entry-title">{doc.title}</h3>
                        <p className="file-name">{doc.file_name}</p>
                      </div>
                      <span
                        className="status-badge"
                        style={{ '--status-color': getStatusColor(doc.status) }}
                      >
                        {getStatusName(doc.status)}
                      </span>
                    </div>
                    <div className="entry-actions">
                      <button
                        className="action-btn view-btn"
                        onClick={() => navigate(`/admin/knowledge/document/${doc.doc_id}`)}
                        title="查看详情"
                      >
                        <EyeOutlined />
                      </button>
                      {doc.status === 'failed' && (
                        <button
                          className="action-btn retry-btn"
                          title="重试"
                        >
                          <ReloadOutlined />
                        </button>
                      )}
                      <button
                        className="action-btn delete-btn"
                        onClick={() => handleDelete(doc.doc_id)}
                        disabled={deletingId === doc.doc_id}
                        title="删除"
                      >
                        <DeleteOutlined />
                      </button>
                    </div>
                  </div>
                  <div className="entry-content">
                    <div className="doc-meta">
                      <span className="meta-item">
                        📂 {doc.category || '未分类'}
                      </span>
                      <span className="meta-item">
                        📊 {doc.chunk_count || 0} 个分块
                      </span>
                      <span className="meta-item">
                        💾 {formatFileSize(doc.file_size)}
                      </span>
                    </div>
                    {doc.error_message && (
                      <div className="error-message">
                        ❌ {doc.error_message}
                      </div>
                    )}
                  </div>
                  <div className="entry-footer">
                    <span className="entry-source">
                      上传者: {doc.uploaded_by || '未知'}
                    </span>
                    <span className="entry-date">
                      {new Date(doc.created_at).toLocaleString('zh-CN')}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* 分页 */}
            {totalPages > 1 && (
              <div className="pagination">
                <button
                  className="page-btn"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  上一页
                </button>
                <span className="page-info">
                  第 {currentPage} / {totalPages} 页 (共 {total} 条)
                </span>
                <button
                  className="page-btn"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  下一页
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
