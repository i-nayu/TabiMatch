FROM node:20-alpine

WORKDIR /app

# ① 依存ファイルだけコピー
COPY Backend/package*.json ./

# ② 依存インストール
RUN npm install

# ③ バックエンド本体コピー
COPY Backend ./

# ④ フロントdistコピー
COPY Frontend/dist ./public

EXPOSE 5001

CMD ["node", "Server.js"]