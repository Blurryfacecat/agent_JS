import { NavLink, Outlet, useLocation } from 'react-router-dom';
import './AdminLayout.css';

const menuItems = [
  {
    id: 'dashboard',
    title: '首页',
    icon: '🏠',
    path: '/admin'
  },
  {
    id: 'knowledge',
    title: '知识库管理',
    icon: '📚',
    path: '/admin/knowledge'
  },
  {
    id: 'documents',
    title: '文档管理',
    icon: '📄',
    path: '/admin/documents'
  },
  {
    id: 'suggestions',
    title: '猜你想问',
    icon: '💡',
    path: '/admin/suggestions'
  },
  {
    id: 'analytics',
    title: '数据统计',
    icon: '📊',
    path: '/admin/analytics'
  },
  {
    id: 'settings',
    title: '系统设置',
    icon: '⚙️',
    path: '/admin/settings'
  }
];

export default function AdminLayout() {
  const location = useLocation();

  // 判断当前激活的菜单项
  const getActiveMenu = () => {
    const path = location.pathname;
    if (path === '/admin') return 'dashboard';
    if (path.startsWith('/admin/knowledge')) return 'knowledge';
    if (path.startsWith('/admin/documents')) return 'documents';
    if (path.startsWith('/admin/suggestions')) return 'suggestions';
    if (path.startsWith('/admin/analytics')) return 'analytics';
    if (path.startsWith('/admin/settings')) return 'settings';
    return 'dashboard';
  };

  const activeMenu = getActiveMenu();

  return (
    <div className="admin-layout">
      {/* 左侧导航栏 */}
      <aside className="admin-sidebar">
        {/* Logo区域 */}
        <div className="sidebar-header">
          <div className="logo">
            <span className="logo-icon">🤖</span>
            <span className="logo-text">智能客服</span>
          </div>
          <div className="logo-subtitle">管理后台</div>
        </div>

        {/* 导航菜单 */}
        <nav className="sidebar-nav">
          <ul className="nav-list">
            {menuItems.map(item => (
              <li key={item.id} className="nav-item">
                <NavLink
                  to={item.path}
                  className={`nav-link ${activeMenu === item.id ? 'active' : ''}`}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-text">{item.title}</span>
                  {activeMenu === item.id && <span className="nav-indicator" />}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* 底部返回按钮 */}
        <div className="sidebar-footer">
          <a href="/chat" className="back-to-chat">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            返回客服页面
          </a>
        </div>
      </aside>

      {/* 右侧内容区域 */}
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
