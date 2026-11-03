# Worlds v3 單場存證

原產品 `/verify` 增加 `event=worlds-2026&stage=<quarter|semi|final>&match=<matchId>&snapshotHash=<hash>`；不可混用 tx/bundleHash，也不能省略單場版本。公開 relay 僅讀取設定好的 LoL origin，不轉送 cookie、Authorization、query URL 或 redirect。

名冊的 matchCommitmentFor 會重建舊 ledger 的既定編碼，再計算 snapshotHash 與 match-local Merkle Root。獨立驗證從 Merch 設定的 authority 選取公開 RPC，讀取 v3 runtime、協定、receipt/event/finality/state；上游的 authority 或 verified flag 不能代替核准設定。完整六步 proof 同時核對各場早期存證早於整輪承諾，並精確綁定原名冊及獎品。

0 張票用明定的空名冊承諾，不產生得獎者；1 張與 2 張走相同證明流程。每場一張正取卡，不新增候補。舊版本歷史仍由其原 authority 與協定驗證。

程式來源：codex/public-proof-registry，HEAD 8a1736411fb55fe8522bf7050ea46cba7ab94eb6 加本次變更，已核對 origin/main 0c6c880bf88abfd45d1c42311a785c1996df45c5 為祖先。2026-11-04 已獲核准發布。正式 v3 authority 為 BSC 56 `0x502aE1361207df515A68F0Beffef28D59be3f4D9`，runtime `0x51d2ae9c45d66a149e5ece28547e3a9c0cbdbbe8b594cd8f3e4b4478d9e458b4`；原 v2 authority 保留供歷史驗證。

2026-11-03：公開證明 42 個測試通過；與 LoL 真實本機 HTTP/Anvil/SQLite 出版流程交叉驗證。正常 `/verify` 瀏覽器實際完成六步核對。手機 320/375/390/414 px 無橫向溢出；修正單場核對按鈕繼承 42px 左邊距的根因，按鈕至少 44px 高。這是桌面手機 viewport 檢查，未代表實體手機驗收。

共用 protocol.mjs、chain.mjs、match-snapshot.mjs、match-chain.mjs、registry-v3-build.json 必須與 LoL shared/ecvrf 相同；發布前以檔案 hash 核對。新主網 instance 尚待部署核准，兩站 authority 要共同切換並保留舊歷史設定。既有 production CDN 素材不變，沒有新增圖片／影片或替代公開媒體流程。
