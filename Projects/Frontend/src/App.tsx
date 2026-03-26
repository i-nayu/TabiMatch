import { BrowserRouter, Routes, Route } from "react-router-dom";
import Register from "./Pages/Register/Register";
import Login from "./Pages/Login/Login";
import Tournament from "./Pages/Tournament/Tournament";
import Auction from "./Pages/Auction/Auction";
import AuctionBuy from "./Pages/AuctionBuy/AuctionBuy";
import UploadPhoto from "./Pages/UploadPhoto/UploadPhoto";

function App() {
  return (
      <BrowserRouter>
        <Routes>
          <Route path='/' element={<Register />} />
          <Route path='/Login' element={<Login />} />
          <Route path='/tournament' element={<Tournament />} />
          <Route path='/auction' element={<Auction />} />
          <Route path='/auction-buy' element={<AuctionBuy />} />
          <Route path='/upload-photo' element={<UploadPhoto />} />
        </Routes>
      </BrowserRouter>
      );
}

export default App;