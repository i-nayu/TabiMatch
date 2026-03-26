# Touction

Touctionは、Symbolテストネットを使った写真トーナメント + オークションアプリです。
ユーザーは写真を投稿し、トーナメントで投票を受け、終了後にオークション入札・購入を行えます。

## できること

- ユーザー登録時にSymbolアカウントを自動生成
- 秘密鍵をQRコードで受け取り、以後は秘密鍵でログイン
- トーナメントへの写真投稿（1人1投稿）
- トーナメント投票（1人1票）
- オークション入札
- 落札後の購入実行（XYM送金 + 購入確定）

## ブロックチェーンを使う意義

- 投票や購入に関わる価値移転をSymbol上に記録することで、後から第三者でも検証できる透明性を確保できます。
- 運営DBだけに依存しないため、履歴の改ざん耐性を高められます。
- トーナメントごとのモザイクを発行する設計により、イベント単位で投票権を明確に分離できます。
- 落札後の支払い（XYM送金）とアプリ内の購入状態を対応付けることで、「送った/送っていない」の認識ズレを減らせます。
- 日常的な一覧表示や検索はDBで高速に処理しつつ、重要な価値移転だけをブロックチェーンで担保する役割分担ができます。

## 使用方法

1. ユーザー登録
- トップ画面で登録すると、Symbolアカウントが自動生成されます。
- 生成された秘密鍵はQRコードとして表示されるため、必ず安全な場所に保管します。

2. ログイン
- `privateKey` を使ってログインします。
- ログイン後はトーナメント画面に遷移します。

3. トーナメントに参加
- トーナメント画面で写真一覧と投票状態を取得します。
- 未配布の場合は、投票権モザイクが1枚配布されます（1人1票）。

4. 写真を投稿
- アップロード画面から写真とコメントを投稿します。
- 1アドレスにつき、同一トーナメントでの投稿は1回です。

5. 投票する
- トーナメント画面から任意の写真に投票します。
- 投票時に投票権モザイク1枚を送信し、投票済みフラグが更新されます。

6. オークション入札
- オークション画面で写真に入札します。
- より高い入札額のみ有効になります。

7. 落札品を購入
- 購入画面で購入実行します。
- XYM送金が成功すると、購入済み情報がDBに反映されます。

### 実行動画
https://youtu.be/-cF3CP0mAq8

## ブロックチェーンをどのように使用しているか

1. アカウント生成（登録時）
- Register APIでSymbolアカウントを作成し、アドレスをDBに保存します。

2. トーナメント用モザイク作成（開催時）
- 開催中トーナメントが無い場合、サーバーが新規モザイクを発行し供給量を設定します。
- 発行したMosaicIDと開催期間を`Mosaic`テーブルへ保存します。

3. 投票権配布
- ユーザーの投票権残高をチェーンから確認し、必要なら運営アカウントから投票権モザイクを1枚配布します。

4. 投票トランザクション
- 投票時は、投票者から投稿者へ投票権モザイク1枚をTransfer Transactionで送信します。
- 送信後に投票済み状態をDBへ反映します。

5. 購入トランザクション
- 落札者は、落札額分のXYMを写真投稿者へTransfer Transactionで送信します。
- 確認後、`Bought`および`Photos.Purchased`を更新します。

6. DBとの役割分担
- ブロックチェーン: 価値移転（投票権・XYM送金）の事実記録。
- DB: 画面表示用の高速な一覧取得、状態管理、アプリ運用データ保持。

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | React + TypeScript + Vite |
| バックエンド | Node.js + Express (ESM) |
| DB | MySQL 8 |
| ブロックチェーン | Symbol testnet (symbol-sdk v3) |

## ディレクトリ構成

```
Touction/
├── README.md
└── Projects/
    ├── docker-compose.yml
    ├── Backend/
    │   ├── Dockerfile
    │   ├── Server.js
    │   ├── package.json
    │   ├── DB/
    │   │   └── init.sql
    │   ├── Routes/
    │   │   ├── Register.js
    │   │   ├── Login.js
    │   │   ├── Tournament.js
    │   │   ├── Auction.js
    │   │   └── AuctionBuy.js
    |   ├── .env
    │   └── Tools/
    │   
    ├── Frontend/
    │   ├── package.json
    │   ├── vite.config.ts
    │   ├── public/
    │   └── src/
    │       ├── Components/
    │       └── Pages/
    └── nginx/
        └── default.conf
```

## 起動手順

### 1. 前提

- Docker Desktop（または Docker Engine + Compose）
- Node.js 20以上（フロントビルド用）

### 2. 環境変数を作成

以下を作成してください。

- `Projects/Backend/.env`

例:

```env
PORT=5001
TOURNAMENT_PRIVATE_KEY=AUTH_PRIVATE_KEY
DB_HOST=MySQLサーバのホスト名
DB_USER=MySQL接続ユーザー
DB_PASSWORD=MySQL接続パスワード
DB_NAME=使用するデータベース名
```

`TOURNAMENT_PRIVATE_KEY` は、トーナメント用モザイク作成・投票権配布に使うアカウントの秘密鍵です。
このアカウントにはテストネットXYMを十分に用意してください。

### 3. フロントエンドをビルド

```bash
cd Projects/Frontend
npm install
npm run build
```

### 4. Docker Composeで起動

```bash
cd ../
docker compose up --build
```

## アクセス先

| サービス | URL / ポート |
|---|---|
| フロント + リバースプロキシ (Nginx) | http://localhost |
| Backend (Express) | http://localhost:5001 |
| MySQL | localhost:3307 |
| Adminer | http://localhost:8080 |

## DBテーブル

`Projects/Backend/DB/init.sql` で初期化されます。

| テーブル | 用途 |
|---|---|
| `Identify` | ユーザーのアドレス |
| `Mosaic` | トーナメント用モザイクと開催期間 |
| `Photos` | 投稿写真、入札、購入状態 |
| `Vote` | 投票済み・配布済みフラグ |
| `Bought` | 購入済み写真情報 |

## 補足

- ブロックチェーン接続先はSymbol testnetノード（コード内で固定URLを使用）です。
- トランザクション手数料不足時は、投票/購入APIが失敗します。
- 画像アップロードサイズはバックエンドで5MBに制限しています。
