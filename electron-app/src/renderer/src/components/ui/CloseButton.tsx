import { X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";

export function CloseButton() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);

  if (location.pathname === "/") return null;

  const handleClick = () => {
    if (location.pathname === "/server-startup") {
      setShowConfirm(true);
    } else {
      navigate("/");
    }
  };

  const handleConfirm = () => {
    // TODO: Optionally call IPC to terminate server startup if needed
    navigate("/");
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="fixed top-6 left-6 z-50 bg-night-800 hover:bg-night-700 rounded-full p-2 transition-colors duration-200"
        style={{
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        }}
        aria-label="Close and return to server list"
      >
        <X size={32} className="text-white" />
      </button>
      {showConfirm && (
        <div
          className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center"
        >
          <div
            className="bg-night-800 text-white p-8 rounded-xl max-w-md text-center shadow-2xl"
          >
            <p className="mb-6">
              Are you sure you want to exit? This will stop the server startup process and may leave your server in an incomplete state.
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={handleConfirm}
                className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg font-semibold transition-colors duration-200"
              >
                Exit Anyway
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="bg-night-700 hover:bg-night-600 text-white px-6 py-2 rounded-lg font-semibold transition-colors duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 