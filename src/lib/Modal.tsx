import { type Component, type JSX, Show } from "solid-js";
import { Portal } from "solid-js/web";
import "./Modal.scss"

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: JSX.Element;
}

const Modal: Component<ModalProps> = (props) => {
    return (
        <Show when={props.isOpen}>
            <Portal>
                <div class="modal-backdrop" onClick={props.onClose}>
                    <div class="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2>{props.title}</h2>

                        <div class="modal-body">
                            {props.children}
                        </div>

                        <button onClick={props.onClose}>OK</button>
                    </div>
                </div>
            </Portal>
        </Show>
    );
};

export default Modal;