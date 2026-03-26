import "./PhotoButton.css"
type PhotoButton = {
    icon : string
    label: string;
    onClick?: () => void;
    type?: "button" | "submit" | "reset";

}
const PhotoButton = ({ icon, label, onClick, type }: PhotoButton) => {
    return (
        <button onClick = {onClick} className="PhotoButton" type={type}>
            <img src={icon} className="PhotoButtonicon" alt="" />
            <p>{label}</p>
        </button>
    )
}
export default PhotoButton;