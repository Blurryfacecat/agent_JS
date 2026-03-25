import express, { Application } from "express";
import { Server } from "http";
import cors from "cors";
import helmet from "helmet";
import config from "@/config";
import logger from "@/utils/logger";
import { errorHandler, notFoundHandler } from "@/middleware/errorHandler";
import healthRouter from "@/routes/health";
import chatRouter from "@/routes/chat";
import knowledgeRouter from "@/routes/knowledge";
import feedbackRouter from "@/routes/feedback";
import documentsRouter from "@/routes/documents";

class App {
  public app: Application;

  constructor() {
    this.app = express();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares(): void {
    // 安全头
    this.app.use(helmet());

    // 跨域
    this.app.use(
      cors({
        origin: "*",
        credentials: true,
      }),
    );

    // 解析JSON
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // 请求日志
    this.app.use((req, _res, next) => {
      logger.info(`${req.method} ${req.url}`, {
        query: req.query,
        body: req.body,
      });
      next();
    });
  }

  private initializeRoutes(): void {
    // 健康检查路由
    this.app.use("/", healthRouter);

    // API路由
    this.app.use(config.apiPrefix, chatRouter);
    this.app.use(`${config.apiPrefix}/knowledge`, knowledgeRouter);
    this.app.use(`${config.apiPrefix}/feedback`, feedbackRouter);
    this.app.use(`${config.apiPrefix}/documents`, documentsRouter);
  }

  private initializeErrorHandling(): void {
    // 404处理
    this.app.use(notFoundHandler);

    // 全局错误处理
    this.app.use(errorHandler);
  }

  public listen(): Server {
    return this.app.listen(config.port, () => {
      logger.info(`🚀 服务器启动成功`);
      logger.info(`📝 环境: ${config.nodeEnv}`);
      logger.info(`🌐 端口: ${config.port}`);
      logger.info(`📍 API前缀: ${config.apiPrefix}`);

    });
  }
}

export default App;
