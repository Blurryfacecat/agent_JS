import { useState, useRef, useEffect } from 'react';
import { sendChatMessage, getSuggestions, recordSuggestionClick, submitFeedback } from '../services/api';
import './CustomerService.css';

// 默认骑手ID (实际应用中应从用户登录信息获取)
const DEFAULT_RIDER_ID = 'rider_guest_001';

export default function CustomerService() {
  const [messages, setMessages] = useState([
    { id: 1, role: 'assistant', content: '您好！我是您的AI助手，请问有什么可以帮您？', dbId: null }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(true);
  const [feedbackableMessageId, setFeedbackableMessageId] = useState(null); // 当前可反馈的消息ID
  const [feedbackState, setFeedbackState] = useState({}); // { messageId: 'helpful' | 'notHelpful' | null }
  const messagesEndRef = useRef(null);

  const sessionId = useRef(`session_${Date.now()}`);

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 加载猜你想问
  useEffect(() => {
    const loadSuggestions = async () => {
      try {
        setIsLoadingSuggestions(true);
        const data = await getSuggestions({ limit: 5, random: true });
        if (data.data && data.data.suggestions) {
          setSuggestions(data.data.suggestions);
        }
      } catch (error) {
        console.error('加载猜你想问失败:', error);
        // 使用默认建议
        setSuggestions([
          { id: 1, title: '查看我的订单', content: '查看我的订单', icon: '📋' },
          { id: 2, title: '查询配送进度', content: '查询配送进度', icon: '📍' },
          { id: 3, title: '费用相关问题', content: '费用相关问题', icon: '💰' },
          { id: 4, title: '投诉与建议', content: '投诉与建议', icon: '💬' }
        ]);
      } finally {
        setIsLoadingSuggestions(false);
      }
    };

    loadSuggestions();
  }, []);

  // 发送消息的核心逻辑
  const sendMessage = async (messageContent) => {
    if (!messageContent.trim() || isLoading) return;

    // 用户发送新消息时，隐藏之前的反馈按钮
    setFeedbackableMessageId(null);

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: messageContent.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setShowSuggestions(false);
    setIsLoading(true);

    try {
      const data = await sendChatMessage(DEFAULT_RIDER_ID, messageContent.trim(), sessionId.current);

      if (data.data) {
        const assistantMessage = {
          id: Date.now() + 1,
          dbId: data.data.messageId, // 保存数据库消息ID用于反馈
          role: 'assistant',
          content: data.data.reply || data.data.response || '抱歉，我暂时无法理解您的问题。',
        };
        setMessages(prev => [...prev, assistantMessage]);

        // Assistant 消息到来时，显示反馈按钮
        setFeedbackableMessageId(assistantMessage.id);

        // 更新sessionId (如果后端返回了新的)
        if (data.data.sessionId) {
          sessionId.current = data.data.sessionId;
        }
      }
    } catch (error) {
      console.error('发送消息失败:', error);
      const errorMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: `抱歉，服务出现异常：${error.message}`,
      };
      setMessages(prev => [...prev, errorMessage]);
      setFeedbackableMessageId(errorMessage.id);
    } finally {
      setIsLoading(false);
    }
  };

  // 发送消息（从输入框）
  const handleSend = () => {
    sendMessage(input);
  };

  // 快捷建议点击 - 直接发送消息
  const handleSuggestionClick = async (suggestion) => {
    const text = suggestion.content || suggestion.title;

    // 记录点击
    try {
      await recordSuggestionClick(suggestion.id);
    } catch (error) {
      console.error('记录点击失败:', error);
    }

    // 直接发送消息
    sendMessage(text);
  };

  // 刷新建议
  const refreshSuggestions = async () => {
    try {
      setIsLoadingSuggestions(true);
      const data = await getSuggestions({ limit: 5, random: true });
      if (data.data && data.data.suggestions) {
        setSuggestions(data.data.suggestions);
      }
    } catch (error) {
      console.error('刷新建议失败:', error);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  // 语音输入
  const handleVoiceInput = () => {
    console.log('语音输入');
  };

  // 处理反馈点击
  const handleFeedback = async (clientMessageId, dbMessageId, isHelpful) => {
    // 如果已经点击过相同的反馈，不再重复提交
    if (feedbackState[clientMessageId] === (isHelpful ? 'helpful' : 'notHelpful')) {
      return;
    }

    // 更新UI状态
    setFeedbackState(prev => ({
      ...prev,
      [clientMessageId]: isHelpful ? 'helpful' : 'notHelpful'
    }));

    // 发送到后端 (使用数据库ID)
    try {
      await submitFeedback(dbMessageId, isHelpful);
      console.log('反馈提交成功', { dbMessageId, isHelpful });
    } catch (error) {
      console.error('反馈提交失败:', error);
      // 失败时回滚UI状态
      setFeedbackState(prev => {
        const newState = { ...prev };
        delete newState[clientMessageId];
        return newState;
      });
    }
  };

  return (
    <div className="customer-service">
      {/* 顶部欢迎卡片 */}
      {showSuggestions && messages.length === 1 && (
        <div className="welcome-section">
          <div className="welcome-card">
            <div className="welcome-header">
              <span className="welcome-icon">🤖</span>
              <h2 className="welcome-title">我是您的AI助手!</h2>
            </div>
            <p className="welcome-subtitle">有什么可以帮您的吗？</p>
          </div>

          {/* 猜你想问 */}
          <div className="suggestions-section">
            <div className="suggestions-header">
              <span className="suggestions-title">猜你想问:</span>
              <button
                className="refresh-btn"
                onClick={refreshSuggestions}
                disabled={isLoadingSuggestions}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{ animation: isLoadingSuggestions ? 'spin 1s linear infinite' : 'none' }}
                >
                  <path d="M23 4v6h-6M1 20v-6h6"/>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
                换一批
              </button>
            </div>
            <div className="suggestions-list">
              {isLoadingSuggestions ? (
                <div className="suggestions-loading">
                  <span className="dot"></span>
                  <span className="dot"></span>
                  <span className="dot"></span>
                </div>
              ) : suggestions.length > 0 ? (
                suggestions.map((suggestion) => (
                  <button
                    key={suggestion.id}
                    className="suggestion-item"
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    <span className="suggestion-text">
                      {suggestion.icon && <span className="suggestion-icon">{suggestion.icon}</span>}
                      {suggestion.title}
                    </span>
                    <svg className="suggestion-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                  </button>
                ))
              ) : (
                <p className="suggestions-empty">暂无推荐问题</p>
              )}
            </div>
          </div>

          {/* 待办和提醒卡片 */}
          <div className="cards-row">
            <div className="info-card todo-card">
              <div className="card-header">
                <span className="card-title">待办</span>
                <svg className="card-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </div>
              <p className="card-subtitle">暂无待办</p>
            </div>
            <div className="info-card reminder-card">
              <div className="card-header">
                <span className="card-title">提醒</span>
                <span className="notification-badge">1</span>
                <svg className="card-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </div>
              <p className="card-subtitle">天气预警</p>
            </div>
          </div>

          {/* 今日指南 */}
          <button className="guide-card">
            <svg className="guide-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span className="guide-text">今日指南</span>
          </button>
        </div>
      )}

      {/* 聊天区域 */}
      <div className={`chat-area ${!showSuggestions || messages.length > 1 ? 'expanded' : ''}`}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`message-row ${msg.role === 'user' ? 'user-row' : 'assistant-row'}`}
          >
            <div className={`message-bubble ${msg.role === 'user' ? 'user-bubble' : 'assistant-bubble'}`}>
              <div className="message-content">{msg.content}</div>

              {/* 只有 assistant 消息且是当前可反馈的消息才显示反馈按钮 */}
              {msg.role === 'assistant' && msg.id === feedbackableMessageId && msg.dbId && (
                <div className="feedback-buttons">
                  <button
                    className={`feedback-btn helpful ${feedbackState[msg.id] === 'helpful' ? 'active' : ''}`}
                    onClick={() => handleFeedback(msg.id, msg.dbId, true)}
                    title="有用"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                    </svg>
                    <span>有用</span>
                  </button>
                  <button
                    className={`feedback-btn not-helpful ${feedbackState[msg.id] === 'notHelpful' ? 'active' : ''}`}
                    onClick={() => handleFeedback(msg.id, msg.dbId, false)}
                    title="没用"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
                    </svg>
                    <span>没用</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* 加载中动画 */}
        {isLoading && (
          <div className="message-row assistant-row">
            <div className="message-bubble assistant-bubble loading">
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 底部输入区域 */}
      <div className="input-area">
        <button className="voice-btn" onClick={handleVoiceInput}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
          </svg>
        </button>
        <input
          type="text"
          className="message-input"
          placeholder="输入你想问的问题"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        />
        <button
          className={`send-btn ${input.trim() ? 'active' : ''}`}
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
          </svg>
        </button>
      </div>

      {/* 底部AI提示 */}
      <p className="ai-footer">内容由AI生成</p>
    </div>
  );
}
