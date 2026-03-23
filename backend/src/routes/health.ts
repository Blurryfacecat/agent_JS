import { Router } from "express";
import { successResponse } from "@/utils/response";
import logger from "@/utils/logger";

const router = Router();

/**
 * 健康检查接口
 */
router.get("/health", (_req, res) => {
  logger.info("健康检测---------------");
  successResponse(res, {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
  });
});

/**
 * 版本信息接口
 */
router.get("/version", (_req, res) => {
  successResponse(res, {
    name: "rider-cs-backend",
    version: "1.0.0",
    description: "外卖骑手智能客服系统后端服务",
  });
});

export default router;
