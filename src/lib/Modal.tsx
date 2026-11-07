import { type Component, type JSX, Show } from "solid-js";
import { Portal } from "solid-js/web";
import "./Modal.scss"

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: JSX.Element;
    onConfirm?: () => void;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
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

                        <Show 
                            when={props.onConfirm} 
                            fallback={
                                <div class="modal-actions">
                                    <button type="button" onClick={props.onClose}>OK</button>
                                </div>
                            }
                        >
                            <div class="modal-actions">
                                <button type="button" class="modal-cancel-btn" onClick={props.onClose}>
                                    {props.cancelText || "Cancel"}
                                </button>
                                <button 
                                    type="button" 
                                    class={props.danger ? "modal-danger-btn" : "modal-confirm-btn"} 
                                    onClick={props.onConfirm}
                                >
                                    {props.confirmText || "OK"}
                                </button>
                            </div>
                        </Show>
                    </div>
                </div>
            </Portal>
        </Show>
    );
};

export default Modal;
