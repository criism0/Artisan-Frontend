export default function TabButton({ active, disabled, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-2 rounded-lg text-sm border transition disabled:opacity-50 disabled:cursor-not-allowed ${
        active
          ? "bg-primary text-white border-primary"
          : "bg-white hover:bg-gray-50 border-gray-200 text-gray-800"
      }`}
    >
      {children}
    </button>
  );
}
