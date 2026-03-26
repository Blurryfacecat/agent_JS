import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getKnowledgeEntry, createKnowledgeEntry, updateKnowledgeEntry, getKnowledgeCategories } from '../../services/api';
import './KnowledgeForm.css';

export default function KnowledgeForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);

  const [formData, setFormData] = useState({
    title: '',
    category: '',
    content: '',
    source: ''
  });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(isEditMode);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // 加载知识库条目（编辑模式）
  useEffect(() => {
    if (isEditMode) {
      loadEntry();
    }
    loadCategories();
  }, [id]);

  const loadEntry = async () => {
    try {
      const data = await getKnowledgeEntry(parseInt(id));
      if (data.data) {
        const entry = data.data;
        setFormData({
          title: entry.title || '',
          category: entry.category || '',
          content: entry.content || '',
          source: entry.source || ''
        });
      }
    } catch (error) {
      console.error('加载知识库条目失败:', error);
      setError('加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await getKnowledgeCategories();
      if (data.data) {
        setCategories(data.data.categories);
      }
    } catch (error) {
      console.error('加载分类失败:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const handleContentChange = (value) => {
    setFormData(prev => ({
      ...prev,
      content: value
    }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 验证
    if (!formData.title.trim()) {
      setError('请输入标题');
      return;
    }
    if (!formData.content.trim()) {
      setError('请输入内容');
      return;
    }

    setSubmitting(true);

    try {
      if (isEditMode) {
        await updateKnowledgeEntry(parseInt(id), formData);
      } else {
        await createKnowledgeEntry(formData);
      }
      navigate('/admin/knowledge');
    } catch (error) {
      console.error('保存失败:', error);
      setError(error.message || '保存失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate('/admin/knowledge');
  };

  if (loading) {
    return (
      <div className="form-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="form-container">
      {/* 页面标题 */}
      <div className="form-header">
        <h1>{isEditMode ? '编辑知识库' : '新增知识库'}</h1>
      </div>

      {/* 表单 */}
      <form className="knowledge-form" onSubmit={handleSubmit}>
        {/* 标题 */}
        <div className="form-group">
          <label className="form-label required">标题</label>
          <input
            type="text"
            name="title"
            className="form-input"
            placeholder="请输入知识库标题（必填）"
            value={formData.title}
            onChange={handleChange}
            maxLength={100}
          />
          <span className="char-count">{formData.title.length}/100</span>
        </div>

        {/* 分类 */}
        <div className="form-group">
          <label className="form-label">分类</label>
          <select
            name="category"
            className="form-select"
            value={formData.category}
            onChange={handleChange}
          >
            <option value="">未分类</option>
            <option value="faq">常见问题</option>
            <option value="policy">政策规定</option>
            <option value="training">培训资料</option>
            <option value="other">其他</option>
          </select>
        </div>

        {/* 来源 */}
        <div className="form-group">
          <label className="form-label">来源</label>
          <input
            type="text"
            name="source"
            className="form-input"
            placeholder="请输入来源（如：运营手册、培训文档等）"
            value={formData.source}
            onChange={handleChange}
            maxLength={100}
          />
        </div>

        {/* 内容 */}
        <div className="form-group full-width">
          <label className="form-label required">内容</label>
          <textarea
            className="form-textarea"
            placeholder="请输入知识库详细内容..."
            value={formData.content}
            onChange={(e) => handleContentChange(e.target.value)}
            rows={10}
          ></textarea>
          <span className="char-count">{formData.content.length} 字符</span>
        </div>

        {/* 错误提示 */}
        {error && <div className="form-error">{error}</div>}

        {/* 操作按钮 */}
        <div className="form-actions">
          <button
            type="button"
            className="secondary-btn"
            onClick={handleCancel}
            disabled={submitting}
          >
            取消
          </button>
          <button
            type="submit"
            className="primary-btn"
            disabled={submitting}
          >
            {submitting ? '保存中...' : isEditMode ? '保存修改' : '创建'}
          </button>
        </div>
      </form>

      {/* 提示信息 */}
      <div className="form-tips">
        <p>💡 提示：</p>
        <ul>
          <li>标题建议简洁明了，方便用户搜索</li>
          <li>内容应详细准确，便于AI理解和检索</li>
          <li>选择合适的分类有助于管理和检索</li>
        </ul>
      </div>
    </div>
  );
}
