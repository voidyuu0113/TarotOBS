# Project Summary

這個專案是一個以 `Vite + TypeScript + PixiJS` 製作的塔羅桌面工具。它的核心目標不是做傳統網站，而是提供一個可作為 `OBS Browser Source` 使用的透明前端畫布，讓使用者在大桌面世界中操作多個牌組、翻牌、拖牌、框選、洗牌、展牌，並用本地素材與預設組合管理整個塔羅系統。

## 我實際閱讀過的 `.ts` 檔案

- `vite.config.ts`
- `src/main.ts`
- `src/vite-env.d.ts`
- `src/app/App.ts`
- `src/assets/AssetManager.ts`
- `src/assets/AssetPreviewManager.ts`
- `src/card/CardModel.ts`
- `src/card/CardSizing.ts`
- `src/card/CardView.ts`
- `src/core/InputManager.ts`
- `src/deck/DeckManager.ts`
- `src/deck/DeckTypes.ts`
- `src/deck/SamplePresetFactory.ts`
- `src/deck/Shuffle.ts`
- `src/i18n/index.ts`
- `src/interaction/BoxSelect.ts`
- `src/interaction/ClickOrDrag.ts`
- `src/interaction/DragController.ts`
- `src/storage/PresetStorage.ts`
- `src/storage/TransferFormats.ts`
- `src/table/Camera2D.ts`
- `src/table/SelectionManager.ts`
- `src/table/TableWorld.ts`
- `src/tarot/TarotTemplate.ts`
- `src/ui/BottomFanView.ts`
- `src/ui/ControlPanel.ts`
- `src/ui/DeckEditorOverlay.ts`
- `src/ui/SimpleSelect.ts`

## 專案入口與啟動流程

- `src/main.ts`
  - 載入 `styles.css`
  - 建立 `TarotApp`
  - 呼叫 `init()`
- `src/app/App.ts`
  - 是整個專案的主控制器
  - 建立 Pixi `Application`
  - 初始化 `Camera2D`、`DeckManager`、`PresetStorage`、`AssetManager`、`AssetPreviewManager`
  - 掛上 `ControlPanel` 與 `DeckEditorOverlay`
  - 建立 `TableWorld` 與 `BottomFanView`
  - 綁定滑鼠互動、editor 事件、deck 匯出匯入、語系切換
  - 啟動 ticker，持續更新 shuffle / jumper / pile throw animation

啟動時會先做資料修復與預設資源準備：

- 保證預設卡背存在
- 保證 `builtin-waite-folder` 存在
- 保證內建 Waite 正面素材存在
- 從 IndexedDB 載入 presets / assets / folders
- 若沒有任何 preset，建立 sample preset
- 若 preset 缺少 back asset，補上 default back
- 預設自動 spawn 一副 `full78`

## 核心架構

專案可分成七層：

- `app`
  - `TarotApp` 負責總協調
- `deck`
  - 牌組資料模型、instance 生命週期、shuffle 規則、jumper 規則
- `storage`
  - IndexedDB 持久化與 tarotpack 匯出匯入格式
- `assets`
  - live texture 與預覽 URL/比例快取
- `table`
  - world-space 渲染、camera、選取
- `interaction`
  - click/drag threshold、drag anchor、box select
- `ui`
  - 控制面板、底部牌列、牌組編輯器、簡易 select 元件

## 座標系統與畫面分層

這個專案非常依賴座標分層，不能混用：

- Screen Space
  - 原始滑鼠事件座標
  - selection rectangle overlay
  - DOM/editor/control panel hit testing
- World Space
  - 桌面卡牌
  - 非 active deck 的桌面 pile
  - 受 `Camera2D` 平移與縮放影響
- Viewport Space
  - 底部 pile / hand / fan
  - return zone overlay
  - 不受 camera 影響

對應元件：

- `TableWorld`
  - world-space card 與 pile 渲染
- `BottomFanView`
  - viewport-space active deck bottom area
- `selectionOverlay`
  - screen-space
- `ControlPanel` / `DeckEditorOverlay`
  - DOM overlay，不走 Pixi camera

## 資料模型

定義集中在 `src/deck/DeckTypes.ts`。

### 主要型別

- `DeckPreset`
  - 可儲存的牌組模板
  - 內容包含 `name`、`baseMode`、`backAssetId`、`assignments`、`extraCards`
- `DeckInstance`
  - 一次實際生成到桌面上的牌組實例
  - 內容包含 `flowState`、`cards`、`pileX/pileY`、`jumperChance`
- `CardModel`
  - 單張牌的執行期資料
  - 同時記錄身份、所屬 instance、正逆位、區域、座標、選取、排序等資訊
- `AssetRecord`
  - 素材庫中的圖片資產
- `AssetFolder`
  - editor 用的素材資料夾
- `ExtraCardDefinition`
  - 自訂附加牌

### 模式與狀態

- `PresetBaseMode`
  - `major22 | full78`
- `SpawnDeckMode`
  - `major22 | full78 | fullPreset`
- `CardZone`
  - `deck | hand | jumper | table`
- `DeckFlowState`
  - `pile | shuffling | fan`

## 塔羅模板設計

`src/tarot/TarotTemplate.ts` 是整個卡牌 identity 的 source of truth。

- 內建 22 張大阿爾克那
- 內建 56 張小阿爾克那
- 每張模板都有：
  - `templateCardId`
  - `nameKey`
  - `orderIndex`
  - `arcana`
  - `suit`
  - `rank`

重要 invariant：

- preset 不直接定義一整副匿名牌，而是定義「模板卡 -> front asset」指派
- `createEmptyAssignments()` 會為全部 78 張模板建立顯式 `null`
- `major22` 只取大阿爾克那模板
- `full78` 取完整 78 張模板
- `fullPreset` 會先依 preset 的 `baseMode` 取模板，再把 `extraCards` 接在後面

## 預設素材與 sample preset

`src/deck/SamplePresetFactory.ts` 負責內建素材與 sample preset 建立。

- 使用 `import.meta.glob()` 載入 `default-cards` 資料夾
- 內建一張 default back
- 內建 Waite 風格正面素材
- `createBuiltinDefaultAssignments()`
  - 將每張模板卡預設指派到對應 builtin front asset
- `createSamplePresetBundle()`
  - 產生一個可直接存進 DB 的 sample preset 與所需 assets

內建資產 ID 規則：

- 預設卡背：`default-back-asset`
- 正面素材：`builtin-front-${templateCardId}`

## 資產管理

### `AssetManager`

`src/assets/AssetManager.ts` 是 live Pixi texture 的唯一 owner。

- 用 `refCount` 管理 texture 生命周期
- `acquireAssets()`
  - 從 IndexedDB 讀 blob
  - 轉 object URL
  - 建 image
  - 建 Pixi `Texture`
- `releaseAssets()`
  - ref count 歸零後 destroy texture 並 revoke object URL
- `forgetAsset()`
  - 明確刪除資產時的強制清理逃生口

規則：

- `DeckPreset` / `DeckInstance` / `CardModel` 只保存 asset id
- 不直接持有 texture 物件

### `AssetPreviewManager`

`src/assets/AssetPreviewManager.ts` 專門服務 editor 預覽。

- 快取 object URL
- 快取圖片 aspect ratio
- 只回傳預覽資料，不接手 Pixi texture

## DeckManager 職責

`src/deck/DeckManager.ts` 是牌組業務邏輯核心。

主要責任：

- 載入與維護 presets
- 建立 / 移除 deck instances
- 切換 active instance
- 根據 preset 同步所有 instances
- 處理 shuffle / fan / return / insert hand
- 維護 jumper 規則
- 在刪除 asset 時清理 preset 與 runtime cards 的引用

### active deck 規則

- 任一時間只有一個 active deck 會顯示在底部 viewport
- 其他 deck 會以桌面 pile 存在 world space
- 桌面 table cards 可以同時來自多個不同 instance
- `returnCardsToDeck()` 永遠回到原始 `deckInstanceId`

### shuffle 流程

- `beginShuffle()`
  - 只重排非 table cards
  - table cards 保留在桌面
  - 重新設定正逆位
  - 重排 deckIndex
  - 設定 shuffle animation state
- `finalizeShuffle()`
  - 結束 animation
  - 底部卡回到 `deck`
  - table cards 保持 `table`

### jumper 規則

- base chance = `5%`
- miss 後 +`5%`
- trigger 後重設回 `5%`
- 一次 1 到 3 張
- jumper 在 `DeckManager` 內先被標成 `zone = table`
- 同時設 `pendingAutoPlace = true`
- 真正 landing position 由 `App` 依當前 viewport/camera 決定

### hand / return 規則

- `spreadInstance()`
  - 把底部區牌轉成 `hand`
- `insertCardsIntoHand()`
  - 支援拖回 active hand 的指定插入位置
- `returnCardsToDeck()`
  - 多 deck 情境下仍回原 deck，而不是回目前 active deck

## 互動邏輯

`App.ts` 搭配 `interaction/*` 與 `table/*` 實作滑鼠互動。

### 基本規則

- 右鍵拖曳永遠保留給 camera pan
- 左鍵點桌面牌：翻牌
- 左鍵拖曳已選桌面牌：群組拖曳
- 左鍵拖曳空白桌面：box select
- 從底部 hand 拖出：牌轉成 world-space `table`
- 拖到 return zone：
  - 若可插回 active hand，則插回指定位置
  - 否則回原 deck

### 互動輔助模組

- `ClickOrDrag.ts`
  - 純 threshold 判斷
- `DragController.ts`
  - 記錄拖曳起點 anchor
- `BoxSelect.ts`
  - 記錄框選 rectangle
- `SelectionManager.ts`
  - 管理 `selected` 狀態
- `InputManager.ts`
  - 封裝 canvas / window 的滑鼠事件綁定與解除

## 視覺渲染

### `CardView`

`src/card/CardView.ts`

- 單張牌的 Pixi 顯示元件
- 支援正面 / 背面 / 無貼圖 fallback 樣式
- 使用 rounded mask 限制匯入圖片不要超出牌框
- 牌面可顯示 title，牌背可顯示 `TAROT`

### `CardSizing`

`src/card/CardSizing.ts`

- 根據 front/back texture 的比例計算實際顯示大小
- ratio 會被 clamp，避免極端素材破壞 UI

### `TableWorld`

`src/table/TableWorld.ts`

- world-space felt、table cards、table piles 渲染
- 根據 `Camera2D` 套用 root position/scale
- pile 有自己的 hit box 與 label/count badge
- z-order 規則：
  - base: `instanceOrder * 1000 + index`
  - selected 再往上
  - dragging 再往上

### `BottomFanView`

`src/ui/BottomFanView.ts`

- viewport-space active deck 顯示
- 同時處理：
  - pile 視覺
  - shuffle 展開效果
  - hand/fan 排列
  - hover 上浮
  - insertion preview gap
- hit testing 只針對 `hand` / `jumper`

## 編輯器與控制面板

### `ControlPanel`

`src/ui/ControlPanel.ts`

- 語系切換
- shuffle / spread / return
- jumper 開關
- table felt 開關
- preset 選擇與 spawn
- instance 狀態與 active deck 切換

### `DeckEditorOverlay`

`src/ui/DeckEditorOverlay.ts`

editor 是高度 DOM 化的介面，負責：

- 選擇/建立/刪除 preset
- 即時編輯 preset 名稱
- 搜尋模板牌
- 顯示預覽卡列表
- lightbox 檢視與改名 custom card
- 匯入 front assets
- 替換共享 back
- 建立資料夾
- 新增 extra card
- 清除指定卡的 assignment
- 匯出 / 匯入 tarotpack

`App.ts` 中與 editor 配合的關鍵行為：

- `persistEditorDraft()`
  - 將 draft 存進 DB
  - 同步 `DeckManager`
  - 補做新增/移除 asset 的 texture acquire/release
- `handleDeleteAsset()`
  - 禁止刪預設 back 與 builtin assets
  - 清掉 presets / extra cards / runtime cards 的引用
- `handleResetAllMaterials()`
  - back 回 default back
  - assignments 回 builtin default assignments
  - extraCards 保留結構但 front assignment 清空

## 持久化

`src/storage/PresetStorage.ts` 使用 IndexedDB。

### DB 結構

- database name: `tarot-overlay-db`
- version: `3`
- stores:
  - `presets`
  - `assets`
  - `folders`

### 支援內容

- `get/save/deletePreset`
- `get/save/deleteAsset`
- `getAssetBlob`
- `get/saveFolder`

### migration / normalize 行為

- 舊 preset 會被 normalize 到新 schema
- 舊 asset 會補出 `id` / `label` / `kind` / `folderId`
- 若 folders store 為空，`getFolders()` 會回傳虛擬 root folder

常數：

- `ROOT_FOLDER_ID = 'root-folder'`
- `BUILTIN_WAITE_FOLDER_ID = 'builtin-waite-folder'`

## 匯出 / 匯入格式

`src/storage/TransferFormats.ts` 定義 `tarotpack` 格式。

### 特性

- 自製 tar 封包
- manifest 檔名固定為 `manifest.json`
- manifest version = `2`
- 只打包非 builtin assets
- 支援輸出：
  - `.tarotpack` blob
  - 可分享的 data URL HTML 文字

### 主要函式

- `createTarotPackFilename()`
- `createTarotPackAssetPath()`
- `createTarotPackBlob()`
- `createTarotPackShareText()`
- `parseTarotPackFile()`
- `parseTarotPackDataUrl()`

`App.ts` 中的匯入策略：

- 匯入時重建 folder id
- 非 builtin asset 會重新配發新的 asset id
- preset 也會重新配發新的 preset id
- 名稱若衝突會自動加數字
- preset 內的 asset references 會一起 remap

## 多語系

`src/i18n/index.ts`

- 支援 `en`、`zh-TW`、`ja`
- preference 存在 `localStorage`
- `auto` 依瀏覽器語系判斷
- 缺字 fallback 到英文
- 透過 `subscribeI18n()` 讓 `App` 在切語系時刷新 deck title、editor 與畫面

## 建置設定

`vite.config.ts` 提供兩種輸出模式：

- 一般模式
  - `dist`
- `singlefile` 模式
  - 啟用 `vite-plugin-singlefile`
  - 輸出到 `dist-single`
  - 把資產盡量 inline

dev server：

- host: `0.0.0.0`
- port: `5173`

## 重要設計結論

這個專案的真正核心不是單一 UI 元件，而是以下幾個穩定設計：

- tarot template 是卡牌 identity 的唯一來源
- preset 只做素材指派與 extra card 定義
- active deck 與 table piles 嚴格分成 viewport-space 和 world-space
- `AssetManager` 是 live texture 的唯一 owner
- `DeckManager` 專注於 deck state machine，不直接決定 world animation 落點
- `App` 是 orchestration layer，負責把 deck state、camera、storage、UI、animation 串起來
- `tarotpack` 匯出匯入已經是完整 feature，不只是附帶工具

## 目前看起來最關鍵的檔案

如果之後要快速理解或改功能，優先看這幾個：

- `src/app/App.ts`
- `src/deck/DeckManager.ts`
- `src/storage/PresetStorage.ts`
- `src/storage/TransferFormats.ts`
- `src/ui/DeckEditorOverlay.ts`
- `src/table/TableWorld.ts`
- `src/ui/BottomFanView.ts`
