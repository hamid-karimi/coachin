interface MessageProps {
  type: "error" | "success";
  message: string;
}

export function Message({ type, message }: MessageProps) {
  const isError = type === "error";

  return (
    <div
      className={`p-3 rounded border text-sm ${
        isError
          ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
          : "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300"
      }`}>
      {message}
    </div>
  );
}
