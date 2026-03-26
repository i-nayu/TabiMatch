import "./Auction.css";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import ConfirmButton from "../../Components/ConfirmButton/ConfirmButton";
import { useNavigate } from "react-router-dom";

type AuctionPhoto = {
	PhotoID: number;
	Address: string;
	PhotoPath: string;
	Amount: number;
	voteCount: number;
};

type AuctionResponse = {
	expireTime: string | null;
	photosList: AuctionPhoto[];
};

function Auction() {
	const navigate = useNavigate();
	const [photos, setPhotos] = useState<AuctionPhoto[]>([]);
	const [expireTime, setExpireTime] = useState<string>("-");
	const [isLoading, setIsLoading] = useState(true);
	const [isSubmittingPhotoId, setIsSubmittingPhotoId] = useState<number | null>(null);

	useEffect(() => {
		async function fetchAuctionData() {
			try {
				const res = await fetch("/Auction/Auction", {
					method: "GET",
					credentials: "include",
				});

				if (!res.ok) {
					toast.error("オークション情報の取得に失敗しました");
					return;
				}

				const data: AuctionResponse = await res.json();
				setPhotos(data.photosList ?? []);
				setExpireTime(data.expireTime ?? "-");
			} catch (error) {
				toast.error("通信エラー");
			} finally {
				setIsLoading(false);
			}
		}

		fetchAuctionData();
	}, []);

	async function handleImageClick(photo: AuctionPhoto) {
		const amountInput = window.prompt(`入札額を入力してください（現在額: ${photo.Amount ?? 0}）`);
		if (amountInput == null) {
			return;
		}

		const bidAmount = Number(amountInput);
		if (!Number.isFinite(bidAmount) || bidAmount <= 0) {
			toast.error("有効な金額を入力してください");
			return;
		}

		if (bidAmount <= photo.Amount) {
			toast.error("現在額より大きい金額を入力してください");
			return;
		}

		setIsSubmittingPhotoId(photo.PhotoID);
		try {
			const privateKey = sessionStorage.getItem("qrCodeData");
			if (!privateKey) {
				toast.error("秘密鍵が見つかりません。先にトーナメント画面でQRを読み込んでください");
				return;
			}

			const res = await fetch("/Auction/Bid", {
				method: "POST",
				credentials: "include",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					privateKey,
					photoId: photo.PhotoID,
					amount: bidAmount,
				}),
			});

			if (!res.ok) {
				const data = await res.json().catch(() => null);
				toast.error(data?.message ?? "入札に失敗しました");
				return;
			}

			setPhotos((currentPhotos) =>
				currentPhotos.map((currentPhoto) =>
					currentPhoto.PhotoID === photo.PhotoID
						? { ...currentPhoto, Amount: bidAmount }
						: currentPhoto
				)
			);
			toast.success("入札を送信しました");
		} catch (error) {
			toast.error("通信エラー");
		} finally {
			setIsSubmittingPhotoId(null);
		}
	}

	return (
		<main className="auction-page">
			<header className="auction-header">
				<div className="auction-header-left">
				<h1 className="auction-title">オークション</h1>
				<ConfirmButton
                    label="トーナメント"
                    type="button"
                    onClick={async () => {
                        navigate("/Tournament");
                    }}
                />
				</div>
				<p className="auction-expire">終了時刻: {expireTime}</p>
			</header>

			<section className="auction-list-wrap">
				{isLoading && <p className="auction-message">読み込み中...</p>}
				{!isLoading && photos.length === 0 && (
					<p className="auction-message">表示できる写真がありません</p>
				)}

				{!isLoading && photos.length > 0 && (
					<ul className="auction-list">
						{photos.map((photo, index) => (
							<li className="auction-item" key={photo.PhotoID}>
								<p className="auction-rank">{index + 1}位</p>
								<img
									className="auction-image"
									src={photo.PhotoPath}
									alt={`rank-${index + 1}`}
									onClick={() => handleImageClick(photo)}
									role="button"
									aria-disabled={isSubmittingPhotoId === photo.PhotoID}
								/>
								<div className="auction-meta">
									<p>現在額: {photo.Amount ?? 0} n</p>
									<p>投票数: {photo.voteCount}</p>
									{isSubmittingPhotoId === photo.PhotoID && <p>送信中...</p>}
								</div>
							</li>
						))}
					</ul>
				)}
			</section>
		</main>
	);
}

export default Auction;
