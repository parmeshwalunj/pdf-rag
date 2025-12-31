import { Worker } from 'bullmq';
import { QdrantVectorStore } from "@langchain/qdrant";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf"
import { CharacterTextSplitter } from "@langchain/textsplitters";

const worker = new Worker(
    'file-upload-queue',
    async (job) => {
        console.log(`Processing file: ${job.data}`);
        /*
        path is data.path which gives the path of the file where it is stored in the server
        read the pdf from path,
        make the chunks out of the pdf,
        make the embeddings of the chunks using openai embeddings model
        store the embeddings in the qdrant vector store
        */ 

        // Load the PDF
        const loader = new PDFLoader(job.data.path);
        const docs = await loader.load();

        // Make the chunks out of the pdf
        const textsplitter = new CharacterTextSplitter({
            chunkSize: 500,
            chunkOverlap: 0,
        });
        const texts = await textSplitter.splitText(docs);
        console.log(texts);
    },
    {concurrency: 100,
        connection: {
            host: 'localhost',
            port: 6379,
        }
    }
);