import type { NextApiRequest, NextApiResponse } from 'next';
import { makeChain } from '@/utils/makechain';
import multiparty from 'multiparty';
import { langchainPineconeUpsert, pineconeUpsert } from '@/utils/vectorizedFile';
import { pinecone } from '@/utils/pinecone-client';

export const config = {
  api: {
    bodyParser: false,
  },
};

interface IFormData {
  question: string;
  history: string;
  // to do, type correctly
  file: {
    fieldName: string;
    originalFilename: string;
    path: string;
    headers: {
      [key: string]: string;
    };
    size: number;
  };
}

interface ApiFormDataRequest extends NextApiRequest {
  body: IFormData;
}

export default async function handler(
  req: ApiFormDataRequest,
  res: NextApiResponse,
) {
  // will receive a FormData object
  const form = new multiparty.Form();
  const formData = await new Promise<IFormData>((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) {
        reject(err);
        return;
      }
      const file = files.file[0];
      const question = fields.question[0];
      const history = fields.history[0];
      resolve({ question, history, file });
    });
  });
  
  const { question, history, file } = formData;

  //only accept post requests
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!question || typeof question !== 'string') {
    return res.status(400).json({ message: 'No question in the request' });
  }
  // OpenAI recommends replacing newlines with spaces for best results
  
  try {
    const pineconeClient = pinecone;
    
    // const vectorizedFile = await langchainPineconeUpsert(file.path, pineconeClient);
    // const vectorizedFile = await pineconeUpsert(file.path, pineconeClient);
    
    //create chain for conversational AI
    const chain = await makeChain(pineconeClient);

    //Ask a question using chat history
    const sanitizedQuestion = question.trim().replaceAll('\n', ' ');
    const response = await chain.call({
      question: sanitizedQuestion,
      chat_history: history || [],
    });

    res.status(200).json(response);
  } catch (error: any) {
    console.log('error creating chain', error);
    res.status(500).json({ error: error.message || 'Something went wrong' });
  }
}
