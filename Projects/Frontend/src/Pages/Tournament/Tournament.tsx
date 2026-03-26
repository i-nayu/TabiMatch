import "./Tournament.css";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import PhotoButton from "../../Components/PhotoButton/PhotoButton";
import ConfirmButton from "../../Components/ConfirmButton/ConfirmButton";
import jsQR from "jsqr";


function Tournament() {
  const navigate = useNavigate();
  const [votesLeft, setVotesLeft] = useState<number | null>(null);
  const [photos, setPhotos] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [expireTime, setExpireTime] = useState<string>("読み込み中...");
  const [deadlineAt, setDeadlineAt] = useState<Date | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<any | null>(null);
  const [selectedQrFile, setSelectedQrFile] = useState<File | null>(null);
  const [selectedQrText, setSelectedQrText] = useState<string | null>(null);
  const [isUploadingQr, setIsUploadingQr] = useState(false);
  const [voteStatusMessage, setVoteStatusMessage] = useState<string>("");
  const isSubmittingVoteRef = useRef(false);

  function appendReloadSuggestionIfNeeded(message: string) {
    const isAccountRecognitionError =
      message.includes("トランザクションエラー") ||
      (message.includes("404"));

    if (!isAccountRecognitionError) {
      return message;
    }

    return `アカウント作成直後はネットワークへの反映待ちの場合があります。ページをリロードして再試行してください。`;
  }

  // QR秘密鍵を sessionStorage から取得
  useEffect(() => {
    const qrFromSession = sessionStorage.getItem("qrCodeData");
    if (qrFromSession) {
      setSelectedQrText(qrFromSession);
    }
  }, []);

  function formatDeadlineTime(expireTime: Date) {
    const now = new Date();
    const leftTime = expireTime.getTime() - now.getTime();
    if (leftTime <= 0) return "投票終了";
    const totalSeconds = Math.floor(leftTime / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}時間${minutes}分${seconds}秒`;
  }

  useEffect(() => {
    if (!deadlineAt) {
      return;
    }

    const updateCountdown = () => {
      setExpireTime(formatDeadlineTime(deadlineAt));
    };

    updateCountdown();
    const intervalId = window.setInterval(updateCountdown, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [deadlineAt]);

  useEffect(() => {
    async function fetchTournamentData() {
      try {
        const qrFromSession = sessionStorage.getItem("qrCodeData");
        const res = await fetch("/Tournament/PhotoList", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            qrFromSession: qrFromSession ?? null,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          const backendMessage = data?.message ?? "トーナメントデータの取得に失敗しました";
          const displayMessage = appendReloadSuggestionIfNeeded(backendMessage);
          setVoteStatusMessage(displayMessage);
          toast.error(displayMessage);
          return;
        }
        const data = await res.json();
        if (data.expireTime) {
          const parsedDeadline = new Date(data.expireTime);
          if (Number.isNaN(parsedDeadline.getTime())) {
            setDeadlineAt(null);
            setExpireTime("-");
          } else {
            setDeadlineAt(parsedDeadline);
          }
        } else {
          setDeadlineAt(null);
          setExpireTime("-");
        }
        // データの正規化
        const normalizedPhotos = data.photos.map((photo: any) => ({
          id: photo.PhotoID,
          imageUrl: photo.PhotoPath,
          title: photo.Comment,
        }));
        setPhotos(normalizedPhotos);
        setVotesLeft(Number(data.votesLeft));
      } catch (error) {
        toast.error("通信エラー");
      } finally {
        setIsLoading(false);
      }
    }
    fetchTournamentData();
  }, []);

  function openQrModal(photo: any) {
    setSelectedPhoto(photo);
    setSelectedQrFile(null);
    setIsQrModalOpen(true);
  }

  function closeQrModal() {
    setIsQrModalOpen(false);
    setSelectedPhoto(null);
    setSelectedQrFile(null);
  }

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

  async function handleQrUpload(photo?: any) {
    if (isSubmittingVoteRef.current || isUploadingQr) {
      return;
    }

    const targetPhoto = photo ?? selectedPhoto;

    if (!targetPhoto) {
      toast.error("写真を選択してください");
      return;
    }

    // sessionStorageの秘密鍵がある場合はそれを使う

    const qrTextToSend = selectedQrText ?? (selectedQrFile ? await decodeQRCodeFromFile(selectedQrFile) : null);
    const qrFromSession = sessionStorage.getItem("qrCodeData");

    if (!qrTextToSend) {
      toast.error("QRコードまたは秘密鍵がありません");
      return;
    }

    isSubmittingVoteRef.current = true;
    setIsUploadingQr(true);
    setVoteStatusMessage("投票中...");
    try {
      const res = await fetch("/Tournament/Vote", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoId: targetPhoto.id,
          textPrivateKey: qrTextToSend,
          qrFromSession: qrFromSession ?? null,
        }),
      });

      const data = await res.json().catch(() => null);
      const backendMessage = data?.message ?? "サーバーエラーが発生しました";
      const displayMessage = appendReloadSuggestionIfNeeded(backendMessage);

      if (!res.ok) {
        setVoteStatusMessage(`投票失敗: ${displayMessage}`);
        toast.error(displayMessage);
        return;
      }

      setVoteStatusMessage(backendMessage);
      toast.success(backendMessage);
      setVotesLeft((current) => (current !== null ? Math.max(0, current - 1) : current));

      // sessionStorageに保存（初回アップロードの場合のみ）
      if (!selectedQrText) {
        sessionStorage.setItem("qrCodeData", qrTextToSend);
        setSelectedQrText(qrTextToSend);
      }

      closeQrModal();
    } catch (err) {
      const message = err instanceof Error ? err.message : "通信エラー";
      setVoteStatusMessage(`投票失敗: ${message}`);
      toast.error(message);
    } finally {
      setIsUploadingQr(false);
      isSubmittingVoteRef.current = false;
    }
  }

  return (
    <main className="tournament-page">
      <header className="tournament-tab">
        <h1 className="tournament-title">トーナメント投票</h1>
        <h1 className="tournament-title">テーマ：観光</h1>
        {!isLoading &&
          <div className="tournament-buttons">
            <ConfirmButton label="オークション" type="button" onClick={() => navigate("/auction")} />
            <ConfirmButton label="購入一覧" type="button" onClick={() => navigate("/auction-buy")} />
            <ConfirmButton label="アップロード" type="button" onClick={() => navigate("/upload-photo")} />
          </div>
        }
      </header>

      <section className="status-row">
        <article className="status-card">
          <p className="status-label">残り時間</p>
          <p className="status-value">{expireTime}</p>
        </article>

        <article className="status-card">
          <p className="status-label">残り投票数</p>
          <p className="status-value">{votesLeft}</p>
        </article>
      </section>

      <section className="photo-section">
        <div>
          <h2 className="photo-section-title">投票する写真を選んでください</h2>
          {voteStatusMessage && <p className="tournament-message">{voteStatusMessage}</p>}
        </div>
        <div className="photo-grid">
          {isLoading && <p className="tournament-message">読み込み中...</p>}
          {!isLoading && photos.length === 0 && <p className="tournament-message">表示できる写真がありません</p>}
          {!isLoading &&
            photos.map((photo) => (
              <article className="photo-card" key={photo.id}>
                <PhotoButton
                  icon={`http://localhost:5001${photo.imageUrl}`}
                  label={photo.title}
                  onClick={() => {
                    const shouldVote = window.confirm("この写真に投票しますか？");
                    if (!shouldVote) {
                      return;
                    }

                    // 秘密鍵があればモーダルを開かず直接送信
                    if (selectedQrText) {
                      handleQrUpload(photo);
                    } else {
                      openQrModal(photo);
                    }
                  }}
                />
              </article>
            ))}
        </div>
      </section>

      {/* QRモーダルは秘密鍵がない場合のみ表示 */}
      {!selectedQrText && isQrModalOpen && (
        <div className="qr-modal-backdrop" onClick={closeQrModal}>
          <section className="qr-modal" onClick={(event) => event.stopPropagation()} aria-modal="true" role="dialog">
            <h2 className="qr-modal-title">秘密鍵QRコード画像を読み取る</h2>
            <p className="qr-modal-text">秘密鍵QRコード画像を選択して送信してください。</p>

            <div className="qr-file-input-wrap">
              <label htmlFor="qr-file" className="qr-file-label">
                ファイルを選択
              </label>
              <input
                id="qr-file"
                className="qr-file-input"
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setSelectedQrFile(file);
                }}
              />
            </div>
            {selectedQrFile && <p className="qr-file-name">選択中: {selectedQrFile.name}</p>}

            <div className="qr-modal-actions">
              <ConfirmButton label="閉じる" type="button" onClick={closeQrModal} />
              <ConfirmButton
                label={isUploadingQr ? "投票中..." : "サーバーに送信"}
                type="button"
                onClick={handleQrUpload}
              />
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default Tournament;