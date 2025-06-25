export default function Toast({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-2 right-2 bg-gray-800 text-white px-4 py-2 rounded">
      {message}
    </div>
  );
}
