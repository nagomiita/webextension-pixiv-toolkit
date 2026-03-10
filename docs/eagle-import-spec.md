# Eagle取り込み機能 仕様書（たたき台）

更新日: 2026-03-10

## 1. 背景

本拡張は現在、Pixiv / Pixiv Comic / Fanbox の対象コンテンツをブラウザのダウンロード機能へ保存できる。
今後の改修では、既存のダウンロード機能とは別の出力先として、Eagle アプリへ item を取り込めるようにする。

本機能は「既存のダウンロード対象・選択UI・命名規則・変換仕様をできるだけ再利用する」ことを前提とする。

## 2. 目的

- 既存の対象リソースを、ダウンロードとは別に Eagle へ登録できるようにする
- 既存のページ選択、命名ルール、ugoira 変換指定をそのまま活用できるようにする
- 既存のダウンロード機能へ影響を与えず、Eagle 連携が無効または未起動でもダウンロード機能は継続利用できるようにする

## 3. スコープ

### 3.1 対象

- Pixiv Illustration
- Pixiv Manga
- Pixiv Comic Episode
- Fanbox image/article post 内の画像
- Pixiv Ugoira

### 3.2 初期リリースでの扱い

- Illustration / Manga / Comic / Fanbox画像は対応対象とする
- Ugoira は Eagle 側の受け入れ形式確認が取れる変換形式のみ対応する
- Pixiv Novel は初期リリースの対象外とする

## 4. 非スコープ

- 既存ダウンロード機能の置き換え
- Eagle 側ライブラリの管理機能そのものの提供
- Pixiv/Fanbox の元タグ完全同期
- Eagle へ登録済み item の更新・削除
- Pixiv Novel の Eagle 取り込み

## 5. 前提・制約

- Eagle ローカル API が起動していること
- 既定の API エンドポイントは `http://localhost:41595`
- Eagle API の item 登録は `POST /api/item/addFromURLs` を使用する
- Eagle API は URL だけでなく base64 形式も受け付けるため、認証付き画像は拡張機能側で取得して base64 化して送信する
- フォルダ選択には `GET /api/folder/list`、作品フォルダ自動作成には `POST /api/folder/create`、疎通確認には `GET /api/application/info` を使用する

### 5.1 CORS と通信元の制約

- `content script` から Eagle API を直接呼び出さない
- Eagle API 呼び出しは `background service worker` または `options page` から行う
- 初期リリースでは `host_permissions` を固定で持てるよう、Eagle API の接続先は `http://localhost:41595` と `http://127.0.0.1:41595` のみを正式サポートとする
- 初期リリースでは任意ホスト・任意ポートの Eagle API URL はサポートしない
- 将来的に任意の接続先を許可する場合は `optional_host_permissions` と実行時権限要求を追加で検討する

## 6. 用語

- `Download`: 既存のブラウザダウンロード保存
- `Eagle Import`: Eagle への item 登録
- `Work`: 1つの作品単位。Pixiv illust / manga、Pixiv Comic episode、Fanbox post、ugoira を含む
- `Page Item`: 作品内の各画像ページに対応する Eagle item

## 7. ユーザー要件

### 7.1 コンテンツページ上の操作

- 既存のダウンロードパネルから Eagle 取り込みを実行できること
- 既存のページ選択 UI をそのまま利用できること
- ugoira は既存の変換種別指定を再利用できること
- ダウンロードと Eagle 取り込みは別操作として扱えること

### 7.2 設定画面

- Eagle 連携の有効/無効を切り替えられること
- Eagle API URL を設定できること
- Eagle 接続確認を実行できること
- 取り込み先の Eagle フォルダを選択できること
- 作品ごとに Eagle サブフォルダを作るか設定できること

## 8. UI仕様

### 8.1 コンテンツページ

既存のダウンロードパネルに「出力先」概念を追加する。

- `Download`
- `Eagle`

出力先が `Download` の場合、既存挙動を維持する。
出力先が `Eagle` の場合、既存ボタン群は同じ見た目・同じ選択仕様のまま Eagle 取り込みとして動作する。

#### 補足

- 単一画像作品: 既存の `Download` ボタンと同等位置で `Eagle` 出力を実行
- 複数ページ作品: 既存のページ選択ダイアログをそのまま使用
- ugoira: 既存の変換種別ボタンを流用する
- 初期リリースで未対応の形式は、`Eagle` 出力時のみ disabled または非表示とする

### 8.2 オプション画面

新しい設定セクション `Eagle Settings` を追加する。

設定項目:

- `enableEagleImport: boolean`
- `eagleApiUrl: string` 初期値 `http://localhost:41595`
- `eagleBaseFolderId: string`
- `eagleBaseFolderName: string`
- `eagleCreateWorkFolder: boolean`

`eagleApiUrl` のバリデーション:

- 初期リリースでは `http://localhost:41595` または `http://127.0.0.1:41595` のみ許可する
- それ以外の URL は設定保存時にエラーとする

表示項目:

- 接続状態
- 選択中フォルダ名
- フォルダ再取得ボタン
- 接続テストボタン

## 9. 機能仕様

### 9.1 疎通確認

設定画面で Eagle 接続確認を行う。

- API: `GET /api/application/info`
- 成功時: 接続済み表示
- 失敗時: ローカル API 未起動、URL誤り、タイムアウトのいずれかとして表示

### 9.2 フォルダ選択

- API: `GET /api/folder/list`
- ユーザーは取り込み先の基底フォルダを1つ選択できる
- `eagleCreateWorkFolder = true` の場合、基底フォルダ配下に作品フォルダを自動作成する
- 作品フォルダ作成 API は `POST /api/folder/create` を使用し、親フォルダは `folderId` で指定する

### 9.3 命名規則

既存の rename ルールを流用する。

- 作品名: `renameRule`
- 画像名: `renameImageRule`
- ページ番号の開始値と桁数: 既存設定をそのまま使用

Eagle 側の反映規則:

- `eagleCreateWorkFolder = true`
  - Eagle フォルダ名に `renameRule` を適用
  - 各 item 名に `renameImageRule` を適用
- `eagleCreateWorkFolder = false`
  - 各 item 名に、現在の `dontCreateWorkFolder` 相当の結合規則を適用
  - すなわち作品名と画像名を必要に応じて連結する

### 9.4 データ送信方式

初期リリースでは `addFromURLs` に対して base64 を送る方式を標準とする。

理由:

- Pixiv / Fanbox の認証付きリソースでも拡張機能側で取得できる
- Eagle 側が Pixiv/Fanbox の Cookie を持っている前提を排除できる
- 既存ダウンロード処理で取得済みの Blob を流用しやすい

### 9.5 Eagle item への項目マッピング

`POST /api/item/addFromURLs`

各 item は以下の方針でマッピングする。

- `url`: base64 data URL
- `name`: 命名規則で生成したファイル名相当の文字列（拡張子除く）
- `website`: 元作品 URL
- `annotation`: 拡張機能側で生成したメタ情報テキスト
- `folderId`: 設定画面で選択した基底フォルダ、または自動生成した作品フォルダ
- `modificationTime`: `uploadDate` または `createDate` を ms epoch に変換した値
- `headers`: 初期リリースでは送らない
- `tags`: 初期リリースでは最小限または空配列

`annotation` には最低限以下を含める。

- source URL
- site type
- title
- userName / userId
- page number（複数ページ時）
- description/comment（存在する場合のみ）

### 9.6 リソース種別ごとの挙動

#### Pixiv Illustration

- 1作品につき 1 item
- item 名は作品名ベース

#### Pixiv Manga

- 選択ページごとに 1 item
- ページ選択 UI は既存仕様を流用
- `eagleCreateWorkFolder = true` の場合は作品フォルダ内へ登録

#### Pixiv Comic Episode

- Manga と同様

#### Fanbox Post

- 画像抽出済みのページごとに 1 item
- テキスト本文のみの投稿や画像以外の添付ファイルは初期リリース対象外

#### Pixiv Ugoira

- 既存の変換指定を再利用する
- 初期リリースでは、Eagle 側で受け入れ可能と確認できた出力形式のみ対応する
- 候補形式:
  - `gif`
  - `apng`
  - `webm`
  - `mp4`
  - `custom`

初期実装では `gif` と `apng` を優先対象とし、`webm` / `mp4` / `custom` は実機確認後に有効化する。

#### Pixiv Novel

- 初期リリース対象外
- 理由: `addFromURLs` は画像/URL ベース前提であり、既存 novel 出力との一致度が低い

### 9.7 実行結果

成功時:

- コンテンツページ上に `Eagle に追加しました` 通知を表示
- 同一作品の重複投入抑止用ステータスを更新する
- 履歴へ `eagle_imported_at` を保存する

失敗時:

- 接続不可
- フォルダ未設定
- Eagle API エラー
- 変換未対応
- 対象リソース未対応
- 重複タスク

上記をユーザー向けメッセージへ変換して表示する。

## 10. 履歴仕様

現行履歴は `downloaded_at` のみを保持しているため、以下を追加する。

- `eagle_imported_at: number`

影響箇所:

- Dexie schema
- HistoryRepo
- HistoryService
- History UI
- コンテンツページ上の状態表示

表示仕様:

- `downloaded` と `imported to Eagle` は別状態として扱う
- 既存のダウンロード済み表示は維持する
- Eagle 取り込み済みは別バッジまたは別文言で表示する

## 11. アーキテクチャ方針

### 11.1 基本方針

既存の `PageResource`、`Adapter`、`renameRule`、`page selector` は再利用する。
保存先の違いだけを差し替えられる構造に寄せる。

### 11.2 追加想定モジュール

- `src/options_page/services/EagleService.js`
- `src/options_page/modules/EagleApiClient.js`
- `src/options_page/modules/EagleImportAdapter.js`
- `src/options_page/modules/EagleImportTasks/*`

### 11.3 既存改修ポイント

- `src/config/default.js`
  - Eagle 関連設定追加
- `src/content_scripts/components/App.vue`
  - 出力先 UI、通知文言、Eagle 実行導線追加
- `src/options_page/components`
  - Eagle 設定 UI 追加
- `src/options_page/services/index.js`
  - `EagleService` 登録
- `src/modules/Db/Db.js`
  - schema 更新
- `src/modules/Db/Repository/HistoryRepo.js`
  - `eagle_imported_at` 保存対応

### 11.4 通信経路

1. content script が `resource.unpack()` を作成
2. content script は `browser.runtime.sendMessage()` で拡張側 service へ `eagle:addImport` を送る
3. options page または background 側 service が resource type ごとの import task を生成する
4. task が既存 downloader / converter を使って Blob を作成する
5. 拡張側 service が Blob を base64 化して Eagle API へ送信する
6. 成功時に履歴更新

補足:

- Eagle API への `fetch` 実行主体は常に拡張コンテキストとする
- Web ページ DOM 上で動く `content script` は Eagle API を直接呼ばない

## 12. 重複判定

初期リリースでは、既存ダウンロードタスクと同様に `resource uid` ベースで重複タスクを判定する。

- illustration / manga / comic / fanbox: `resource.getUid()`
- ugoira: `resource.getDownloadTaskId(convertType)`

注意:

- Eagle 側に既に同一 item が存在するかは初期リリースでは照合しない
- 初期リリースでは「拡張側キュー重複防止」のみ行う

## 13. エラーハンドリング

- Eagle 未起動
- API URL 不正
- `host_permissions` 不足
- `localhost` / `127.0.0.1` の不一致
- フォルダ取得失敗
- フォルダ作成失敗
- Blob -> base64 変換失敗
- ugoira 変換失敗
- Eagle API 応答 `status !== success`

エラーは内部例外名をそのまま出さず、ユーザー向け文言へ変換する。

## 14. 権限・マニフェスト

追加で考慮する事項:

- `http://localhost:41595/*` へのアクセス許可
- `http://127.0.0.1:41595/*` へのアクセス許可
- options page / background からの local API 呼び出し
- 既存ダウンロード権限との独立性維持

マニフェスト方針:

- 初期リリースでは `host_permissions` に `http://localhost:41595/*` と `http://127.0.0.1:41595/*` を追加する
- 初期リリースでは `optional_host_permissions` は追加しない
- Eagle API 呼び出し元は `content script` ではなく、`background` または `options page` の service に寄せる
- `content script` はメッセージ送信のみ行い、HTTP 通信は行わない

## 15. 非機能要件

- ダウンロード機能の既存挙動を変更しない
- Eagle 無効時は UI/処理ともに既存動作を維持する
- 大量ページ取り込み時でも UI が固まらないこと
- 失敗時に再試行可能であること
- タスク進捗は既存マネージャと同等粒度で確認できること

## 16. 未解決事項

- ugoira の `webm` / `mp4` / `custom` を Eagle `addFromURLs` が正式に受け入れるか
- Eagle 取り込みタスクを既存 Download Manager 画面へ統合するか、別マネージャにするか
- Eagle item へ付与する tags を最小構成にするか、site/type/user 単位で付与するか
- `annotation` の整形ルールを固定テンプレート化するか
- Eagle 側の重複 item 検出を将来的に行うか

## 17. 推奨実装順

1. Eagle 接続確認 API の疎通実装
2. 設定 UI 追加
3. 単一画像作品の Eagle 取り込み
4. 複数ページ作品の Eagle 取り込み
5. 履歴 `eagle_imported_at` 対応
6. ugoira 対応
7. エラーメッセージ整備

## 18. 参考API

- Eagle item add from URLs
  - https://api.eagle.cool/item/add-from-urls
- Eagle application info
  - https://api.eagle.cool/application/info
- Eagle folder list
  - https://api.eagle.cool/folder/list
- Eagle folder create
  - https://api.eagle.cool/folder/create
