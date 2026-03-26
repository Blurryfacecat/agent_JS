import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getKnowledgeEntry, deleteKnowledgeEntry } from '../../services/api';
import './KnowledgeDetail.css';

export default function KnowledgeDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadEntry();
  }, [id]);

  const loadEntry = async () => {
    setLoading(true);
    try {
      const data = await getKnowledgeEntry(parseInt(id));
      if (data.data) {
        setEntry(data.data);
      }
    } catch (error) {
      console.error('加载知识库详情失败:', error);
      // TODO: 显示错误提示
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    navigate(`/admin/knowledge/edit/${id}`);
  };

  const handleDelete = async () => {
    if (!confirm('确定要删除这条知识库条目吗？')) return;

    setDeleting(true);
    try {
      await deleteKnowledgeEntry(parseInt(id));
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

  // 获取分类名称
  const getCategoryName = (category) => {
    const categoryMap = {
      'faq': '常见问题',
      'policy': '政策规定',
      'training': '培训资料',
      'other': '其他'
    };
    return categoryMap[category] || category || '未分类';
  };

  // 获取分类颜色
  const getCategoryColor = (category) => {
    const colorMap = {
      'faq': '#667eea',
      'policy': '#26a69a',
      'training': '#ffa726',
      'other': '#78909c'
    };
    return colorMap[category] || '#999';
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

  if (!entry) {
    return (
      <div className="detail-container">
        <div className="error-state">
          <div className="error-icon">😕</div>
          <h3>知识库条目不存在</h3>
          <button className="back-btn" onClick={handleBack}>返回列表</button>
        </div>
      </div>
    );
  }

  return (
    <div className="detail-container">
      {/* 页面标题和操作 */}
      <div className="detail-header">
        <h1>知识库详情</h1>
        <div className="header-actions">
          <button
            className="action-btn secondary-btn"
            onClick={handleBack}
          >
            返回列表
          </button>
          <button
            className="action-btn edit-btn"
            onClick={handleEdit}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 5 5v4h4Z"/>
            </svg>
            编辑
          </button>
          <button
            className="action-btn delete-btn"
            onClick={handleDelete}
            disabled={deleting}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
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
            {entry.category && (
              <span
                className="category-badge"
                style={{ '--category-color': getCategoryColor(entry.category) }}
              >
                {getCategoryName(entry.category)}
              </span>
            )}
          </div>

          <div className="info-item">
            <span className="info-label">标题</span>
            <span className="info-value">{entry.title}</span>
          </div>

          {entry.source && (
            <div className="info-item">
              <span className="info-label">来源</span>
              <span className="info-value">{entry.source}</span>
            </div>
          )}

          <div className="info-item">
            <span className="info-label">创建时间</span>
            <span className="info-value">
              {new Date(entry.created_at).toLocaleString('zh-CN')}
            </span>
          </div>

          <div className="info-item">
            <span className="info-label">更新时间</span>
            <span className="info-value">
              {new Date(entry.updated_at).toLocaleString('zh-CN')}
            </span>
          </div>
        </div>

        {/* 内容卡片 */}
        <div className="content-card">
          <h2 className="card-title">详细内容</h2>
          <div className="content-body">
            {entry.content}
          </div>
          <div className="content-stats">
            <span className="stat-item">共 {entry.content?.length || 0} 个字符</span>
          </div>
        </div>
      </div>
    </div>
  );
}
