import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { Select, Checkbox } from 'antd';
import {
  getSuggestions,
  createSuggestion,
  updateSuggestion,
  deleteSuggestion,
} from '../../services/api';
import './SuggestionsList.css';

export default function SuggestionsList() {
  const navigate = useNavigate();
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);

  // 分页和筛选状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // 图标选项
  const iconOptions = ['📋', '📍', '💰', '💬', '🏠', '🎧', '⏰', '💳', '🚚', '📦', '⭐', '❓', '💡'];

  // 加载推荐问题列表
  const loadSuggestions = async () => {
    setLoading(true);
    try {
      // 使用管理员接口获取所有建议
      const data = await fetch(`http://localhost:3001/api/v1/suggestions/admin/list?page=${currentPage}&limit=${pageSize}${selectedCategory ? `&category=${selectedCategory}` : ''}`).then(r => r.json());

      if (data.code === 200) {
        const list = showInactive ? data.data.list : data.data.list.filter(s => s.is_active === 1);
        setSuggestions(list);
        setTotal(data.data.total);
        setTotalPages(data.data.totalPages);
      }
    } catch (error) {
      console.error('加载推荐问题失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuggestions();
  }, [currentPage, selectedCategory, showInactive]);

  // 删除推荐问题
  const handleDelete = async (id) => {
    if (!confirm('确定要删除这条推荐问题吗？')) return;

    setDeletingId(id);
    try {
      await deleteSuggestion(id);
      await loadSuggestions();
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败，请稍后重试');
    } finally {
      setDeletingId(null);
    }
  };

  // 切换激活状态
  const handleToggleActive = async (suggestion) => {
    try {
      await updateSuggestion(suggestion.id, {
        isActive: !suggestion.is_active
      });
      await loadSuggestions();
    } catch (error) {
      console.error('更新失败:', error);
      alert('更新失败，请稍后重试');
    }
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

  // 获取分类名称
  const getCategoryName = (category) => {
    const categoryMap = {
      'order': '订单',
      'delivery': '配送',
      'payment': '费用',
      'support': '客服',
      'other': '其他',
    };
    return categoryMap[category] || category || '未分类';
  };

  // 获取分类颜色
  const getCategoryColor = (category) => {
    const colorMap = {
      'order': '#667eea',
      'delivery': '#26a69a',
      'payment': '#ffa726',
      'support': '#ef5350',
      'other': '#78909c',
    };
    return colorMap[category] || '#999';
  };

  return (
    <div className="suggestions-list-container">
      {/* 页面标题 */}
      <div className="kb-header">
        <h1>推荐问题管理</h1>
        <button
          className="primary-btn"
          onClick={() => navigate('/admin/suggestions/new')}
        >
          <PlusOutlined />
          新增推荐问题
        </button>
      </div>

      {/* 统计卡片 */}
      <div className="stats-cards">
        <div className="stat-card">
          <div className="stat-icon">💬</div>
          <div className="stat-info">
            <div className="stat-value">{total}</div>
            <div className="stat-label">总推荐问题</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-info">
            <div className="stat-value">{suggestions.filter(s => s.is_active === 1).length}</div>
            <div className="stat-label">已激活</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">❌</div>
          <div className="stat-info">
            <div className="stat-value">{suggestions.filter(s => s.is_active === 0).length}</div>
            <div className="stat-label">已停用</div>
          </div>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="filter-bar">
        <Select
          className="category-filter"
          value={selectedCategory || undefined}
          onChange={handleCategoryChange}
          style={{ width: 120 }}
          placeholder="全部分类"
          options={[
            { value: 'order', label: '订单' },
            { value: 'delivery', label: '配送' },
            { value: 'payment', label: '费用' },
            { value: 'support', label: '客服' },
            { value: 'other', label: '其他' },
          ]}
        />
        <Checkbox
          checked={showInactive}
          onChange={(e) => {
            setShowInactive(e.target.checked);
            setCurrentPage(1);
          }}
        >
          显示停用项
        </Checkbox>
      </div>

      {/* 推荐问题列表 */}
      <div className="entries-container">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>加载中...</p>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💬</div>
            <h3>暂无推荐问题</h3>
            <p>点击上方"新增推荐问题"按钮添加第一条推荐</p>
          </div>
        ) : (
          <>
            <div className="suggestions-list">
              {suggestions.map((suggestion) => (
                <div
                  key={suggestion.id}
                  className={`suggestion-card ${suggestion.is_active === 0 ? 'inactive' : ''}`}
                >
                  <div className="suggestion-header">
                    <div className="suggestion-title-row">
                      <span className="suggestion-icon">{suggestion.icon || '💬'}</span>
                      <h3 className="suggestion-title">{suggestion.title}</h3>
                      {suggestion.category && (
                        <span
                          className="category-badge"
                          style={{ '--category-color': getCategoryColor(suggestion.category) }}
                        >
                          {getCategoryName(suggestion.category)}
                        </span>
                      )}
                      <span className="sort-order">排序: {suggestion.sort_order}</span>
                      <span className="click-count">
                        点击: {suggestion.click_count || 0}
                      </span>
                    </div>
                    <div className="suggestion-actions">
                      <button
                        className="action-btn edit-btn"
                        onClick={() => navigate(`/admin/suggestions/edit/${suggestion.id}`)}
                        title="编辑"
                      >
                        <EditOutlined />
                      </button>
                      <button
                        className={`action-btn toggle-btn ${suggestion.is_active === 0 ? 'disabled' : ''}`}
                        onClick={() => handleToggleActive(suggestion)}
                        title={suggestion.is_active ? '停用' : '启用'}
                      >
                        {suggestion.is_active ? '🔹' : '⭕'}
                      </button>
                      <button
                        className="action-btn delete-btn"
                        onClick={() => handleDelete(suggestion.id)}
                        disabled={deletingId === suggestion.id}
                        title="删除"
                      >
                        <DeleteOutlined />
                      </button>
                    </div>
                  </div>
                  <div className="suggestion-content">
                    <p>{suggestion.content}</p>
                  </div>
                  <div className="suggestion-footer">
                    <span className="suggestion-meta">
                      创建时间: {new Date(suggestion.created_at).toLocaleString('zh-CN')}
                    </span>
                    {suggestion.updated_at !== suggestion.created_at && (
                      <span className="suggestion-meta">
                        更新: {new Date(suggestion.updated_at).toLocaleString('zh-CN')}
                      </span>
                    )}
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
