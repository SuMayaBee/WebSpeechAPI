import { NextResponse } from "next/server";
import OpenAI from "openai";
import { ChatCompletionTool } from "openai/resources/index.mjs";
import { ChatCompletionToolChoiceOption } from "openai/src/resources/index.js";
import fs from 'fs';
import path from 'path';

let globalLanguageCode = "en-US"; // Default language code

// Function to update the global language code
export function updateGlobalLanguageCode(newLanguageCode: string) {
  globalLanguageCode = newLanguageCode;
 // console.log(`Global language code updated to: ${globalLanguageCode}`);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ChangeLanguageParams {
  query: string;
}

interface AnswerInLanguageParams {
  query: string;
  
}


type FunctionArguments = {
  [key: string]: any; // This allows for dynamic keys with varying types
};

// Language mappings for specific languages and their codes
const languageMappings: { [key: string]: string } = {
  portuguese: "pt-BR",
  english: "en-US",
  hindi: "hi-IN",
  spanish: "es-ES",
  french: "fr-FR",
  german: "de-DE",
  chinese: "zh-CN",
  japanese: "ja-JP",
  korean: "ko-KR",
  // Add more mappings as needed
};

export async function change_language({ query }: ChangeLanguageParams) {
  const prompt = `
    You are a language detection assistant. Your job is to determine the target language based on a user query.
    The query might include phrases like "Change the language to Portuguese" or "Switch back to Portuguese".
    Your output should only be the language name in English, such as "Portuguese" or "Hindi".
    Do not include any additional explanation or text in your response. Just return the language name in English.
  `;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: prompt,
        },
        {
          role: "user",
          content: query,
        },
      ],
      max_tokens: 100,
      temperature: 0.0, // Lower temperature ensures more deterministic output
    });

    const detectedLanguage = response.choices[0]?.message?.content
      ?.trim()
      .toLowerCase();

    // Check if detectedLanguage is valid
    if (!detectedLanguage) {
      throw new Error("Failed to detect a valid language.");
    }

    // Map the detected language to its corresponding language-country code
    const languageCode = languageMappings[detectedLanguage];

    if (!languageCode) {
      throw new Error(
        `Could not map the detected language "${detectedLanguage}" to a language code.`
      );
    }
    //console.log(languageCode);

    updateGlobalLanguageCode(languageCode);

    return NextResponse.json({ languageCode });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

// The answer_in_language function uses the global language code
export async function answer_in_language({ query }: AnswerInLanguageParams) {
  const prompt = `
    Answer the following question in ${
      globalLanguageCode.split("-")[0]
    } in 1 or 2 lines only:
    Question: "${query}"
  `;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant who always answers in the specified language.`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 100, // Limit to short responses (1-2 lines)
      temperature: 0.7, // Control the creativity of the response
    });

    const answer = response.choices[0]?.message?.content?.trim();

    if (!answer) {
      throw new Error("Failed to generate an answer.");
    }

        // Step 2: Convert the answer to audio using the TTS API
    // const audioResponse = await fetch("https://api.openai.com/v1/audio/speech", {
    //   method: "POST",
    //   headers: {
    //     "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
    //     "Content-Type": "application/json",
    //   },
    //   body: JSON.stringify({
    //     model: "tts-1",
    //     voice: "alloy",
    //     input: answer,
    //   }),
    // });

    // if (!audioResponse.ok) {
    //   throw new Error("Failed to convert text to audio.");
    // }

    //    // Step 3: Ensure the directory exists and save the audio file
    //    const outputDir = path.join(process.cwd(), 'public');
    //    const outputPath = path.join(outputDir, 'output.mp3');
   
    //    // Create the directory if it does not exist
    //    if (!fs.existsSync(outputDir)) {
    //      fs.mkdirSync(outputDir, { recursive: true });
    //    }
   
    //    // Save the audio file
    //    const audioBuffer = await audioResponse.arrayBuffer();
    //    fs.writeFileSync(outputPath, Buffer.from(audioBuffer));
   
    //    console.log('Audio saved at:', outputPath);
   
       // Respond with the audio file path or the answer text
       return NextResponse.json({ answer});
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

const tools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "change_language",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Trigger this function when the user explicitly requests a change in the language setting. The query should contain the target language (e.g., 'Hindi', 'Spanish', 'French'). This function is ONLY used for setting or changing the language the conversation should continue in, not for handling queries in that language.",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "answer_in_language",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          languageCode: {
            type: "string",
            description:
              "The language code-country code in which the answer should be given (e.g., 'en-US' for English (US), 'hi-IN' for Hindi (India), 'es-ES' for Spanish (Spain)). This is determined based on the user's question language.",
          },
          query: {
            type: "string",
            description:
              "The user's query or question that needs to be answered. This function should be triggered when the user asks a question or makes a request in any language. The query can be in any language, such as Hindi, Spanish, French, etc. The primary purpose of this function is to handle and respond to questions in the detected language.",
          },
        },
        required: ["languageCode", "query"],
        additionalProperties: false,
      },
    },
  },
];

export async function POST(request: Request) {
  const { text } = await request.json();
  let ans: string | undefined;

  //const prompt = "You will be provided with a question. Your tasks are to: - Detect what language the question is in - Answer the question in that language";

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "user",
        content: text,
      },
    ],
    tool_choice: "required",
    tools: tools,
  });

  // console.log(
  //   response.choices[0]?.message?.tool_calls?.[0]?.function?.name ?? ""
  // );
  // console.log(
  //   response.choices[0]?.message?.tool_calls?.[0]?.function?.arguments ?? ""
  // );

  const function_name =
    response.choices[0]?.message?.tool_calls?.[0]?.function?.name;

  // const function_arguments = response.choices[0]?.message?.tool_calls?.[0]
  //   ?.function?.arguments as FunctionArguments | undefined;

  const rawFunctionArguments = response.choices[0]?.message?.tool_calls?.[0]?.function?.arguments;
let function_arguments: FunctionArguments | undefined;

// If rawFunctionArguments is a string (which might be the case if the response is JSON), parse it
if (typeof rawFunctionArguments === "string") {
  try {
    function_arguments = JSON.parse(rawFunctionArguments) as FunctionArguments;
   // console.log("Parsed function arguments:", function_arguments);
  } catch (error) {
    console.error("Failed to parse function arguments:", error);
  }
} else {
  // If it's already an object, just assign it
  function_arguments = rawFunctionArguments as FunctionArguments | undefined;
}

  if (function_name === "change_language") {
    if (function_arguments?.query) {

      const response2 = await change_language({ query: function_arguments.query });

      if (response2.ok) {
        const data = await response2.json(); // Extract the JSON data
        ans = data.languageCode; // Capture the answer in the ans variable
  
       // console.log(ans); // Log the answer
      } else {
        console.error("Error:", response2.statusText);
      }


    } else {
      console.error(
        "function_arguments or function_arguments.query is undefined"
      );
    }
  } else if (function_name === "answer_in_language") {
    if (function_arguments?.query) {

      const response1 = await answer_in_language({ query: function_arguments.query });

      if (response1.ok) {
        const data = await response1.json(); // Extract the JSON data
        ans = data.answer; // Capture the answer in the ans variable
  
        //console.log(ans); // Log the answer
      } else {
        console.error("Error:", response1.statusText);
      }

    } else {
      // console.log(function_arguments);
      // console.log(function_arguments?.query);
      console.error(
        "function_arguments.languageCode or function_arguments.query is undefined"
      );
    }
  } else {
    console.error("Unhandled function name: ", function_name);
  }

  //console.log(ans);

  return new Response(JSON.stringify(ans), {
    headers: { "Content-Type": "application/json" },
  });
}
