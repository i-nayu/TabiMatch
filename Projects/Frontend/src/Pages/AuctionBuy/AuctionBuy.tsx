import "./AuctionBuy.css";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ConfirmButton from "../../Components/ConfirmButton/ConfirmButton";
import jsQR from "jsqr";
import toast from "react-hot-toast";

type BoughtPhoto = {
  PhotoID: number;
  Address: string;
  PhotoPath: string;
  Amount?: number;
  BoughtAmount?: number;
};

type AuctionBuyResponse = {
  message?: string;
  userData?: BoughtPhoto[];
};

type AuctionBuyListResponse = {
  items?: BoughtPhoto[];
  boughtList?: BoughtPhoto[];
  userData?: BoughtPhoto[];
};

function normalizeBoughtList(data: unknown): BoughtPhoto[] {
  if (Array.isArray(data)) {
    return data as BoughtPhoto[];
  }

  if (data && typeof data === "object") {
    const typedData = data as AuctionBuyListResponse;
    if (Array.isArray(typedData.items)) {
      return typedData.items;
    }
    if (Array.isArray(typedData.boughtList)) {
      return typedData.boughtList;
    }
    if (Array.isArray(typedData.userData)) {
      return typedData.userData;
    }
  }

  return [];
}

function AuctionBuy() {
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<BoughtPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("秘密鍵QRコード画像を選択して送信してください");
  const [selectedQrFile, setSelectedQrFile] = useState<File | null>(null);
  const [isSendSucceeded, setIsSendSucceeded] = useState(false);

  // File（QR画像）から文字列を取得する関数
async function decodeQRCodeFromFile(file: File): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvasの2Dコンテキストが取得できません"));
          return;
        }

        ctx.drawImage(image, 0, 0);

        // jsQRでQRコードを解析
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        resolve(code?.data || null);
      };
      image.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
      image.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("ファイルの読み込みに失敗しました"));
    reader.readAsDataURL(file); // File を DataURL に変換
  });
}

  async function handleSendQr() {
    if (!selectedQrFile) {
      setMessage("QRコード画像を選択してください");
      return;
    }

    setIsSendSucceeded(false);
    setPhotos([]);
    setIsLoading(true);
    try {
      const privateKey = await decodeQRCodeFromFile(selectedQrFile);

      const sendRes = await fetch("/AuctionBuy/AuctionBuy", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          privateKey,
        }),
      });

      const sendData: AuctionBuyResponse | null = await sendRes.json().catch(() => null);

      if (!sendRes.ok) {
        setMessage(sendData?.message ?? "秘密鍵の送信に失敗しました");
        return;
      }

      setIsSendSucceeded(true);
      setMessage(sendData?.message ?? "秘密鍵を送信しました");
      toast.success(`${sendData?.message ?? "秘密鍵を送信しました"}`);

      const listRes = await fetch("/AuctionBuy/List", {
        method: "GET",
        credentials: "include",
      });

      if (listRes.ok) {
        const listData: AuctionBuyListResponse = await listRes.json();
        setPhotos(normalizeBoughtList(listData));
        return;
      }

      setPhotos(normalizeBoughtList(sendData));
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "通信エラー";
      setMessage(nextMessage);
      setIsSendSucceeded(false);
      setPhotos([]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="auction-buy-page">
      <header className="auction-buy-header">
        <h1 className="auction-buy-title">購入一覧</h1>
        <div className="auction-buy-actions">
          <ConfirmButton label="オークション" type="button" onClick={() => navigate("/auction")} />
          <ConfirmButton label="トーナメント" type="button" onClick={() => navigate("/tournament")} />
        </div>
      </header>

      <section className="auction-buy-list-wrap">
        <div className="auction-buy-upload">
          <label htmlFor="auction-buy-qr" className="auction-buy-file-label">QRファイルを選択</label>
          <input
            id="auction-buy-qr"
            className="auction-buy-file-input"
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setSelectedQrFile(file);
            }}
          />
          {selectedQrFile && <p className="auction-buy-file-name">選択中: {selectedQrFile.name}</p>}
          <ConfirmButton
            label={isLoading ? "送信中..." : "秘密鍵を送信して取得"}
            type="button"
            onClick={handleSendQr}
          />
        </div>

        {isLoading && <p className="auction-buy-message">処理中...</p>}

        {!isLoading && !isSendSucceeded && <p className="auction-buy-message">{message}</p>}

        {!isLoading && isSendSucceeded && photos.length === 0 && (
          <p className="auction-buy-message">表示できる購入データがありません</p>
        )}

        {!isLoading && isSendSucceeded && photos.length > 0 && (
          <ul className="auction-buy-list">
            {photos.map((photo) => (
              <li className="auction-buy-item" key={photo.PhotoID}>
                <img
                  className="auction-buy-image"
                  src={photo.PhotoPath}
                  alt={`bought-${photo.PhotoID}`}
                />
                <div className="auction-buy-meta">
                  <p>PhotoID: {photo.PhotoID}</p>
                  <p>購入額: {photo.BoughtAmount ?? photo.Amount}</p>
                  <p>{message}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

export default AuctionBuy;