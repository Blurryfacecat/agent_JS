/**
 * 骑手智能客服 - 工具函数设计
 *
 * 为 LangChain Agent 提供的工具函数集合
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import logger from '@/utils/logger';

// ============ 工具函数定义 ============

/**
 * 1. 订单查询工具
 * 查询骑手的订单状态和历史记录
 */
export const queryOrderTool = new DynamicStructuredTool({
  name: 'query_order',
  description: `查询骑手订单信息。当用户询问以下问题时使用：
  - "我的订单在哪里"
  - "今天有几单"
  - "订单状态查询"
  - "查看配送进度"

  返回订单数量、进行中订单、已完成订单等信息。`,
  schema: z.object({
    riderId: z.string().describe('骑手ID'),
    status: z.enum(['all', 'delivering', 'completed', 'cancelled']).optional().describe('订单状态筛选'),
  }),
  func: async ({ riderId, status = 'all' }) => {
    logger.info('工具调用: query_order', { riderId, status });

    // TODO: 实际应该从数据库查询
    // 这里返回模拟数据
    const mockOrders = {
      all: { total: 28, delivering: 2, completed: 25, cancelled: 1 },
      delivering: { count: 2, orders: ['订单#12345 配送中', '订单#12346 待取货'] },
      completed: { count: 25, todayIncome: 458.5 },
      cancelled: { count: 1, reason: '商家取消' },
    };

    return JSON.stringify({
      riderId,
      queryTime: new Date().toISOString(),
      ...mockOrders[status],
    });
  },
});

/**
 * 2. 收入查询工具
 * 查询骑手收入和提现记录
 */
export const queryIncomeTool = new DynamicStructuredTool({
  name: 'query_income',
  description: `查询骑手收入信息。当用户询问以下问题时使用：
  - "今天赚了多少钱"
  - "我的收入"
  - "可以提现吗"
  - "提现记录"

  返回今日收入、本周收入、可提现金额等信息。`,
  schema: z.object({
    riderId: z.string().describe('骑手ID'),
    period: z.enum(['today', 'week', 'month', 'all']).optional().describe('查询周期'),
  }),
  func: async ({ riderId, period = 'today' }) => {
    logger.info('工具调用: query_income', { riderId, period });

    const mockIncome = {
      today: { amount: 156.5, orders: 12, bonus: 15 },
      week: { amount: 892.0, orders: 68, bonus: 89 },
      month: { amount: 3250.0, orders: 256, bonus: 320 },
      all: { amount: 12580.0, withdrawable: 856.5 },
    };

    return JSON.stringify({
      riderId,
      period,
      queryTime: new Date().toISOString(),
      ...mockIncome[period],
    });
  },
});

/**
 * 3. 罚单申诉工具
 * 查询罚单或提交申诉
 */
export const penaltyAppealTool = new DynamicStructuredTool({
  name: 'penalty_appeal',
  description: `查询罚单或提交申诉。当用户询问以下问题时使用：
  - "为什么罚我款"
  - "申诉罚单"
  - "罚单查询"
  - "这个罚单不合理"

  可用于查询罚单详情或提交申诉材料。`,
  schema: z.object({
    riderId: z.string().describe('骑手ID'),
    action: z.enum(['query', 'appeal']).describe('操作类型: query查询, appeal申诉'),
    penaltyId: z.string().optional().describe('罚单ID（申诉时必填）'),
    reason: z.string().optional().describe('申诉理由'),
  }),
  func: async ({ riderId, action, penaltyId, reason }) => {
    logger.info('工具调用: penalty_appeal', { riderId, action, penaltyId });

    if (action === 'query') {
      // 查询罚单
      const mockPenalties = [
        { id: 'P001', amount: -20, reason: '超时未送达', date: '2026-03-23', status: 'pending' },
        { id: 'P002', amount: -10, reason: '配送路线偏离', date: '2026-03-20', status: 'appealed' },
      ];
      return JSON.stringify({ riderId, penalties: mockPenalties });
    } else {
      // 提交申诉
      if (!penaltyId || !reason) {
        return JSON.stringify({ error: '申诉时需要提供罚单ID和申诉理由' });
      }
      return JSON.stringify({
        success: true,
        message: `已提交罚单 ${penaltyId} 的申诉，申诉理由：${reason}`,
        appealId: `A${Date.now()}`,
      });
    }
  },
});

/**
 * 4. 知识库搜索工具
 * 搜索FAQ和帮助文档
 */
export const searchKnowledgeTool = new DynamicStructuredTool({
  name: 'search_knowledge',
  description: `搜索知识库中的FAQ和帮助文档。当用户询问以下问题时使用：
  - "如何申诉"
  - "配送规则是什么"
  - "怎么联系客服"
  - "账号被封了怎么办"

  从知识库中搜索相关文档和常见问题解答。`,
  schema: z.object({
    query: z.string().describe('搜索关键词或问题'),
    category: z.string().optional().describe('分类筛选（可选）'),
  }),
  func: async ({ query, category }) => {
    logger.info('工具调用: search_knowledge', { query, category });

    // TODO: 实际应该从数据库或向量库搜索
    // 这里返回模拟数据
    const mockKnowledge = [
      {
        title: '如何申诉罚单',
        category: '罚单申诉',
        content: '1. 进入"我的"->"罚单记录" 2. 选择要申诉的罚单 3. 点击"申诉"并填写理由 4. 提交等待审核',
      },
      {
        title: '配送时间规则',
        category: '配送规则',
        content: '普通订单配送时间30分钟，恶劣天气可延长15分钟。如遇特殊情况请联系客服报备。',
      },
    ];

    return JSON.stringify({
      query,
      results: mockKnowledge.filter((k) =>
        !category || k.category === category
      ),
    });
  },
});

/**
 * 5. 人工客服转接工具
 * 转接到人工客服
 */
export const transferToHumanTool = new DynamicStructuredTool({
  name: 'transfer_to_human',
  description: `转接到人工客服。当用户有以下需求时使用：
  - "转人工"
  - "我要投诉"
  - "机器解决不了"
  - "找真人说话"

  将对话转接给人工客服处理。`,
  schema: z.object({
    reason: z.string().describe('转人工的原因'),
    priority: z.enum(['low', 'medium', 'high']).optional().describe('优先级'),
  }),
  func: async ({ reason, priority = 'medium' }) => {
    logger.info('工具调用: transfer_to_human', { reason, priority });

    return JSON.stringify({
      success: true,
      message: '已为您转接到人工客服，请稍候...',
      ticketId: `T${Date.now()}`,
      priority,
      estimatedWaitTime: priority === 'high' ? '< 1分钟' : '3-5分钟',
    });
  },
});

// ============ 工具列表导出 ============

export const riderTools = [
  queryOrderTool,
  queryIncomeTool,
  penaltyAppealTool,
  searchKnowledgeTool,
  transferToHumanTool,
];

// 工具描述（用于 prompt）
export const toolsDescription = `
可用工具列表：
1. query_order - 查询订单信息（订单状态、数量等）
2. query_income - 查询收入信息（今日/本周/本月收入）
3. penalty_appeal - 查询罚单或提交申诉
4. search_knowledge - 搜索知识库FAQ和帮助文档
5. transfer_to_human - 转接到人工客服

使用工具时请注意：
- 根据用户问题选择合适的工具
- 工具返回的是JSON格式数据，请转换为友好的语言回复用户
- 如果工具无法解决问题，建议转人工客服
`;
