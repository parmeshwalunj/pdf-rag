'use client'

import { useState } from "react"
import { Upload } from "lucide-react"

export default function FileUpload() {
  const [file, setFile] = useState<File | null>(null)

  const handleUploadButtonClick = () => {
    const el = document.createElement('input');
    el.setAttribute('type','file');
    el.setAttribute('accept','application/pdf');
    el.addEventListener('change', async (ev) =>{
        if (el.files && el.files.length > 0) {
            const file = el.files.item(0);
            if (file){
              const formData = new FormData();
              formData.append('pdf', file);

              await fetch("http://localhost:8000/upload/pdf", {
                method: 'POST',
                body: formData,
              });
              console.log("FE: file uploaded!")
            }
        }
    })
    el.click();
  }

  return (
    <div className="bg-slate-900 text-white shadow-2xl flex justify-center items-center p-4 rounded-lg border-white border-2">
      {/* <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} /> */}
      <div 
      onClick={handleUploadButtonClick}
      className="flex items-center justify-center flex-col">
        <h3>Upload PDF file</h3>
        <Upload />
      </div>
    </div>
  )
}