import './AdminPlaceholder.css';

export default function AdminPlaceholder() {
  return (
    <div className="admin-placeholder">
      <div className="placeholder-content">
        <div className="placeholder-icon">🚧</div>
        <h1>后台管理系统</h1>
        <p>功能开发中，敬请期待...</p>
        <div className="feature-list">
          <div className="feature-item">📄 文档上传与管理</div>
          <div className="feature-item">📊 数据统计与分析</div>
          <div className="feature-item">⚙️ 系统配置管理</div>
          <div className="feature-item">💬 对话记录查询</div>
        </div>
        <a href="/chat" className="back-link">返回客服页面</a>
      </div>
    </div>
  );
}
