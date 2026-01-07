import FileUpload from "./components/file-upload"
import ChatComponent from "./components/chat"
export default function Home() {
  return (
    <div className="h-screen w-screen overflow-hidden">
      <div className="h-full w-full flex">
        <div className="w-[30vw] h-full flex items-center justify-center p-4 overflow-y-auto">
          <FileUpload />
        </div>
        <div className="w-[70vw] h-full border-l-4 overflow-hidden">
          <ChatComponent />
        </div>
      </div>
    </div>
  );
}
