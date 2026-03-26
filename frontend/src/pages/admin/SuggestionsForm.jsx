import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Select, Input, Button, Switch } from 'antd';
import {
  getSuggestionDetail,
  createSuggestion,
  updateSuggestion,
} from "../../services/api";
import "./SuggestionsForm.css";

const { TextArea } = Input;

export default function SuggestionsForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);

  const [formData, setFormData] = useState({
    title: "",
    content: "",
    icon: "💬",
    category: "",
    sortOrder: 0,
    isActive: true,
  });

  const [loading, setLoading] = useState(isEditMode);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // 图标选项
  const iconOptions = [
    { value: "📋", label: "📋 订单" },
    { value: "📍", label: "📍 配送" },
    { value: "💰", label: "💰 费用" },
    { value: "💬", label: "💬 客服" },
    { value: "🏠", label: "🏠 地址" },
    { value: "🎧", label: "🎧 人工客服" },
    { value: "⏰", label: "⏰ 时间" },
    { value: "💳", label: "💳 支付" },
    { value: "🚚", label: "🚚 配送" },
    { value: "📦", label: "📦 包裹" },
    { value: "⭐", label: "⭐ 收藏" },
    { value: "❓", label: "❓ 帮助" },
    { value: "💡", label: "💡 提示" },
  ];

  // 加载推荐问题（编辑模式）
  useEffect(() => {
    if (isEditMode) {
      loadSuggestion();
    }
  }, [id]);

  const loadSuggestion = async () => {
    try {
      const data = await getSuggestionDetail(parseInt(id));
      if (data.data) {
        const suggestion = data.data;
        setFormData({
          title: suggestion.title || "",
          content: suggestion.content || "",
          icon: suggestion.icon || "💬",
          category: suggestion.category || "",
          sortOrder: suggestion.sort_order || 0,
          isActive: suggestion.is_active === 1,
        });
      }
    } catch (err) {
      console.error("加载推荐问题失败:", err);
      setError("加载失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 验证
    if (!formData.title.trim()) {
      setError("请输入标题");
      return;
    }
    if (!formData.content.trim()) {
      setError("请输入内容");
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        title: formData.title,
        content: formData.content,
        icon: formData.icon,
        category: formData.category || undefined,
        sortOrder: formData.sortOrder || 0,
      };

      if (isEditMode) {
        await updateSuggestion(parseInt(id), {
          ...payload,
          isActive: formData.isActive,
        });
      } else {
        await createSuggestion(payload);
      }

      navigate("/admin/suggestions");
    } catch (err) {
      console.error("保存失败:", err);
      setError(
        err.response?.data?.message || err.message || "保存失败，请稍后重试",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate("/admin/suggestions");
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
        <h1>{isEditMode ? "编辑推荐问题" : "新增推荐问题"}</h1>
      </div>

      {/* 表单 */}
      <form className="suggestion-form" onSubmit={handleSubmit}>
        {/* 标题 */}
        <div className="form-group">
          <label className="form-label required">标题</label>
          <Input
            name="title"
            placeholder="请输入推荐问题标题（必填）"
            value={formData.title}
            onChange={(e) => handleChange({ target: { name: 'title', value: e.target.value } })}
            maxLength={50}
          />
          <span className="char-count">{formData.title.length}/50</span>
        </div>

        {/* 内容 */}
        <div className="form-group">
          <label className="form-label required">内容</label>
          <TextArea
            placeholder="请输入推荐问题的完整内容..."
            value={formData.content}
            onChange={(e) => handleChange({ target: { name: 'content', value: e.target.value } })}
            rows={3}
            maxLength={200}
          />
          <span className="char-count">{formData.content.length}/200</span>
        </div>

        {/* 图标和分类行 */}
        <div className="form-row">
          {/* 图标 */}
          <div className="form-group">
            <label className="form-label">图标</label>
            <Select
              value={formData.icon}
              onChange={(value) => handleChange({ target: { name: 'icon', value } })}
              style={{ width: '100%' }}
              options={iconOptions.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
            />
          </div>

          {/* 分类 */}
          <div className="form-group">
            <label className="form-label">分类</label>
            <Select
              value={formData.category || undefined}
              onChange={(value) => handleChange({ target: { name: 'category', value } })}
              style={{ width: '100%' }}
              placeholder="未分类"
              allowClear
              options={[
                { value: 'order', label: '订单' },
                { value: 'delivery', label: '配送' },
                { value: 'payment', label: '费用' },
                { value: 'support', label: '客服' },
                { value: 'other', label: '其他' },
              ]}
            />
          </div>
        </div>

        {/* 排序和状态行 */}
        <div className="form-row">
          {/* 排序 */}
          <div className="form-group">
            <label className="form-label">排序</label>
            <Input
              type="number"
              name="sortOrder"
              placeholder="数字越小排序越靠前"
              value={formData.sortOrder}
              onChange={(e) => handleChange({ target: { name: 'sortOrder', value: e.target.value } })}
              min={0}
              max={999}
            />
          </div>

          {/* 状态 */}
          {isEditMode && (
            <div className="form-group">
              <label className="form-label">状态</label>
              <Select
                value={formData.isActive ? 'true' : 'false'}
                onChange={(value) => handleChange({ target: { name: 'isActive', value: value === 'true' } })}
                style={{ width: '100%' }}
                options={[
                  { value: 'true', label: '启用' },
                  { value: 'false', label: '停用' },
                ]}
              />
            </div>
          )}
        </div>

        {/* 图标预览 */}
        <div className="icon-preview">
          <span className="preview-label">图标预览：</span>
          <span className="preview-icon">{formData.icon}</span>
          <span className="preview-title">{formData.title || "标题"}</span>
        </div>

        {/* 错误提示 */}
        {error && <div className="form-error">{error}</div>}

        {/* 操作按钮 */}
        <div className="form-actions">
          <Button onClick={handleCancel} disabled={submitting}>
            取消
          </Button>
          <Button type="primary" htmlType="submit" loading={submitting}>
            {isEditMode ? "保存修改" : "创建"}
          </Button>
        </div>
      </form>

      {/* 提示信息 */}
      <div className="form-tips">
        <p>💡 提示：</p>
        <ul>
          <li>标题建议简洁明了，方便用户快速理解</li>
          <li>内容应具体完整，便于AI理解和回答</li>
          <li>选择合适的分类和图标有助于用户识别</li>
          <li>排序数字越小，显示位置越靠前</li>
        </ul>
      </div>
    </div>
  );
}
