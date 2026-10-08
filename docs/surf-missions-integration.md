# Renaiss × Surf 任務串接

更新：2026-10-08。使用 Renaiss SSO 已綁定信箱自動查 Surf，兩邊必須使用同一信箱；不以 `email_verified` 作為門檻。缺少信箱或格式不正確時顯示提醒並導向官方帳號設定；沒有自行寄碼或寄信服務依賴。正式服務已補齊 Surf、X、Discord 查核配置並重新啟動；本人登入後 Surf 帳號查核已通過，X／Discord 尚需本人授權與完成查核。未啟動抽獎或發獎。

## 活動依據與規則

- Gavin 指定 Surf 帳號由 Surf 提供的服務端 API 判定，不另建 Surf 登入驗證。
- [Surf × Renaiss 執行方案 V1](https://app.notion.com/p/Surf-Renaiss-V1-3e70aa3f12a281aba2b2ce5c7604d7d1) 已讀取。文件是活動背景，不是部署、發獎或額外帳號操作的授權。
- [Surf 官方 X](https://x.com/SurfAIHQ) 的 numeric ID 已以官方 API 確認並固定為 `2064498034822828032`。
- 官方 Discord invite `https://discord.gg/Bc76WjteSf` 指向 Surf，Guild ID `1509589929846640761`。公開 invite 資料只能確認目的地，不能證明參加者已加入。

| 任務 | 判定來源 | 規劃抽獎機會 |
| --- | --- | --- |
| 擁有 Renaiss + Surf 帳號 | 有效 Renaiss SSO + 回傳有效信箱 + Surf 帳號 API | 必做，1 次 |
| Follow Surf X | 參加者的 X OAuth token + Surf 帳號的 `connection_status` | 選做，+1 次 |
| Join Surf Discord | 參加者的 Discord OAuth token + 官方 Guild member API | 選做，+1 次 |

既有帳號、已追蹤與已加入者可查核；沒有增加「追蹤 Renaiss」條件。抽獎票以持久化的 `participation.ticketCount` 為準：有效錢包且帳號任務通過後，每項完成任務 1 張，最多 3 張。已通過任務不會因查核快取過期而失去票數；尚未通過且無法查核的任務不給票。`entries` 是查核快取的摘要，不能取代持久化參加者表格，也不是 SBT、商品權益或獎品。

文件的截止日與「實際上線順延」描述存在未定資訊，因此活動仍為 integration，不用未確認日期自動啟動。活動池 7 個 Mystery Box + 20 個月 Pro Trial，與商店池 3 個 Mystery Box + 20 個月 Pro Trial 分開；兌換門檻、活動時間與聯名 SBT 領取仍待正式公告。

## 已接好的完整流程

1. 參加者登入 Renaiss，以經驗證的 OIDC `sub` 作身分。
2. 活動視窗顯示「連接並驗證」。X 需與 Renaiss 綁定的 X 帳號相同。
3. 服務端建立一次性 OAuth challenge，綁定 session ID、sub、provider、cookie、到期時間與精確 callback；X 使用 PKCE S256。
4. callback 消耗 challenge，交換 token，讀取平台的目前使用者；再次確認 Renaiss session 仍有效，再連接和查核。
5. token 加密留在服務端，結果存入 SQLite。頁面显示已驗證、尚未完成、待確認規則、需重授權或無法查核，以及最近查核時間。
6. 完成紀錄、身分與票數保存到參加者表格。已通過任務不再查詢上游，也不能更換帳號或解除連接；刷新與查核快取過期不會清除完成狀態。尚未通過者才可重新驗證。

| HTTP route | 用途 |
| --- | --- |
| `GET /api/missions/surf` | 讀取本人狀態；訪客僅取得配置與未登入狀態 |
| `POST /api/missions/surf/accounts/verify` | 只使用目前 Renaiss SSO 回傳的有效信箱查核 Surf；首次／過期自動查核，也可手動重查 |
| `POST /api/missions/surf/{x\|discord}/connect` | 建立授權連結 |
| `GET /auth/{x\|discord}/callback` | 完成授權、連接、查核並返回活動 |
| `POST /api/missions/surf/{x\|discord}/verify` | 查核已連接帳號 |
| `POST /api/missions/surf/{x\|discord}/disconnect` | 刪除本人連接及查核結果 |

POST 檢查同源 Origin 和 Renaiss session，Demo 被拒絕。前端不能提交可信任的完成旗標、access token、任意參加者 ID 或驗證目標。callback 的取消、session 不符、過期、重播與登入途中登出均不建立有效連接。

## X：單次查詢 `connection_status`

沿用 `renaiss-merch` App（`33484488`），Web App confidential client，Read 權限。OAuth scope 為 `tweet.read users.read follows.read offline.access`，沒有寫入追蹤、貼文或私訊的權限。

2026-10-08 依 Gavin 指示，改成與 football 相同的單次目標帳號查詢，降低回傳資源數與 X API 成本。2026-10-06 曾實測 Surf 回應省略 `connection_status`，因此欄位缺席仍不能推論未追蹤：

- 先查 `/2/users/me`，確認 numeric ID 與連接紀錄、X username 與 Renaiss 綁定一致。
- 只查一次 `/2/users/by/username/SurfAIHQ?user.fields=connection_status,username`，並確認回傳 ID 與固定 Surf ID 相同。
- 有效 `connection_status` 陣列包含 `following` 才通過；有效陣列未包含 `following` 才判為未追蹤。
- 缺欄位、格式錯誤、目標不符、partial errors、401、403、429 都不通過。缺欄位顯示「X 未提供追蹤關係，這次無法驗證」。沒有 following 清單查詢或其他 runtime fallback。
- 未完成者一次查核最多讀取兩個使用者物件：本人身分與 Surf 目標。每次 API timeout 10 秒。OAuth callback 另有平台身分查詢。
- 已通過者直接沿用持久化的完成紀錄，不重新呼叫 X；沒有更改既有票數或已鎖定的身分。
- 本次本機測試使用注入回應，沒有呼叫付費 X API；不能據此宣稱目前 Surf 上游一定提供關係欄位。

X App 已保存並讀回確認三個 callback：

- `https://merch.renaisscltb.com/auth/x/callback`
- `http://localhost:5173/auth/x/callback`
- `http://127.0.0.1:5173/auth/x/callback`

官方依據：[X OAuth PKCE](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code)、[目標帳號查詢與 connection_status 欄位](https://docs.x.com/x-api/users/get-user-by-username)、[X API 計費](https://docs.x.com/x-api/getting-started/pricing)。

## Discord：使用者 OAuth，不需 bot

申請 `identify guilds.members.read`，不申請 email、全伺服器清單或自動加群權限。讀取 `/api/v10/users/@me` 後，使用同一 token 查 `/api/v10/users/@me/guilds/1509589929846640761/member`。會員 ID、加入時間與格式需有效；官方 Unknown Member（404/code 10007）判定尚未加入。

真實未加入者的這個端點回應是 Unknown Guild（404/code 10004）。此代碼也可能表示目標錯誤，因此服務端額外查詢固定公開 invite，確認其 guild ID 仍等於活動目標，才判定尚未加入。公開 invite 請求不帶參加者 token；它僅確認目標，不能證明會員資格。目標不符、invite 查詢失敗、其他 404、限流或無效會員回應一律無法通過。這是對真實 absence 回應的限定判定，沒有另設替代會員驗證来源。

`SURF_DISCORD_REQUIRE_SCREENING` 必須明確是 `true` 或 `false`。本機設定 `false`，對應目前指定的「加入」條件，未自行增加通過伺服器規則的任務。若正式規則改成 `true`，`pending=true` 要先完成規則確認；缺 pending 欄位無法通過。政策變更會使先前不同政策的結果失效。

Discord App 已建立為 `renaiss community`，Client ID `1557039188212326553`，維持 confidential client。已保存正式站與兩個本機 callback：

- `https://merch.renaisscltb.com/auth/discord/callback`
- `http://localhost:5173/auth/discord/callback`
- `http://127.0.0.1:5173/auth/discord/callback`

帳號持有者已完成 Discord 多重認證，client secret 已存入 Git/Docker 忽略的本機後端環境檔（權限 0600）。真實使用者授權已返回 localhost callback 並保存連接；再次查核正確顯示「尚未加入 Surf」。沒有替使用者加入 Surf，也未以 mock 測試宣稱真實已加入者通過。

官方依據：[Discord OAuth2](https://docs.discord.com/developers/topics/oauth2)、[Current User Guild Member](https://docs.discord.com/developers/resources/user)、[Discord error codes](https://docs.discord.com/developers/topics/opcodes-and-status-codes)。10004 的限定判定依據為本次真實 API 回應與固定 invite 的獨立目標確認。

## 模組與持久化

- `server/missions/config.mjs`：provider 配置、callback 和 returnTo 驗證、Discord 規則。
- `server/missions/routes.mjs`：HTTP/OAuth 路由及 session/Origin/state 綁定。
- `server/missions/oauth.mjs`：交換／更新 token、平台身分、Renaiss X 比對。
- `server/missions/service.mjs`：串接 refresh、verifier 和結果儲存；沒有發獎邏輯。
- `server/missions/accounts.mjs`：Renaiss 已綁定信箱與 Surf 查核、結果綁定、機會數計算。
- `src/components/RenaissHub/SurfEmailWarning.tsx`：缺少信箱／驗證證據的提醒，連到已確認的官方 `/profile/settings`；完成後重新登入更新身分。
- `server/missions/surf-config.mjs`、`surf-rate-store.mjs`：私密配置、跨本機程序協調 300 次／分鐘與上游 Retry-After。
- `server/missions/providers/`：上游請求與 X／Discord 查核。
- `server/missions/store.mjs`：challenge、連接、結果、持久操作鎖與 10 秒重查冷卻。
- `server/auth-secret-box.mjs`：AES-256-GCM；每筆隨機 IV，AAD 綁定紀錄身分。
- `server/auth-session-database.mjs`、`server/auth-challenge-database.mjs`：Renaiss 登入 session 與一次性 challenge 不再放 Map。cookie ID 只保存 hash，challenge payload 加密；不保存 Renaiss 上游 token。
- `src/components/RenaissHub/useSurfMissions.ts`、`SurfSocialTask.tsx`：狀態讀取、OAuth 返回、操作與結果 UI；嵌入現有活動視窗。

同一活動內 numeric X/Discord ID 只能連接一位 Renaiss 參加者。SQLite 使用既有 Merch 資料庫與備份；持久磁碟與穩定加密 key 是必要配置。支援同一資料庫上的操作協調，不代表多主機各自 SQLite 已能共用狀態。跨主機多副本需改用共用資料庫。

## 後端配置

| 環境變數 | 要求 |
| --- | --- |
| `MISSIONS_TOKEN_ENCRYPTION_KEY` | 穩定的 32-byte key，以標準 base64 保存；社群 token 與 Renaiss 登入 challenge 共用加密模組，正式登入也需配置 |
| `X_CLIENT_ID`、`X_CLIENT_SECRET` | 現有 Merch App，僅後端 |
| `DISCORD_CLIENT_ID`、`DISCORD_CLIENT_SECRET` | `renaiss community` App，本機與正式服務端均已設定，僅後端 |
| `X_REDIRECT_URI`、`DISCORD_REDIRECT_URI` | 可空白，精確從本站 origin 推導；顯式值必須與本站 origin/path 一致 |
| `PUBLIC_APP_ORIGIN` | production 必填，HTTPS 正式本站 origin |
| `SURF_DISCORD_REQUIRE_SCREENING` | 必填 `true` 或 `false` |
| `SURF_PARTNER_KEY` 或 `SURF_PARTNER_KEY_FILE` | 二擇一，Surf 提供的私密 Partner Key；本機已保存於 Git／Docker 忽略的 `.secrets/surf-partner/key`（0600） |
| `DEV_RENAISS_LOGIN_ORIGIN` | 本機 `http://localhost:5173`；production 忽略 |

Renaiss SSO 已 allowlist localhost callback，127.0.0.1 被拒絕。本機登入 start 先導向 localhost，再寫 cookie，避免跨主機 cookie 遺失。另查出本機 Renaiss Client Secret 過期／不符正式服務，已只同步本機成現有 Merch 正式值，沒有更換正式金鑰。正式回呼配置與現有 Renaiss OIDC 交換方法保持不變。

加密 key 不可因重啟而重生，不能刪除／更換 key 後把解密失敗隱藏成訪客或已通過；輪替需明確資料遷移。憑證僅存於 Git 忽略的本機後端環境檔或 Zeabur 服務端環境變數，未進 bundle、文件、review 截圖或 Git。2026-10-08 正式服務補齊 Surf Partner Key、X／Discord OAuth 憑證與 Discord 規則並重啟後，匿名任務 API 的三項配置旗標均為 `true`；已登入頁面的 Surf 帳號自動查核為通過，顯示 1 / 3 次機會。

## Surf API 與 Renaiss 已綁定信箱

依 Gavin 提供的 2026-10-06 Surf Account Verification API 文件，後端以 `X-Partner-Key` 呼叫 `POST https://api.asksurf.ai/muninn/v1/partner/users/registration-check`，JSON 只有 `email`。HTTP 200 的 `registered` 必須是 boolean；true 代表有效帳號，false 包括未註冊、關閉或停用。400、401、429、500、無效回應與逾時都是無法查核，不能假判未註冊或通過。

2026-10-08 Gavin 指定：只要經驗證的 Renaiss SSO 身分回傳有效 `email`，就自動送 Surf 查核，不論 `emailVerified` 為 true、false 或未提供驗證證據。這是已綁定信箱的查核規則，不宣稱已驗證信箱所有權。使用者不可另外輸入／覆寫信箱；不再開放 code、confirm 路由，移除 OTP／Resend 模組與配置需求，不加替代驗證來源。

首次載入或結果過期時，前端自動查核；API 用 `emailLinked` 表示 SSO 已回傳有效信箱。缺少信箱或格式錯誤會自動開啟可關閉的提醒，導向已在官方 UI 確認的 `https://www.renaiss.xyz/profile/settings`。綁定後回來重新登入，才能取得新資料。首頁顯示完整信箱與「已綁定」，Surf 仍以 API 的實際 `registered` 結果判定。

Surf 結果仍以 15 分鐘為上限。結果綁定規則版本 `renaiss-linked-email-v2`、信箱 keyed hash 與 Partner Key；舊 OTP／已驗證信箱規則的結果、變更信箱、缺少有效信箱或更換 Key 都不保留舊通過資格。查核前後重新檢查 session、sub 與信箱，查核途中登出／切換身分不能保存有效結果。活動內同一正規化信箱只能連接一位參加者；API 未提供穩定 Surf user ID，因此不能宣稱已按 Surf user ID 去重。

2026-10-08 正式 Merch session 已確認回傳信箱與 `unverified`，對應明確的 `email_verified=false`，不是缺欄位；官方設定同時顯示已綁定。依新的已綁定信箱規則，這個旗標不再阻擋 Surf 查核，也不把 false 改為 true。SSO 正規化另外保留 `emailVerificationStatus`，區分明確 false 與未知欄位。保留既有 SQLite 表資料，不作破壞性刪除；退休的 OTP 表已不再由程式使用。

2026-10-08 驗證：使用此次正式 session 已取得的信箱與 false 驗證旗標，透過更新後的 `checkAccounts` 呼叫真實 Surf API，回傳 verified；結果僅存在記憶體 SQLite，沒有寫入正式任務紀錄。HTTP 整合確認 false／缺少／true 旗標均可查核，前端任意信箱不會取代 SSO 信箱；缺少／格式錯誤信箱、重複信箱、途中登出或變更信箱、Demo 仍拒絕，Surf 回傳未註冊仍為 0 次。1512×982／390×844 的本機注入預覽確認地址與已綁定狀態、長地址換行、雙語切換、自動查核與手動重查，沒有 console error。完整 build、媒體檢查及 diff check 通過，未新增永久測試腳本或測試資料庫。

以下保留 2026-10-07 的舊規則實測紀錄，不代表目前要求 `emailVerified === true`。

2026-10-07：SSO-only HTTP 整合測試通過：缺少／未驗證／未知證據、拒絕前端信箱與完成旗標、驗證中登出／換信箱／失去驗證、信箱去重、過期與退休 OTP 結果不通過、退休路由 404、0／1／未確認機會數。簽署 JWT 與本機 JWKS/userinfo 測試確認 true／false／缺欄位各自處理，subject 不符拒絕。使用記憶體 SQLite 與 stdin，沒有永久測試檔案。尚未有真實已驗證信箱 + 有效 Surf 帳號的通過案例。

桌面真實 Aside 提醒已檢查；獨立瀏覽器注入測試在 1512／390／360 px 確認提醒自動開啟、尺寸不溢出、Escape 與按鈕關閉／重開、無信箱／驗證碼輸入、官方設定連結；已驗證信箱會自動 POST 一次且不帶前端信箱，手動重查可用。截圖保留於 `work/reviews/surf-sso-email-2026-10-07/`，手機圖為注入狀態的版面檢查，不是真實 Surf 通過證據。

## 2026-10-06 實測紀錄

- 真實 Renaiss SSO：修正本機憑證後登入成功，取得與目前 X 授權帳號一致的連接身分。
- 真實 X OAuth：從活動頁連接、X 授權、localhost callback 返回活動，保存並顯示 `not_following`。未自行追蹤 Surf。
- 再次按「驗證任務」更新查核時間；重新整理頁面與重啟 Node 後，Renaiss session、X 連接和查核結果仍保留。
- 真實 X API：已追蹤的對照帳號回傳 verified；Surf 完整兩頁清單後回傳 incomplete/not_following。僅用暫時只讀使用者 token，測試後已在 X Console 撤銷該測試 access/refresh token，刪除臨時 token 檔。正式活動連接的 token 仍加密保存供重新驗證，不與測試 token 混用。
- 真實 Discord OAuth：`renaiss community` 僅要求兩個預期 scope，授權後回到 localhost，保存 Discord 身分與加密連接。釐清 404/code 10004 後，再次按「驗證任務」正確顯示 incomplete/not_a_member 與查核時間。沒有改變使用者的伺服器會員資格。
- 23:18（Asia/Taipei）再次使用既有有效 Renaiss session 和已保存的 Discord 授權，呼叫同一後端 `checkMission`：仍為 incomplete/not_a_member，結果已更新並保存，`entries` 仍為 null。此輪 Mac 鎖定，尚未在 Aside 點擊／截圖重驗；真實 Surf 成員成功案例仍待使用者加入後查核。
- 注入 provider 回應的 HTTP 整合：X PKCE、Discord scope、session／CSRF／state／重播拒絕、追蹤與加入／離開、結果保存、refresh、screening、去重、限流、disconnect、Demo 拒絕均通過。這些測試不能替代真實已加入 Surf 者的查核。
- Discord absence 回應的 stdin 測試：10004 + 固定 invite 目標一致才為未加入；目標不符、invite 限流、一般 404 與無效會員身分均不可通過；10007 未加入與有效會員 200 仍保持既有判定。公開 invite 請求沒有 Authorization header。無永久測試檔案。
- 記憶體 SQLite：加密、錯誤 key、session/challenge 綁定、一次性／到期、重新開啟儲存、結果隱私與分頁異常均通過。沒有產生永久測試腳本或測試資料庫。
- Node 語法檢查、TypeScript、Vite build、`git diff --check` 通過。build 使用明確無效的 CDN origin 作編譯檢查，不能當成正式媒體已發布。沒有新增假驗證 fallback。
- Aside 實際桌面 1512×870：活動視窗與查核按鈕可操作，頁面與視窗內容沒有水平溢出。review 截圖保留於 `work/reviews/surf-missions-2026-10-06/surf-missions-desktop.png`。本轮没有以手機 viewport 重測；既有手機檢查不能替代新控制項的實機驗收。

仍需：由參加者完成 X／Discord OAuth 授權後驗證兩項任務、真實 Surf Discord 成員成功情境、確認正式活動規則與日期、Gavin 核對介面。標準 production build 需顯式提供 `MERCH_STOREFRONT_MODE` 與 `VITE_STATIC_ASSET_CDN_BASE_URL`。
