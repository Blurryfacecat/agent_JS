import { Routes, Route, Navigate } from 'react-router-dom';
import CustomerService from './pages/CustomerService';
import AdminPlaceholder from './pages/AdminPlaceholder';

function App() {
  return (
    <Routes>
      {/* 骑手智能客服 H5 页面 */}
      <Route path="/chat" element={<CustomerService />} />
      <Route path="/" element={<Navigate to="/chat" replace />} />

      {/* 后台管理页面占位 */}
      <Route path="/admin" element={<AdminPlaceholder />} />
      <Route path="/admin/*" element={<AdminPlaceholder />} />
    </Routes>
  );
}

export default App;
