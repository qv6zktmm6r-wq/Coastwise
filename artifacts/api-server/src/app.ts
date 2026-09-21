import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import { CLERK_PROXY_PATH, clerkProxyMiddleware, getClerkProxyHost } from "./middlewares/clerkProxyMiddleware";

const app: Express = express();

app.set("trust proxy", 1);
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(cors((req, callback) => {
  const origin = req.header("Origin");
  if (!origin) {
    callback(null, { credentials: true, origin: false });
    return;
  }

  try {
    const forwardedHost = req.header("X-Forwarded-Host")?.split(",")[0]?.trim();
    const requestHost = forwardedHost || req.header("Host") || "";
    const originUrl = new URL(origin);
    const isSameHost = originUrl.host === requestHost;
    const isLocalDevelopment = process.env.NODE_ENV !== "production"
      && ["localhost", "127.0.0.1"].includes(originUrl.hostname);
    callback(null, {
      credentials: true,
      origin: isSameHost || isLocalDevelopment ? origin : false,
    });
  } catch {
    callback(null, { credentials: true, origin: false });
  }
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(clerkMiddleware((req) => ({
  publishableKey: publishableKeyFromHost(getClerkProxyHost(req) ?? "", process.env.CLERK_PUBLISHABLE_KEY),
})));

app.use("/api", router);

export default app;
