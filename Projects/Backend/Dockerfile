FROM node:20-alpine

WORKDIR /app

# ① 依存ファイルだけコピー
COPY Backend/package*.json ./

# ② 依存インストール (Alpine用)
# fontconfig: フォント管理ツール
# font-noto-cjk: 日本語フォント（「見本」を表示するために必要）
RUN apk update && apk add --no-cache \
    fontconfig \
    font-noto-cjk \
    build-base \
    python3

# フォントキャッシュを更新
RUN fc-cache -fv

# Sharpを含む依存関係をインストール
RUN npm install

# ③ バックエンド本体コピー
COPY Backend ./

# ④ フロントdistコピー
COPY Frontend/dist ./public

EXPOSE 5001

CMD ["node", "Server.js"]