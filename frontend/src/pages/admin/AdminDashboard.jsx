import { Link } from 'react-router-dom';
import './AdminDashboard.css';

export default function AdminDashboard() {
  const menuItems = [
    {
      id: 'knowledge',
      title: '知识库管理',
      description: '管理智能客服的知识库内容',
      icon: '📚',
      path: '/admin/knowledge',
      color: '#667eea'
    },
    {
      id: 'documents',
      title: '文档管理',
      description: '上传和管理文档资料',
      icon: '📄',
      path: '/admin/documents',
      color: '#26a69a'
    },
    {
      id: 'suggestions',
      title: '猜你想问',
      description: '管理用户建议的问题',
      icon: '💡',
      path: '/admin/suggestions',
      color: '#ffa726'
    },
    {
      id: 'analytics',
      title: '数据统计',
      description: '查看用户反馈和统计数据',
      icon: '📊',
      path: '/admin/analytics',
      color: '#ef5350'
    },
    {
      id: 'settings',
      title: '系统设置',
      description: '配置系统参数',
      icon: '⚙️',
      path: '/admin/settings',
      color: '#78909c'
    }
  ];

  return (
    <div className="admin-dashboard">
      {/* 顶部导航栏 */}
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <h1 className="header-title">智能客服后台管理系统</h1>
            <p className="header-subtitle">Rider Agent Administration Console</p>
          </div>
          <Link to="/chat" className="header-back-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            返回客服页面
          </Link>
        </div>
      </header>

      {/* 主要内容区 */}
      <main className="dashboard-main">
        <div className="dashboard-content">
          {/* 欢迎卡片 */}
          <div className="welcome-card">
            <div className="welcome-icon">👋</div>
            <div className="welcome-text">
              <h2>欢迎回来，管理员</h2>
              <p>请选择要管理的模块</p>
            </div>
          </div>

          {/* 功能菜单网格 */}
          <div className="menu-grid">
            {menuItems.map(item => (
              <Link
                key={item.id}
                to={item.path}
                className="menu-card"
                style={{ '--card-color': item.color }}
              >
                <div className="menu-icon">{item.icon}</div>
                <h3 className="menu-title">{item.title}</h3>
                <p className="menu-description">{item.description}</p>
                <div className="menu-arrow">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </div>
              </Link>
            ))}
          </div>

          {/* 快速统计 */}
          <div className="quick-stats">
            <div className="stat-item">
              <div className="stat-icon">📊</div>
              <div className="stat-content">
                <div className="stat-value">--</div>
                <div className="stat-label">知识条目</div>
              </div>
            </div>
            <div className="stat-item">
              <div className="stat-icon">💬</div>
              <div className="stat-content">
                <div className="stat-value">--</div>
                <div className="stat-label">今日对话</div>
              </div>
            </div>
            <div className="stat-item">
              <div className="stat-icon">👍</div>
              <div className="stat-content">
                <div className="stat-value">--%</div>
                <div className="stat-label">满意度</div>
              </div>
            </div>
            <div className="stat-item">
              <div className="stat-icon">📄</div>
              <div className="stat-content">
                <div className="stat-value">--</div>
                <div className="stat-label">文档数量</div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 页脚 */}
      <footer className="dashboard-footer">
        <p>© 2024 Rider Agent. All rights reserved.</p>
      </footer>
    </div>
  );
}
