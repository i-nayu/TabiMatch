import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import './Tools/CreateTournament.js';
const app = express();

// ==========================
// __dirname 再生成（ESM用）
// ==========================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================
// 環境変数読み込み
// ==========================

// CommonJSでは __dirname がそのまま使えたが
// ESMでは上記処理が必要
dotenv.config({
  path: path.resolve(__dirname, '.env')
});


//ポート設定
const PORT = process.env.PORT || 5001;

// ==========================
// ミドルウェア設定
// ==========================

// JSONボディを扱えるようにする
app.use(express.json());

// URLエンコード形式のフォーム対応
app.use(express.urlencoded({ extended: true }));

// publicフォルダを静的公開
app.use(express.static(path.join(__dirname, 'public')));

// 保存されたアイコンフォルダを静的配信
app.use('/icons', express.static(path.join(__dirname, 'icons')));


// ==========================
// Routes自動マウント処理
// ==========================

// Routesディレクトリの絶対パス
const routesDir = path.join(__dirname, 'Routes');

const files = fs.readdirSync(routesDir);

for (const file of files) {

  if (!file.endsWith('.js')) continue;

  const routeName = path.basename(file, '.js');
  const routePath = `/${routeName}`;

  const routeModule = await import(
    path.join(routesDir, file)
  );

  const route = routeModule.default;

  app.use(routePath, route);

  console.log(`Route mounted: ${routePath}`);
}


// ==========================
// サーバー起動
// ==========================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
