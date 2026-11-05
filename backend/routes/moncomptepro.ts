import cookieParser from "cookie-parser"
import moncompteproController from "../controllers/moncomptepro.js"
import { Express } from "express"
import { rateLimit } from "express-rate-limit"
import { asyncHandler } from "../lib/async-handler.js"

const moncompteproRoutes = function (api: Express) {
  const loginRateLimiter = rateLimit({
    windowMs: 900000, // 15 minutes
  })
  api.get(
    "/login",
    cookieParser(),
    loginRateLimiter,
    asyncHandler(moncompteproController.login),
  )
  api.get(
    "/auth/redirect",
    cookieParser(),
    moncompteproController.access,
    moncompteproController.loginCallbackRedirect,
  )
  api.get("/logout", moncompteproController.logout)
}
export default moncompteproRoutes
