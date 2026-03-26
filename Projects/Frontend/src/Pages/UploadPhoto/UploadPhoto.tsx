import "./UploadPhoto.css";
import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import ConfirmButton from "../../Components/ConfirmButton/ConfirmButton";
import jsQR from "jsqr";

const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_PHOTO_SIZE_MB = 5;

function UploadPhoto() {
  const navigate = useNavigate();
  const [selectedQrFile, setSelectedQrFile] = useState<File | null>(null);
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("秘密鍵QRコード・写真・コメントを入力してください");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function decodeQRCodeFromFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const image = new Image();
        image.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = image.width;
          canvas.height = image.height;

          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) {
            reject(new Error("画像の読み取りに失敗しました"));
            return;
          }

          ctx.drawImage(image, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "attemptBoth",
          });

          if (!code?.data?.trim()) {
            reject(new Error("QRコードを画像から読み取れませんでした"));
            return;
          }

          resolve(code.data.trim());
        };

        image.onerror = () => reject(new Error("画像ファイルの読み込みに失敗しました"));
        image.src = reader.result as string;
      };

      reader.onerror = () => reject(new Error("ファイルの読み込みに失敗しました"));
      reader.readAsDataURL(file);
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedQrFile) {
      setMessage("秘密鍵QRコード画像を選択してください");
      return;
    }

    if (!selectedPhotoFile) {
      setMessage("アップロード写真を選択してください");
      return;
    }

    if (selectedPhotoFile.size > MAX_PHOTO_SIZE_BYTES) {
      setMessage(`写真サイズが上限を超えています（上限: ${MAX_PHOTO_SIZE_MB}MB）`);
      return;
    }

    if (!comment.trim()) {
      setMessage("コメントを入力してください");
      return;
    }

    setIsSubmitting(true);
    try {
      const privateKey = await decodeQRCodeFromFile(selectedQrFile);

      const formData = new FormData();
      formData.append("privateKey", privateKey);
      formData.append("comment", comment.trim());
      formData.append("photo", selectedPhotoFile);

      const res = await fetch("/Tournament/Upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 413) {
          setMessage(`写真サイズが上限を超えています（上限: ${MAX_PHOTO_SIZE_MB}MB）`);
          return;
        }

        setMessage(data?.message ?? "アップロードに失敗しました");
        return;
      }

      setMessage("写真をアップロードしました");
      setSelectedPhotoFile(null);
      setSelectedQrFile(null);
      setComment("");
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "QRコード読み取りまたは通信に失敗しました";
      setMessage(nextMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="upload-photo-page">
      <header className="upload-photo-header">
        <h1 className="upload-photo-title">写真アップロード</h1>
        <div className="upload-photo-actions">
          <ConfirmButton label="トーナメント" type="button" onClick={() => navigate("/tournament")} />
          <ConfirmButton label="オークション" type="button" onClick={() => navigate("/auction")} />
        </div>
      </header>

      <section className="upload-photo-card">
        <form className="upload-photo-form" onSubmit={handleSubmit}>
          <div className="upload-photo-group">
            <label htmlFor="upload-photo-qr">1. 秘密鍵QRコード画像</label>
<input
  id="upload-photo-qr"
  type="file"
  accept="image/*"
  onChange={async (event) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedQrFile(file);

    if (file) {
      try {
        const key = await decodeQRCodeFromFile(file);
        console.log("デバッグ: QR文字列", key);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "QRコード取得失敗";
        setMessage(msg);
        console.error("デバッグ: QR取得エラー", err);
      }
    }
  }}
/>
          </div>

          <div className="upload-photo-group">
            <label htmlFor="upload-photo-image">2. アップロード写真</label>
            <input
              id="upload-photo-image"
              className="upload-photo-file-input"
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                if (file && file.size > MAX_PHOTO_SIZE_BYTES) {
                  setSelectedPhotoFile(null);
                  setMessage(`写真サイズが上限を超えています（上限: ${MAX_PHOTO_SIZE_MB}MB）`);
                  return;
                }
                setSelectedPhotoFile(file);
              }}
            />
          </div>

          <div className="upload-photo-group">
            <label htmlFor="upload-photo-comment">3. コメント</label>
            <textarea
              id="upload-photo-comment"
              className="upload-photo-textarea"
              rows={4}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="写真のコメントを入力"
            />
          </div>

          <div className="upload-photo-submit">
            <ConfirmButton label={isSubmitting ? "送信中..." : "送信"} type="submit" />
          </div>
          <p className="upload-photo-message">{message}</p>
        </form>
      </section>
    </main>
  );
}

export default UploadPhoto;
