
interface ToastProps {
  msg: string;
}

export function Toast({ msg }: ToastProps) {
  return (
    <div className="toast-overlay" aria-live="assertive">
      <div className={`toast-inner${msg ? ' show' : ''}`}>{msg}</div>
    </div>
  );
}
