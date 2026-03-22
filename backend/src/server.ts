// 必须在最前面加载环境变量
import 'dotenv/config';

// 然后再导入其他模块
import App from './index';
import logger from '@/utils/logger';
import { closeConnections } from '@/utils/db';

// 验证环境变量加载
if (!process.env.ZHIPU_API_KEY) {
  console.warn('⚠️  警告: ZHIPU_API_KEY 未配置,智谱AI功能将不可用');
} else {
  console.log('✅ 智谱AI API Key 已加载');
}

const app = new App();
const server = app.listen();

// 优雅关闭
const gracefulShutdown = async (signal: string) => {
  logger.info(`收到 ${signal} 信号,开始优雅关闭...`);

  try {
    // 关闭数据库连接
    await closeConnections();

    // 关闭HTTP服务器
    server.close(() => {
      logger.info('✅ 服务器已关闭');
      process.exit(0);
    });

    // 强制退出超时
    setTimeout(() => {
      logger.error('⚠️  强制退出超时');
      process.exit(1);
    }, 10000);
  } catch (error) {
    logger.error('关闭过程出错:', error);
    process.exit(1);
  }
};

// 监听退出信号
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 未捕获的异常
process.on('uncaughtException', (error) => {
  logger.error('未捕获的异常:', error);
  gracefulShutdown('uncaughtException');
});

// 未处理的Promise rejection
process.on('unhandledRejection', (reason, promise) => {
  logger.error('未处理的Promise rejection:', { reason, promise });
});
