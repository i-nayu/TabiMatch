import "./ConfirmButton.css"
type ConfirmButton = {
    label: string;
    type?: "button" | "submit" | "reset";
    onClick?: () => void;

}
const ConfirmButton = ({ label, type, onClick }: ConfirmButton) => {
    return (
        <button className="ConfirmButton" type={type} onClick={onClick}>
            <p>{label}</p>
        </button>
    )
}
export default ConfirmButton;