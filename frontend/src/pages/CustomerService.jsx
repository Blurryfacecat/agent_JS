import { useState, useRef, useEffect } from "react";
import {
  sendChatMessageStream,
  getSuggestions,
  recordSuggestionClick,
  submitFeedback,
} from "../services/api";
import "./CustomerService.css";

// 默认骑手ID (实际应用中应从用户登录信息获取)
const DEFAULT_RIDER_ID = "rider_guest_001";

export default function CustomerService() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: "assistant",
      content: "您好！我是您的AI助手，请问有什么可以帮您？",
      dbId: null,
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(true);
  const [feedbackableMessageId, setFeedbackableMessageId] = useState(null);
  const [feedbackState, setFeedbackState] = useState({});
  const messagesEndRef = useRef(null);

  const sessionId = useRef(`session_${Date.now()}`);
  const riderLocation = useRef({ latitude: null, longitude: null });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 获取骑手位置（经纬度）
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          riderLocation.current = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
        },
        () => {
          console.log("获取位置失败，天气查询将使用默认位置");
        },
        { enableHighAccuracy: false, timeout: 5000 },
      );
    }
  }, []);

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
        console.error("加载猜你想问失败:", error);
        setSuggestions([
          { id: 1, title: "查看我的订单", content: "查看我的订单", icon: "📋" },
          { id: 2, title: "查询配送进度", content: "查询配送进度", icon: "📍" },
          { id: 3, title: "费用相关问题", content: "费用相关问题", icon: "💰" },
          { id: 4, title: "投诉与建议", content: "投诉与建议", icon: "💬" },
        ]);
      } finally {
        setIsLoadingSuggestions(false);
      }
    };

    loadSuggestions();
  }, []);

  // 发送消息（流式）
  const sendMessage = async (messageContent) => {
    if (!messageContent.trim() || isLoading) return;

    setFeedbackableMessageId(null);

    const userMessage = {
      id: Date.now(),
      role: "user",
      content: messageContent.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setShowSuggestions(false);
    setIsLoading(true);

    const assistantMsgId = Date.now() + 1;
    setMessages((prev) => [
      ...prev,
      {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        dbId: null,
        streaming: true,
      },
    ]);

    let fullContent = "";

    await sendChatMessageStream(
      DEFAULT_RIDER_ID,
      messageContent.trim(),
      sessionId.current,
      riderLocation.current,
      {
        onSession: (newSessionId) => {
          sessionId.current = newSessionId;
        },
        onMessage: (content) => {
          fullContent += content;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? { ...msg, content: fullContent }
                : msg,
            ),
          );
        },
        onDone: (data) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? { ...msg, dbId: data.messageId, streaming: false }
                : msg,
            ),
          );
          setFeedbackableMessageId(assistantMsgId);
          setIsLoading(false);
        },
        onError: (error) => {
          console.error("流式消息错误:", error);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    content:
                      fullContent || `抱歉，服务出现异常：${error.message}`,
                    streaming: false,
                  }
                : msg,
            ),
          );
          setIsLoading(false);
        },
      },
    );
  };

  const handleSend = () => {
    sendMessage(input);
  };

  const handleSuggestionClick = async (suggestion) => {
    const text = suggestion.content || suggestion.title;
    try {
      await recordSuggestionClick(suggestion.id);
    } catch (error) {
      console.error("记录点击失败:", error);
    }
    sendMessage(text);
  };

  const refreshSuggestions = async () => {
    try {
      setIsLoadingSuggestions(true);
      const data = await getSuggestions({ limit: 5, random: true });
      if (data.data && data.data.suggestions) {
        setSuggestions(data.data.suggestions);
      }
    } catch (error) {
      console.error("刷新建议失败:", error);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const handleVoiceInput = () => {
    console.log("语音输入");
  };

  const handleFeedback = async (clientMessageId, dbMessageId, isHelpful) => {
    if (
      feedbackState[clientMessageId] === (isHelpful ? "helpful" : "notHelpful")
    ) {
      return;
    }

    setFeedbackState((prev) => ({
      ...prev,
      [clientMessageId]: isHelpful ? "helpful" : "notHelpful",
    }));

    try {
      await submitFeedback(dbMessageId, isHelpful);
    } catch (error) {
      console.error("反馈提交失败:", error);
      setFeedbackState((prev) => {
        const newState = { ...prev };
        delete newState[clientMessageId];
        return newState;
      });
    }
  };

  return (
    <div className="customer-service">
      {/* 欢迎页 */}
      {showSuggestions && messages.length === 1 && (
        <div className="welcome-section">
          {/* 欢迎气泡 */}
          <span className="welcome-card">我是您的AI助手！</span>

          {/* 猜你想问 */}
          <div className="suggestions-section">
            <div className="suggestions-header">
              <span className="suggestions-title">猜你想问：</span>
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
                  style={{
                    animation: isLoadingSuggestions
                      ? "spin 1s linear infinite"
                      : "none",
                  }}
                >
                  <path d="M23 4v6h-6M1 20v-6h6" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
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
                suggestions.map((suggestion, index) => (
                  <button
                    key={suggestion.id}
                    className="suggestion-item"
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    <div className="suggestion-left">
                      <span className="suggestion-number">{index + 1}、</span>
                      <span className="suggestion-question">
                        {suggestion.title}
                      </span>
                    </div>
                    <svg
                      className="suggestion-icon"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </button>
                ))
              ) : (
                <p className="suggestions-empty">暂无推荐问题</p>
              )}
            </div>
          </div>

          {/* 待办 + 提醒 */}
          <div className="cards-row">
            <div className="info-card">
              <div className="card-header">
                <span className="card-title">待办</span>
                <svg
                  className="card-arrow"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>
              <p className="card-subtitle">暂无待办</p>
            </div>
            <div className="info-card">
              <div className="card-header">
                <div className="card-title-group">
                  <span className="card-title">提醒</span>
                  <span className="notification-badge">1</span>
                </div>
                <svg
                  className="card-arrow"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>
              <p className="card-subtitle">天气预警</p>
            </div>
          </div>

          {/* 今日指南 */}
          <button className="guide-card">
            <svg
              className="guide-icon"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span className="guide-text">今日指南</span>
          </button>
        </div>
      )}

      {/* 聊天区域 */}
      <div
        className={`chat-area ${!showSuggestions || messages.length > 1 ? "expanded" : ""}`}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`message-row ${msg.role === "user" ? "user-row" : "assistant-row"}`}
          >
            <div
              className={`message-bubble ${msg.role === "user" ? "user-bubble" : "assistant-bubble"}`}
            >
              <div className="message-content">{msg.content}</div>

              {msg.role === "assistant" &&
                msg.id === feedbackableMessageId &&
                msg.dbId &&
                !msg.streaming && (
                  <div className="feedback-buttons">
                    <button
                      className={`feedback-btn helpful ${feedbackState[msg.id] === "helpful" ? "active" : ""}`}
                      onClick={() => handleFeedback(msg.id, msg.dbId, true)}
                      title="有用"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                      </svg>
                      <span>有用</span>
                    </button>
                    <button
                      className={`feedback-btn not-helpful ${feedbackState[msg.id] === "notHelpful" ? "active" : ""}`}
                      onClick={() => handleFeedback(msg.id, msg.dbId, false)}
                      title="没用"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
                      </svg>
                      <span>没用</span>
                    </button>
                  </div>
                )}
            </div>
          </div>
        ))}

        {/* 流式光标 */}
        {isLoading && messages[messages.length - 1]?.streaming && (
          <div className="streaming-cursor" />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 底部输入区域 */}
      <div className="input-area">
        <button className="voice-btn" onClick={handleVoiceInput}>
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 1C10.34 1 9 2.34 9 4V11C9 12.66 10.34 14 12 14C13.66 14 15 12.66 15 11V4C15 2.34 13.66 1 12 1Z" />
            <path d="M19 10V11C19 15.42 15.42 19 11 19C6.58 19 3 15.42 3 11V10" />
            <path d="M12 19V23" />
          </svg>
        </button>
        <input
          type="text"
          className="message-input"
          placeholder="输入你想问的问题"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <button
          className={`send-btn ${input.trim() ? "active" : ""}`}
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
        </button>
      </div>

      {/* 底部AI提示 */}
      <p className="ai-footer">内容由AI生成</p>
    </div>
  );
}
