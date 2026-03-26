import { Routes, Route, Navigate } from 'react-router-dom';
import CustomerService from './pages/CustomerService';
import AdminLayout from './layouts/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import KnowledgeList from './pages/admin/KnowledgeList';
import KnowledgeForm from './pages/admin/KnowledgeForm';
import KnowledgeDetail from './pages/admin/KnowledgeDetail';

function App() {
  return (
    <Routes>
      {/* 骑手智能客服 H5 页面 */}
      <Route path="/chat" element={<CustomerService />} />
      <Route path="/" element={<Navigate to="/chat" replace />} />

      {/* 后台管理系统 - 使用左侧导航布局 */}
      <Route path="/admin" element={<AdminLayout />}>
        {/* 首页 */}
        <Route index element={<Dashboard />} />

        {/* 知识库管理 */}
        <Route path="knowledge" element={<KnowledgeList />} />
        <Route path="knowledge/new" element={<KnowledgeForm />} />
        <Route path="knowledge/edit/:id" element={<KnowledgeForm />} />
        <Route path="knowledge/detail/:id" element={<KnowledgeDetail />} />

        {/* 其他管理模块（待实现） */}
        <Route path="documents" element={<Dashboard />} />
        <Route path="suggestions" element={<Dashboard />} />
        <Route path="analytics" element={<Dashboard />} />
        <Route path="settings" element={<Dashboard />} />
      </Route>
    </Routes>
  );
}

export default App;
