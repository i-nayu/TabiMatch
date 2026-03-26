import "./InputField.css"
type InputFieldProps = {
    name: string;
    placeholder: string;
    type: string;
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}
const InputField = ({name, placeholder, type, value, onChange}: InputFieldProps) => {
    return (
        <input className="InputField" name={name} type={type} value={value} onChange={onChange} placeholder={placeholder} />
    )
}
export default InputField;