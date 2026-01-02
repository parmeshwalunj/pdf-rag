import FileUpload from "./components/file-upload"
import ChatComponent from "./components/chat"
export default function Home() {
  return (
    <div>
      <div className="min-h-screen w-screen flex">
        <div className="w-[30vw] min-h-screen flex items-center justify-center p-4"><FileUpload /></div>
        <div className="w-[70vw] min-h-screen border-l-4"><ChatComponent /></div>
      </div>
    </div>
  );
}
