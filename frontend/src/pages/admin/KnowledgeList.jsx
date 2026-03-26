import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getKnowledgeEntries, deleteKnowledgeEntry, getKnowledgeCategories, getKnowledgeEntriesStats } from '../../services/api';
import './KnowledgeList.css';

export default function KnowledgeList() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // 分页和搜索状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  // 加载知识库列表
  const loadEntries = async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        limit: pageSize,
      };
      if (searchKeyword) params.search = searchKeyword;
      if (selectedCategory) params.category = selectedCategory;

      const data = await getKnowledgeEntries(params);

      if (data.data) {
        setEntries(data.data.list);
        setTotal(data.data.total);
        setTotalPages(data.data.totalPages);
      }
    } catch (error) {
      console.error('加载知识库列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 加载分类和统计
  const loadMetadata = async () => {
    try {
      const [categoriesData, statsData] = await Promise.all([
        getKnowledgeCategories(),
        getKnowledgeEntriesStats()
      ]);

      if (categoriesData.data) {
        setCategories(categoriesData.data.categories);
      }
      if (statsData.data) {
        setStats(statsData.data);
      }
    } catch (error) {
      console.error('加载元数据失败:', error);
    }
  };

  useEffect(() => {
    loadEntries();
    loadMetadata();
  }, [currentPage, selectedCategory, searchKeyword]);

  // 删除条目
  const handleDelete = async (id) => {
    if (!confirm('确定要删除这条知识库条目吗？')) return;

    setDeletingId(id);
    try {
      await deleteKnowledgeEntry(id);
      // 重新加载列表
      await loadEntries();
      await loadMetadata();
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败，请稍后重试');
    } finally {
      setDeletingId(null);
    }
  };

  // 搜索处理
  const handleSearch = (e) => {
    setSearchKeyword(e.target.value);
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

  return (
    <div className="knowledge-list-container">
      {/* 页面标题 */}
      <div className="kb-header">
        <h1>知识库管理</h1>
        <button
          className="primary-btn"
          onClick={() => navigate('/admin/knowledge/new')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          新增知识库
        </button>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div className="stats-cards">
          <div className="stat-card">
            <div className="stat-icon">📚</div>
            <div className="stat-info">
              <div className="stat-value">{stats.total}</div>
              <div className="stat-label">知识条目</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🏷️</div>
            <div className="stat-info">
              <div className="stat-value">{stats.byCategory?.length || 0}</div>
              <div className="stat-label">分类数量</div>
            </div>
          </div>
        </div>
      )}

      {/* 搜索和筛选 */}
      <div className="filter-bar">
        <div className="search-box">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            type="text"
            placeholder="搜索标题或内容..."
            value={searchKeyword}
            onChange={handleSearch}
          />
        </div>
        <select
          className="category-filter"
          value={selectedCategory}
          onChange={(e) => handleCategoryChange(e.target.value)}
        >
          <option value="">全部分类</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{getCategoryName(cat)}</option>
          ))}
        </select>
      </div>

      {/* 知识库列表 */}
      <div className="entries-container">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>加载中...</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📚</div>
            <h3>暂无知识库条目</h3>
            <p>点击上方"新增知识库"按钮添加第一条知识</p>
          </div>
        ) : (
          <>
            <div className="entries-list">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="entry-card"
                  onClick={() => navigate(`/admin/knowledge/detail/${entry.id}`)}
                >
                  <div className="entry-header">
                    <div className="entry-title-row">
                      <h3 className="entry-title">{entry.title}</h3>
                      {entry.category && (
                        <span className="entry-category">{getCategoryName(entry.category)}</span>
                      )}
                    </div>
                    <div className="entry-actions">
                      <button
                        className="action-btn view-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/admin/knowledge/detail/${entry.id}`);
                        }}
                        title="查看详情"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                      </button>
                      <button
                        className="action-btn edit-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/admin/knowledge/edit/${entry.id}`);
                        }}
                        title="编辑"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 5 5v4h4Z"/>
                        </svg>
                      </button>
                      <button
                        className="action-btn delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(entry.id);
                        }}
                        disabled={deletingId === entry.id}
                        title="删除"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="entry-content">
                    <p>{entry.content_preview}</p>
                    {entry.content_length > 100 && (
                      <span className="content-length">({entry.content_length} 字符)</span>
                    )}
                  </div>
                  <div className="entry-footer">
                    <span className="entry-source">
                      {entry.source || '未注明来源'}
                    </span>
                    <span className="entry-date">
                      {new Date(entry.updated_at).toLocaleDateString('zh-CN')}
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
