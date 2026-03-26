import { Link } from 'react-router-dom';
import './Dashboard.css';

export default function Dashboard() {
  const stats = [
    { id: 1, title: '知识条目', value: '--', icon: '📚', color: '#667eea', path: '/admin/knowledge' },
    { id: 2, title: '文档数量', value: '--', icon: '📄', color: '#26a69a', path: '/admin/documents' },
    { id: 3, title: '今日对话', value: '--', icon: '💬', color: '#ffa726', path: '/admin/analytics' },
    { id: 4, title: '满意度', value: '--%', icon: '👍', color: '#ef5350', path: '/admin/analytics' },
  ];

  const quickActions = [
    {
      id: 'add-knowledge',
      title: '新增知识',
      description: '添加新的知识库条目',
      icon: '➕',
      path: '/admin/knowledge/new',
      color: '#667eea'
    },
    {
      id: 'upload-doc',
      title: '上传文档',
      description: '上传PDF、Word等文档',
      icon: '📤',
      path: '/admin/documents',
      color: '#26a69a'
    },
    {
      id: 'manage-suggestions',
      title: '管理建议',
      description: '编辑猜你想问问题',
      icon: '✏️',
      path: '/admin/suggestions',
      color: '#ffa726'
    },
    {
      id: 'view-stats',
      title: '查看统计',
      description: '查看数据分析报告',
      icon: '📊',
      path: '/admin/analytics',
      color: '#ef5350'
    },
  ];

  return (
    <div className="dashboard-page">
      {/* 页面标题 */}
      <div className="page-header">
        <h1 className="page-title">工作台</h1>
        <p className="page-subtitle">欢迎使用智能客服管理后台系统</p>
      </div>

      {/* 统计卡片 */}
      <div className="stats-grid">
        {stats.map(stat => (
          <Link
            key={stat.id}
            to={stat.path}
            className="stat-card"
            style={{ '--stat-color': stat.color }}
          >
            <div className="stat-icon">{stat.icon}</div>
            <div className="stat-content">
              <div className="stat-value">{stat.value}</div>
              <div className="stat-label">{stat.title}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* 快速操作 */}
      <section className="quick-actions-section">
        <h2 className="section-title">快速操作</h2>
        <div className="quick-actions-grid">
          {quickActions.map(action => (
            <Link
              key={action.id}
              to={action.path}
              className="action-card"
              style={{ '--action-color': action.color }}
            >
              <div className="action-icon">{action.icon}</div>
              <div className="action-content">
                <h3 className="action-title">{action.title}</h3>
                <p className="action-description">{action.description}</p>
              </div>
              <div className="action-arrow">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 系统信息 */}
      <section className="system-info-section">
        <h2 className="section-title">系统信息</h2>
        <div className="info-cards">
          <div className="info-card">
            <div className="info-card-header">
              <span className="info-icon">ℹ️</span>
              <h3>关于系统</h3>
            </div>
            <div className="info-card-body">
              <div className="info-item">
                <span className="info-label">系统名称</span>
                <span className="info-value">Rider Agent 智能客服系统</span>
              </div>
              <div className="info-item">
                <span className="info-label">版本号</span>
                <span className="info-value">v1.0.0</span>
              </div>
              <div className="info-item">
                <span className="info-label">AI模型</span>
                <span className="info-value">智谱AI GLM</span>
              </div>
            </div>
          </div>

          <div className="info-card">
            <div className="info-card-header">
              <span className="info-icon">🔗</span>
              <h3>快捷链接</h3>
            </div>
            <div className="info-card-body">
              <a href="/chat" target="_blank" className="link-item">
                <span>客服页面</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>
              <a href="https://open.bigmodel.cn/" target="_blank" rel="noopener noreferrer" className="link-item">
                <span>智谱AI控制台</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
